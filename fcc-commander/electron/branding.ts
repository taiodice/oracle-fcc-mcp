/** CaptainEPM — single hardcoded brand. No white-label loading. */

export interface BrandConfig {
  appName: string;
  shortName: string;
  companyName: string;
  colors: {
    primary: string;
    primaryLight: string;
    accent: string;
    coral: string;
    success: string;
    warning: string;
    error: string;
    background: string;
    surface: string;
    surfaceElevated: string;
    sidebar: string;
    sidebarText: string;
    text: string;
    textSecondary: string;
  };
  fonts: { heading: string; body: string };
  welcome: { title: string; subtitle: string };
}

export const BRAND: BrandConfig = {
  appName: "FCC Commander",
  shortName: "FCC Commander",
  companyName: "CaptainEPM",
  colors: {
    primary:         "#19C5A3",
    primaryLight:    "#2DE5A5",
    accent:          "#19C5A3",
    coral:           "#F59E0B",
    success:         "#19C5A3",
    warning:         "#F59E0B",
    error:           "#EF4444",
    background:      "#020C15",
    surface:         "#0A1628",
    surfaceElevated: "#10243E",
    sidebar:         "#020C15",
    sidebarText:     "#94A3B8",
    text:            "#F8FAFC",
    textSecondary:   "#94A3B8",
  },
  fonts: {
    heading: "Plus Jakarta Sans",
    body:    "Plus Jakarta Sans",
  },
  welcome: {
    title:    "FCC Commander",
    subtitle: "Your Oracle EPM Command Center — AI-powered Financial Consolidation & Close",
  },
};
