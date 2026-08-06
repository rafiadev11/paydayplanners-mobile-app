import { MaterialCommunityIcons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SecondaryButton, StatusBadge } from "@shared/ui/primitives";
import { theme, withAlpha } from "@shared/ui/theme";

const APP_VERSION = Constants.expoConfig?.version ?? "1.0.0";

/** The header affordance that opens the drawer, shared by every screen with one. */
export function AccountButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityHint="Opens account and settings options."
      accessibilityLabel="Open account drawer"
      hitSlop={10}
      onPress={onPress}
      style={({ pressed }) => [
        styles.accountButton,
        pressed ? styles.accountButtonPressed : null,
      ]}
    >
      <MaterialCommunityIcons
        color={theme.colors.ink}
        name="account-outline"
        size={24}
      />
    </Pressable>
  );
}

function AccountDrawerItem({
  icon,
  title,
  subtitle,
  onPress,
  disabled = false,
  tone = "default",
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  subtitle: string;
  onPress?: () => void;
  disabled?: boolean;
  tone?: "default" | "danger";
}) {
  return (
    <Pressable
      disabled={disabled || !onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.drawerItem,
        pressed && !disabled && onPress ? styles.drawerItemPressed : null,
        disabled ? styles.drawerItemDisabled : null,
      ]}
    >
      <View
        style={[
          styles.drawerItemIconWrap,
          tone === "danger" ? styles.drawerItemIconDanger : null,
        ]}
      >
        <MaterialCommunityIcons
          color={tone === "danger" ? theme.colors.danger : theme.colors.ink}
          name={icon}
          size={20}
        />
      </View>
      <View style={styles.drawerItemCopy}>
        <View style={styles.drawerItemTitleRow}>
          <Text
            style={[
              styles.drawerItemTitle,
              tone === "danger" ? styles.drawerItemTitleDanger : null,
            ]}
          >
            {title}
          </Text>
          {disabled ? <StatusBadge label="Soon" tone="neutral" /> : null}
        </View>
        <Text style={styles.drawerItemSubtitle}>{subtitle}</Text>
      </View>
      {!disabled && onPress ? (
        <MaterialCommunityIcons
          color={theme.colors.muted}
          name="chevron-right"
          size={20}
        />
      ) : null}
    </Pressable>
  );
}

