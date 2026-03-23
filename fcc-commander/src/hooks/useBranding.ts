import type { BrandConfig } from "../types/electron";

/** CaptainEPM brand — hardcoded, no dynamic loading. */
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

/** Returns the hardcoded CaptainEPM brand. No async, no loading state. */
export function useBranding() {
  return { branding: BRAND, loading: false };
}
