import { webLightTheme, type Theme } from "@fluentui/react-components";

// Preserve Fluent's official colors, states, elevation and typography scale.
// Inter is a local fallback for platforms without Segoe UI; the Porto logo is unmodified.
export const appTheme: Theme = {
  ...webLightTheme,
  fontFamilyBase:
    '"Segoe UI Variable", "Segoe UI", "Inter Variable", system-ui, sans-serif',
  fontFamilyNumeric:
    '"Segoe UI Variable", "Segoe UI", "Inter Variable", system-ui, sans-serif',
};
