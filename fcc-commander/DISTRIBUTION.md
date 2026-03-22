# FCC Commander — Distribution Guide

## Building a Branded Installer

### List available brands
```bash
npm run brands:list
```

### Build for a specific client
```bash
npm run build:brand -- --brand=default      # CaptainEPM default
npm run build:brand -- --brand=acme-corp    # Acme Corporation brand
npm run build:brand -- --brand=my-client    # Any brand in branding/
```

### Dry-run (preview without building)
```bash
npm run build:brand -- --brand=acme-corp --dry-run
```

Output lands in `release/<brand>/` as `<AppName>-Setup-<version>.exe`.

---

## Adding a New Client Brand

1. **Create the brand folder:**
   ```
   branding/
   └── client-name/
       ├── brand.json     ← required
       └── icon.ico       ← optional (256×256 recommended)
   ```

2. **Edit `brand.json`** (copy from `branding/default/brand.json` and customize):
   ```json
   {
     "appName": "Client Corp Financials",
     "shortName": "Client Financials",
     "companyName": "Client Corporation",
     "colors": {
       "primary":     "#1e3a5f",   ← sidebar header, buttons
       "primaryLight":"#2d5a8e",   ← hover states
       "accent":      "#f59e0b",   ← active indicators, highlights
       "sidebar":     "#0f172a",   ← sidebar background
       "sidebarText": "#e2e8f0"    ← sidebar text
     },
     "welcome": {
       "title": "Welcome to Client Financials",
       "subtitle": "Powered by Oracle FCC"
     }
   }
   ```

3. **Build:**
   ```bash
   npm run build:brand -- --brand=client-name
   ```

---

## Code Signing (Windows)

Unsigned installers will show a SmartScreen warning on first run.
To eliminate this, sign with a trusted certificate.

### Option A: Local PFX certificate
```bash
# Set these before building
export WIN_CSC_LINK=/path/to/certificate.pfx
export WIN_CSC_KEY_PASSWORD="your-password"

npm run build:brand -- --brand=client-name
```

### Option B: EV Certificate (Hardware Token)
EV certificates provide instant SmartScreen reputation.
Use with `electron-builder`'s `--sign` support or a pre-sign hook.

### Option C: Azure Trusted Signing (Cloud)
Add to `electron-builder.yml`:
```yaml
win:
  sign: ./installer/azure-sign.js
```

Create `installer/azure-sign.js` using `@electron/windows-sign` with Azure credentials.

### Testing Without a Certificate
During development, right-click the installer → "Run anyway" to bypass SmartScreen.
Alternatively, enable Windows Developer Mode to skip signature checks.

---

## Auto-Update Setup

The app checks for updates 5 seconds after launch.
Updates are served from `https://updates.captainepm.com/<brand-id>/`.

### Update server file structure
```
updates.captainepm.com/
├── fcc-commander/          ← default brand
│   ├── latest.yml
│   └── FCC-Commander-Setup-1.1.0.exe
├── acme-corp/              ← per-brand
│   ├── latest.yml
│   └── Acme-Corp-Financials-Setup-1.1.0.exe
└── ...
```

### Publishing a new version
1. Increment version in `package.json`
2. Build: `npm run build:brand -- --brand=<name>`
3. Upload `release/<name>/` contents to your update server
4. Users see the update banner automatically within 5 seconds of next launch

### Per-brand update URLs
The brand-build script automatically sets:
```
https://updates.captainepm.com/<brand-id>/
```

To use a custom update URL per client, add to `branding/<name>/brand.json`:
```json
{
  "updateUrl": "https://client-specific-server.com/updates/"
}
```
Then reference it in `installer/brand-build.ts` when constructing the `publish` config.

---

## Distribution Checklist

- [ ] `package.json` version bumped
- [ ] Brand JSON reviewed and correct
- [ ] `icon.ico` present for branded builds
- [ ] Certificate configured (or client aware of SmartScreen warning)
- [ ] Update server URL reachable
- [ ] Build tested on a clean Windows machine (no Node.js installed)
- [ ] Installer runs without UAC prompt (asInvoker mode)
- [ ] Auto-update detected and downloads from update URL