export function AccountDrawer({
  visible,
  userName,
  onClose,
  onOpenAccount,
  onOpenHelpAndLegal,
  onOpenDeleteAccount,
  onSignOut,
}: {
  visible: boolean;
  userName?: string | null;
  onClose: () => void;
  onOpenAccount: () => void;
  onOpenHelpAndLegal: () => void;
  onOpenDeleteAccount: () => void;
  onSignOut: () => void;
}) {
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);

      Animated.timing(progress, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();

      return;
    }

    Animated.timing(progress, {
      toValue: 0,
      duration: 220,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setMounted(false);
      }
    });
  }, [progress, visible]);

  const backdropOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const panelTranslateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [72, 0],
  });

  const panelOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1],
  });

  const panelScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.985, 1],
  });

  if (!mounted) {
    return null;
  }

  return (
    <Modal onRequestClose={onClose} transparent visible={mounted}>
      <View style={styles.drawerRoot}>
        <Animated.View
          pointerEvents="none"
          style={[styles.drawerBackdropShade, { opacity: backdropOpacity }]}
        />
        <Pressable style={styles.drawerBackdrop} onPress={onClose} />
        <Animated.View
          style={[
            styles.drawerPanelWrap,
            {
              opacity: panelOpacity,
              transform: [
                { translateX: panelTranslateX },
                { scale: panelScale },
              ],
            },
          ]}
        >
          <SafeAreaView edges={["top", "bottom"]} style={styles.drawerPanel}>
            <View style={styles.drawerHeader}>
              <View style={styles.drawerHeaderCopy}>
                <Text style={styles.drawerEyebrow}>Account</Text>
                <Text style={styles.drawerTitle}>{userName ?? "Account"}</Text>
              </View>
              <Pressable
                hitSlop={10}
                onPress={onClose}
                style={({ pressed }) => [
                  styles.drawerCloseButton,
                  pressed ? styles.accountButtonPressed : null,
                ]}
              >
                <MaterialCommunityIcons
                  color={theme.colors.ink}
                  name="close"
                  size={20}
                />
              </Pressable>
            </View>

            <View style={styles.drawerGroup}>
              <AccountDrawerItem
                icon="account-edit-outline"
                onPress={onOpenAccount}
                subtitle="Update your name, email, and personal profile details."
                title="Account info"
              />
            </View>

            <View style={styles.drawerUtilitySection}>
              <Pressable
                onPress={onOpenHelpAndLegal}
                style={({ pressed }) => [
                  styles.drawerFooterLink,
                  styles.drawerUtilityLink,
                  pressed ? styles.drawerItemPressed : null,
                ]}
              >
                <MaterialCommunityIcons
                  color={theme.colors.primaryStrong}
                  name="lifebuoy"
                  size={18}
                />
                <Text style={styles.drawerFooterLinkLabel}>Help & Support</Text>
                <MaterialCommunityIcons
                  color={theme.colors.muted}
                  name="chevron-right"
                  size={18}
                />
              </Pressable>
            </View>

            <View style={styles.drawerFooter}>
              <Pressable
                onPress={onOpenDeleteAccount}
                style={({ pressed }) => [
                  styles.drawerFooterLink,
                  styles.drawerFooterDangerLink,
                  pressed ? styles.drawerItemPressed : null,
                ]}
              >
                <MaterialCommunityIcons
                  color={theme.colors.danger}
                  name="delete-outline"
                  size={18}
                />
                <Text
                  style={[
                    styles.drawerFooterLinkLabel,
                    styles.drawerFooterDangerLinkLabel,
                  ]}
                >
                  Delete account
                </Text>
                <MaterialCommunityIcons
                  color={theme.colors.danger}
                  name="chevron-right"
                  size={18}
                />
              </Pressable>
              <SecondaryButton
                icon="logout"
                label="Log out"
                onPress={onSignOut}
              />
              <Text style={styles.drawerVersionLabel}>
                Version {APP_VERSION}
              </Text>
            </View>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  accountButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: withAlpha(theme.colors.white, 0.82),
    alignItems: "center",
    justifyContent: "center",
  },
  accountButtonPressed: {
    opacity: 0.8,
  },
  drawerRoot: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  drawerBackdropShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: withAlpha(theme.colors.ink, 0.24),
  },
  drawerBackdrop: {
    flex: 1,
  },
  drawerPanelWrap: {
    width: "80%",
    maxWidth: 344,
    shadowColor: theme.colors.ink,
    shadowOffset: {
      width: -10,
      height: 0,
    },
    shadowOpacity: 0.12,
    shadowRadius: 28,
    elevation: 18,
  },
  drawerPanel: {
    flex: 1,
    borderLeftWidth: 1,
    borderLeftColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceStrong,
    borderTopLeftRadius: theme.radius.lg,
    borderBottomLeftRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xxl + theme.spacing.xl,
    paddingBottom: theme.spacing.xxl,
    gap: theme.spacing.lg,
  },
  drawerHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing.md,
  },
  drawerHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  drawerEyebrow: {
    color: theme.colors.primaryStrong,
    ...theme.typography.eyebrow,
  },
  drawerTitle: {
    color: theme.colors.text,
    ...theme.typography.title,
    fontSize: 26,
  },
  drawerCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surfaceMuted,
  },
  drawerGroup: {
    gap: theme.spacing.md,
  },
  drawerFooterLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
  },
  drawerUtilityLink: {
    paddingTop: theme.spacing.xs,
    paddingBottom: 2,
  },
  drawerFooterLinkLabel: {
    color: theme.colors.primaryStrong,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.1,
  },
  drawerFooterDangerLink: {
    marginTop: 0,
  },
  drawerFooterDangerLinkLabel: {
    color: theme.colors.danger,
  },
  drawerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
  },
  drawerItemPressed: {
    opacity: 0.84,
  },
  drawerItemDisabled: {
    opacity: 0.72,
  },
  drawerItemIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surfaceMuted,
  },
  drawerItemIconDanger: {
    backgroundColor: theme.colors.dangerSoft,
  },
  drawerItemCopy: {
    flex: 1,
    gap: 4,
  },
  drawerItemTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
  },
  drawerItemTitle: {
    color: theme.colors.text,
    ...theme.typography.cardTitle,
  },
  drawerItemTitleDanger: {
    color: theme.colors.danger,
  },
  drawerItemSubtitle: {
    color: theme.colors.muted,
    ...theme.typography.body,
  },
  drawerUtilitySection: {
    marginTop: "auto",
    paddingTop: theme.spacing.xs,
    paddingBottom: 0,
  },
  drawerFooter: {
    gap: theme.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
    paddingTop: 2,
  },
  drawerVersionLabel: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.2,
    textAlign: "center",
    paddingTop: theme.spacing.sm,
  },
});
