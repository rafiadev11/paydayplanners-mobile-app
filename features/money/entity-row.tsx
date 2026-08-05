import { Pressable, StyleSheet, Text, View } from "react-native";

import { theme, withAlpha } from "@shared/ui/theme";

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/** Category colors come from user data, so anything unusable falls back. */
export function avatarTint(color: string | null | undefined) {
  return color && HEX_COLOR.test(color)
    ? withAlpha(color, 0.18)
    : theme.colors.surfaceMuted;
}

export function EntityRow({
  initial,
  tint,
  title,
  subtitle,
  value,
  valueTone = "default",
  dimmed = false,
  onPress,
}: {
  initial: string;
  tint: string;
  title: string;
  subtitle: string;
  value: string;
  valueTone?: "default" | "income";
  dimmed?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        dimmed ? styles.rowDimmed : null,
        pressed ? styles.rowPressed : null,
      ]}
    >
      <View style={[styles.avatar, { backgroundColor: tint }]}>
        <Text style={styles.avatarLabel}>{initial}</Text>
      </View>

      <View style={styles.copy}>
        <Text numberOfLines={1} style={styles.title}>
          {title}
        </Text>
        <Text numberOfLines={1} style={styles.subtitle}>
          {subtitle}
        </Text>
      </View>

      <Text
        style={[
          styles.value,
          valueTone === "income" ? styles.valueIncome : null,
        ]}
      >
        {value}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceStrong,
    padding: theme.spacing.md,
    ...theme.shadows.card,
  },
  rowDimmed: {
    opacity: 0.6,
  },
  rowPressed: {
    opacity: 0.84,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLabel: {
    color: theme.colors.ink,
    fontSize: 17,
    fontWeight: "800",
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  subtitle: {
    color: theme.colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  value: {
    color: theme.colors.ink,
    fontSize: 19,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  valueIncome: {
    color: theme.colors.success,
  },
});
