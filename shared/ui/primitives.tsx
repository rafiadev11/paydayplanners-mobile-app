import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState, type ReactElement, type ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type RefreshControlProps,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  formatCurrencyPrecise,
  normalizeCurrencyInput,
  parseCurrencyInput,
} from "@shared/lib/format";
import { theme, withAlpha } from "@shared/ui/theme";

type AppScreenProps = {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  refreshControl?: ReactElement<RefreshControlProps>;
  topInset?: boolean;
};

type ScreenHeaderProps = {
  eyebrow: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
};

type SurfaceCardProps = {
  children: ReactNode;
  tone?: "light" | "dark" | "accent" | "warning";
  style?: StyleProp<ViewStyle>;
};

type MetricTileProps = {
  label: string;
  value: string;
  tone?: "light" | "dark" | "success" | "warning";
};

type StatusBadgeProps = {
  label: string;
  tone?: "neutral" | "primary" | "accent" | "danger" | "success" | "warning";
};

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
};

type FieldProps = TextInputProps & {
  label: string;
  hint?: string;
};

type ChoiceChipProps = {
  label: string;
  selected?: boolean;
  onPress: () => void;
};

const toneStyles = {
  light: {
    backgroundColor: theme.colors.surfaceStrong,
    borderColor: theme.colors.border,
  },
  dark: {
    backgroundColor: theme.colors.ink,
    borderColor: withAlpha(theme.colors.ink, 0.04),
  },
  accent: {
    backgroundColor: theme.colors.primarySoft,
    borderColor: withAlpha(theme.colors.primary, 0.12),
  },
  warning: {
    backgroundColor: theme.colors.accentSoft,
    borderColor: withAlpha(theme.colors.accent, 0.16),
  },
} as const;

const badgeToneStyles = {
  neutral: {
    backgroundColor: theme.colors.surfaceMuted,
    color: theme.colors.inkMuted,
  },
  primary: {
    backgroundColor: theme.colors.primarySoft,
    color: theme.colors.primaryStrong,
  },
  accent: {
    backgroundColor: theme.colors.accentSoft,
    color: theme.colors.warning,
  },
  danger: {
    backgroundColor: theme.colors.dangerSoft,
    color: theme.colors.danger,
  },
  success: {
    backgroundColor: theme.colors.successSoft,
    color: theme.colors.success,
  },
  warning: {
    backgroundColor: theme.colors.accentSoft,
    color: theme.colors.warning,
  },
} as const;

export function AppScreen({
  children,
  contentContainerStyle,
  refreshControl,
  topInset = true,
}: AppScreenProps) {
  return (
    <SafeAreaView edges={topInset ? ["top"] : []} style={styles.safeArea}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={styles.topInkOrb} />
        <View style={styles.topTealOrb} />
        <View style={styles.bottomGoldOrb} />
      </View>
      <ScrollView
        contentContainerStyle={[styles.screenContent, contentContainerStyle]}
        refreshControl={refreshControl ?? undefined}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function ScreenHeader({
  eyebrow,
  title,
  subtitle,
  right,
}: ScreenHeaderProps) {
  return (
    <View style={styles.screenHeader}>
      <View style={styles.screenHeaderCopy}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.screenTitle}>{title}</Text>
        {subtitle ? (
          <Text style={styles.screenSubtitle}>{subtitle}</Text>
        ) : null}
      </View>
      {right ? <View style={styles.headerRight}>{right}</View> : null}
    </View>
  );
}

export function SurfaceCard({
  children,
  tone = "light",
  style,
}: SurfaceCardProps) {
  return <View style={[styles.card, toneStyles[tone], style]}>{children}</View>;
}

export function SectionTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderCopy}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? (
          <Text style={styles.sectionSubtitle}>{subtitle}</Text>
        ) : null}
      </View>
      {action}
    </View>
  );
}

export function MetricTile({ label, value, tone = "light" }: MetricTileProps) {
  const dark = tone === "dark";
  const warning = tone === "warning";
  const success = tone === "success";

  return (
    <View
      style={[
        styles.metricTile,
        dark ? styles.metricTileDark : null,
        warning ? styles.metricTileWarning : null,
        success ? styles.metricTileSuccess : null,
      ]}
    >
      <Text style={[styles.metricLabel, dark ? styles.metricLabelDark : null]}>
        {label}
      </Text>
      <Text style={[styles.metricValue, dark ? styles.metricValueDark : null]}>
        {value}
      </Text>
    </View>
  );
}

