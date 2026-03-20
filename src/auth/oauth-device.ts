// OAuth 2.0 Device Code Flow for Oracle IDCS
// Mirrors OAuthTokenManager.cs from Captain-EPM-Addin

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

interface TokenCache {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // Unix timestamp ms
}

export interface OAuthConfig {
  idcs_url: string;
  client_id: string;
  client_secret?: string;
}

export interface DeviceCodeChallenge {
  user_code: string;
  verification_uri: string;
  device_code: string;
  expires_in: number;
}

export class OAuthDeviceFlow {
  private config: OAuthConfig;
  private cache: TokenCache | null = null;
  private scope = "urn:opc:resource:consumer::all";

  constructor(config: OAuthConfig) {
    this.config = config;
  }

  async initiateDeviceFlow(): Promise<DeviceCodeChallenge> {
    const url = `${this.config.idcs_url}/oauth2/v1/device`;
    const body = new URLSearchParams({
      client_id: this.config.client_id,
      scope: this.scope,
    });

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`IDCS device code request failed (${res.status}): ${text}`);
    }

    const data = (await res.json()) as DeviceCodeResponse;
    return {
      user_code: data.user_code,
      verification_uri: data.verification_uri,
      device_code: data.device_code,
      expires_in: data.expires_in,
    };
  }

  async pollForToken(device_code: string, interval_seconds: number = 5, timeout_seconds: number = 300): Promise<void> {
    const url = `${this.config.idcs_url}/oauth2/v1/token`;
    const deadline = Date.now() + timeout_seconds * 1000;

    const body: Record<string, string> = {
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      device_code,
      client_id: this.config.client_id,
    };
    if (this.config.client_secret) {
      body.client_secret = this.config.client_secret;
    }

    while (Date.now() < deadline) {
      await sleep(interval_seconds * 1000);

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(body).toString(),
      });

      if (res.ok) {
        const token = (await res.json()) as TokenResponse;
        this.setCache(token);
        return;
      }

      const err = await res.json().catch(() => ({})) as { error?: string };
      if (err.error === "authorization_pending" || err.error === "slow_down") {
        continue; // Keep polling
      }
      throw new Error(`Token poll failed: ${JSON.stringify(err)}`);
    }

    throw new Error("OAuth Device Flow timed out — user did not authenticate in time");
  }

  async getAuthHeader(): Promise<string> {
    if (this.cache && this.cache.expiresAt > Date.now() + 60_000) {
      return `Bearer ${this.cache.accessToken}`;
    }

    if (this.cache?.refreshToken) {
      await this.refreshToken(this.cache.refreshToken);
      return `Bearer ${this.cache!.accessToken}`;
    }

    throw new Error(
      "OAuth token expired and no refresh token available. Please re-authenticate using fcc_test_connection."
    );
  }

  private async refreshToken(refresh_token: string): Promise<void> {
    const url = `${this.config.idcs_url}/oauth2/v1/token`;
    const body: Record<string, string> = {
      grant_type: "refresh_token",
      refresh_token,
      client_id: this.config.client_id,
    };
    if (this.config.client_secret) {
      body.client_secret = this.config.client_secret;
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body).toString(),
    });

    if (!res.ok) {
      this.cache = null;
      throw new Error(`Token refresh failed (${res.status}). Please re-authenticate.`);
    }

    const token = (await res.json()) as TokenResponse;
    this.setCache(token);
  }

  private setCache(token: TokenResponse): void {
    this.cache = {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: Date.now() + token.expires_in * 1000,
    };
  }

  isAuthenticated(): boolean {
    return this.cache !== null && this.cache.expiresAt > Date.now();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
