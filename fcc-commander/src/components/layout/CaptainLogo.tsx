import React from "react";

/**
 * Official CaptainEPM sailboat logo — extracted from captain-epm-branding-kit.html
 *
 * Props:
 *   size     — rendered size in px (default 48)
 *   float    — enables the gentle vertical float animation (default false)
 *   animate  — enables sail-flutter animation on the sails (default false)
 */
export function CaptainLogo({
  size = 48,
  float = false,
  animate = false,
}: {
  size?: number;
  float?: boolean;
  animate?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      aria-label="CaptainEPM logo"
      style={float ? { animation: "capt-float 4s ease-in-out infinite" } : undefined}
    >
      {/* Main Sail */}
      <path
        d="M50 12 L50 58 L22 58 Z"
        fill="#19C5A3"
        style={animate ? {
          animation: "capt-sail 3s ease-in-out infinite",
          transformOrigin: "center bottom",
        } : undefined}
      />
      {/* Jib Sail */}
      <path
        d="M50 20 L50 54 L70 54 Z"
        fill="#2DE5A5"
        opacity={0.7}
        style={animate ? {
          animation: "capt-sail 3s ease-in-out infinite",
          transformOrigin: "center bottom",
        } : undefined}
      />
      {/* Mast */}
      <line x1="50" y1="10" x2="50" y2="62" stroke="#F8FAFC" strokeWidth="2.5" />
      {/* Hull */}
      <path d="M18 62 L26 74 L74 74 L82 62 Z" fill="#19C5A3" />
      {/* Water reflection */}
      <ellipse cx="50" cy="78" rx="38" ry="4" fill="#19C5A3" opacity={0.25} />
      {/* Wave 1 */}
      <path
        d="M8 84 Q26 78 44 84 T80 84"
        stroke="#2DE5A5"
        strokeWidth="2"
        fill="none"
        opacity={0.5}
      />
      {/* Wave 2 */}
      <path
        d="M15 90 Q33 84 51 90 T87 90"
        stroke="#19C5A3"
        strokeWidth="1.5"
        fill="none"
        opacity={0.3}
      />
    </svg>
  );
}

/**
 * Full wordmark lockup: logo + "CaptainEPM" text side-by-side.
 * Used in the sidebar header (collapsed=false) and welcome screen.
 */
export function CaptainWordmark({
  logoSize = 40,
  fontSize = "1.4rem",
}: {
  logoSize?: number;
  fontSize?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      <CaptainLogo size={logoSize} animate />
      <span
        style={{
          fontFamily: "'Plus Jakarta Sans', 'Outfit', system-ui, sans-serif",
          fontSize,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          lineHeight: 1,
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ color: "#F8FAFC" }}>Captain</span>
        <span style={{ color: "#19C5A3" }}>EPM</span>
      </span>
    </div>
  );
}