export function StatusBadge({ label, tone = "neutral" }: StatusBadgeProps) {
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: badgeToneStyles[tone].backgroundColor },
      ]}
    >
      <Text style={[styles.badgeLabel, { color: badgeToneStyles[tone].color }]}>
        {label}
      </Text>
    </View>
  );
}

export function PrimaryButton({ label, onPress, disabled, icon }: ButtonProps) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        pressed && !disabled ? styles.buttonPressed : null,
        disabled ? styles.buttonDisabled : null,
      ]}
    >
      {icon ? (
        <MaterialCommunityIcons
          color={theme.colors.white}
          name={icon}
          size={18}
        />
      ) : null}
      <Text style={styles.primaryButtonLabel}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  onPress,
  disabled,
  icon,
}: ButtonProps) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondaryButton,
        pressed && !disabled ? styles.buttonPressed : null,
        disabled ? styles.buttonDisabled : null,
      ]}
    >
      {icon ? (
        <MaterialCommunityIcons
          color={theme.colors.ink}
          name={icon}
          size={18}
        />
      ) : null}
      <Text style={styles.secondaryButtonLabel}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, hint, style, ...props }: FieldProps) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={theme.colors.muted}
        style={[styles.fieldInput, style]}
        {...props}
      />
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

export function CurrencyField({
  label,
  hint,
  style,
  value,
  onChangeText,
  placeholder = "$0.00",
  ...props
}: FieldProps) {
  const [focused, setFocused] = useState(false);
  const normalizedValue = typeof value === "string" ? value : "";
  const parsedValue = parseCurrencyInput(normalizedValue);
  const displayValue =
    focused || !normalizedValue
      ? normalizedValue
      : formatCurrencyPrecise(parsedValue ?? normalizedValue);

  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        keyboardType="decimal-pad"
        onBlur={(event) => {
          setFocused(false);
          props.onBlur?.(event);
        }}
        onChangeText={(nextValue) => {
          onChangeText?.(normalizeCurrencyInput(nextValue));
        }}
        onFocus={(event) => {
          setFocused(true);
          props.onFocus?.(event);
        }}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.muted}
        style={[styles.fieldInput, style]}
        value={displayValue}
        {...props}
      />
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

