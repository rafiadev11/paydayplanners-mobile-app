import { Platform } from "react-native";

function withAlpha(hex: string, opacity: number) {
  const normalized = hex.replace("#", "");

  if (normalized.length !== 6) return hex;

  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export const theme = {
  colors: {
    background: "#F4EFE7",
    backgroundMuted: "#ECE4D7",
    backgroundStrong: "#E3D8C6",
    surface: "#FFFDFC",
    surfaceMuted: "#F7F1E8",
    surfaceStrong: "#FFFFFF",
    ink: "#132238",
    inkMuted: "#213450",
    text: "#1F2A3A",
    muted: "#6A7485",
    primary: "#146B5C",
    primaryStrong: "#0F584C",
    primarySoft: "#D5ECE6",
    accent: "#C49547",
    accentSoft: "#F4E5C9",
    danger: "#C76558",
    dangerSoft: "#F8E0DA",
    success: "#21816B",
    successSoft: "#D9EFE8",
    warning: "#B87932",
    warningSoft: "#F6E4CC",
    border: "#D8CFBF",
    borderStrong: "#B9AB92",
    divider: "#E5DCCF",
    white: "#FFFFFF",
    overlay: withAlpha("#132238", 0.6),
    shadow: withAlpha("#132238", 0.12),
    tabBar: withAlpha("#FFFDFC", 0.96),
  },
  spacing: {
    xs: 6,
    sm: 10,
    md: 14,
    lg: 18,
    xl: 24,
    xxl: 32,
  },
  radius: {
    sm: 12,
    md: 18,
    lg: 24,
    pill: 999,
  },
  typography: {
    eyebrow: {
      fontSize: 12,
      fontWeight: "700" as const,
      letterSpacing: 1.4,
      textTransform: "uppercase" as const,
    },
    title: {
      fontSize: 30,
      fontWeight: "800" as const,
      letterSpacing: -0.8,
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: "700" as const,
      letterSpacing: -0.2,
    },
    body: {
      fontSize: 15,
      lineHeight: 22,
    },
    bodyStrong: {
      fontSize: 15,
      lineHeight: 22,
      fontWeight: "600" as const,
    },
    metric: {
      fontSize: 28,
      fontWeight: "800" as const,
      letterSpacing: -0.8,
    },
    metricCompact: {
      fontSize: 22,
      fontWeight: "800" as const,
      letterSpacing: -0.4,
    },
  },
  shadows: {
    card: Platform.select({
      ios: {
        shadowColor: withAlpha("#132238", 0.18),
        shadowOpacity: 1,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
      },
      android: {
        elevation: 6,
      },
      default: {},
    }),
  },
};

export { withAlpha };