export function ChoiceChip({
  label,
  selected = false,
  onPress,
}: ChoiceChipProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.choiceChip,
        selected ? styles.choiceChipSelected : null,
        pressed ? styles.buttonPressed : null,
      ]}
    >
      <Text
        style={[
          styles.choiceChipLabel,
          selected ? styles.choiceChipLabelSelected : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function LoadingState({ label }: { label: string }) {
  return (
    <SurfaceCard tone="light" style={styles.messageCard}>
      <MaterialCommunityIcons
        color={theme.colors.primary}
        name="progress-clock"
        size={28}
      />
      <Text style={styles.messageTitle}>Loading</Text>
      <Text style={styles.messageBody}>{label}</Text>
    </SurfaceCard>
  );
}

export function ErrorState({
  title,
  body,
  onRetry,
}: {
  title: string;
  body: string;
  onRetry: () => void;
}) {
  return (
    <SurfaceCard style={styles.messageCard}>
      <MaterialCommunityIcons
        color={theme.colors.danger}
        name="alert-circle-outline"
        size={28}
      />
      <Text style={styles.messageTitle}>{title}</Text>
      <Text style={styles.messageBody}>{body}</Text>
      <SecondaryButton icon="refresh" label="Try again" onPress={onRetry} />
    </SurfaceCard>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <SurfaceCard tone="accent" style={styles.messageCard}>
      <MaterialCommunityIcons
        color={theme.colors.primaryStrong}
        name="star-outline"
        size={26}
      />
      <Text style={styles.messageTitle}>{title}</Text>
      <Text style={styles.messageBody}>{body}</Text>
    </SurfaceCard>
  );
}

export function Row({
  title,
  subtitle,
  value,
  valueTone = "default",
  badge,
}: {
  title: string;
  subtitle?: string;
  value?: string;
  valueTone?: "default" | "success" | "danger";
  badge?: ReactNode;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowCopy}>
        <View style={styles.rowTitleWrap}>
          <Text style={styles.rowTitle}>{title}</Text>
          {badge}
        </View>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      {value ? (
        <Text
          style={[
            styles.rowValue,
            valueTone === "success" ? styles.rowValueSuccess : null,
            valueTone === "danger" ? styles.rowValueDanger : null,
          ]}
        >
          {value}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  screenContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: 128,
    gap: theme.spacing.lg,
  },
  topInkOrb: {
    position: "absolute",
    top: -80,
    left: -32,
    width: 240,
    height: 240,
    borderRadius: 240,
    backgroundColor: withAlpha(theme.colors.ink, 0.12),
  },
  topTealOrb: {
    position: "absolute",
    top: 76,
    right: -42,
    width: 132,
    height: 132,
    borderRadius: 132,
    backgroundColor: withAlpha(theme.colors.primary, 0.14),
  },
  bottomGoldOrb: {
    position: "absolute",
    bottom: 72,
    left: -36,
    width: 180,
    height: 180,
    borderRadius: 180,
    backgroundColor: withAlpha(theme.colors.accent, 0.12),
  },
  screenHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing.md,
  },
  screenHeaderCopy: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  headerRight: {
    paddingTop: 2,
  },
  eyebrow: {
    color: theme.colors.primaryStrong,
    ...theme.typography.eyebrow,
  },
  screenTitle: {
    color: theme.colors.text,
    ...theme.typography.title,
  },
  screenSubtitle: {
    color: theme.colors.muted,
    ...theme.typography.body,
  },
  card: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    ...theme.shadows.card,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md,
  },
  sectionHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  sectionTitle: {
    color: theme.colors.text,
    ...theme.typography.cardTitle,
  },
  sectionSubtitle: {
    color: theme.colors.muted,
    ...theme.typography.body,
  },
  metricTile: {
    flex: 1,
    minWidth: "47%",
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceStrong,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.xs,
  },
  metricTileDark: {
    backgroundColor: theme.colors.ink,
    borderColor: withAlpha(theme.colors.ink, 0.04),
  },
  metricTileWarning: {
    backgroundColor: theme.colors.accentSoft,
    borderColor: withAlpha(theme.colors.accent, 0.16),
  },
  metricTileSuccess: {
    backgroundColor: theme.colors.successSoft,
    borderColor: withAlpha(theme.colors.success, 0.16),
  },
  metricLabel: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  metricLabelDark: {
    color: withAlpha(theme.colors.white, 0.72),
  },
  metricValue: {
    color: theme.colors.text,
    ...theme.typography.metricCompact,
  },
  metricValueDark: {
    color: theme.colors.white,
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.ink,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  primaryButtonLabel: {
    color: theme.colors.white,
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    backgroundColor: withAlpha(theme.colors.white, 0.7),
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  secondaryButtonLabel: {
    color: theme.colors.ink,
    fontSize: 14,
    fontWeight: "700",
  },
  buttonPressed: {
    opacity: 0.82,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    color: theme.colors.ink,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  fieldInput: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceStrong,
    color: theme.colors.text,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  fieldHint: {
    color: theme.colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  choiceChip: {
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceStrong,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  choiceChipSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
  },
  choiceChipLabel: {
    color: theme.colors.inkMuted,
    fontSize: 14,
    fontWeight: "700",
  },
  choiceChipLabelSelected: {
    color: theme.colors.primaryStrong,
  },
  messageCard: {
    alignItems: "flex-start",
  },
  messageTitle: {
    color: theme.colors.text,
    ...theme.typography.cardTitle,
  },
  messageBody: {
    color: theme.colors.muted,
    ...theme.typography.body,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md,
  },
  rowCopy: {
    flex: 1,
    gap: 4,
  },
  rowTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  rowTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  rowSubtitle: {
    color: theme.colors.muted,
    ...theme.typography.body,
  },
  rowValue: {
    color: theme.colors.ink,
    fontSize: 15,
    fontWeight: "800",
  },
  rowValueSuccess: {
    color: theme.colors.success,
  },
  rowValueDanger: {
    color: theme.colors.danger,
  },
});
