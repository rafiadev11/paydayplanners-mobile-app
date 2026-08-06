import { MaterialCommunityIcons } from "@expo/vector-icons";
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

import { theme, withAlpha } from "@shared/ui/theme";

export type ActionSheetOption<TValue extends string> = {
  key: TValue;
  label: string;
};

/**
 * A bottom sheet of mutually exclusive choices. Built on Modal rather than
 * ActionSheetIOS so both platforms get the same sheet — Alert, the usual
 * Android stand-in, caps out at three buttons.
 */
export function ActionSheet<TValue extends string>({
  visible,
  title,
  options,
  value,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: ActionSheetOption<TValue>[];
  value: TValue;
  onSelect: (next: TValue) => void;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);

      Animated.timing(progress, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();

      return;
    }

    Animated.timing(progress, {
      toValue: 0,
      duration: 180,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setMounted(false);
      }
    });
  }, [progress, visible]);

  if (!mounted) {
    return null;
  }

  const backdropOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const panelTranslateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [48, 0],
  });

  return (
    <Modal onRequestClose={onClose} transparent visible={mounted}>
      <View style={styles.root}>
        <Animated.View
          pointerEvents="none"
          style={[styles.backdropShade, { opacity: backdropOpacity }]}
        />
        <Pressable style={styles.backdrop} onPress={onClose} />
        <Animated.View
          style={[
            styles.panelWrap,
            { opacity: progress, transform: [{ translateY: panelTranslateY }] },
          ]}
        >
          <SafeAreaView edges={["bottom"]} style={styles.panel}>
            <Text style={styles.title}>{title}</Text>

            <View style={styles.options}>
              {options.map((option) => {
                const selected = option.key === value;

                return (
                  <Pressable
                    key={option.key}
                    onPress={() => {
                      onSelect(option.key);
                      onClose();
                    }}
                    style={({ pressed }) => [
                      styles.option,
                      selected ? styles.optionSelected : null,
                      pressed ? styles.optionPressed : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionLabel,
                        selected ? styles.optionLabelSelected : null,
                      ]}
                    >
                      {option.label}
                    </Text>
                    {selected ? (
                      <MaterialCommunityIcons
                        color={theme.colors.primaryStrong}
                        name="check"
                        size={20}
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.cancel,
                pressed ? styles.optionPressed : null,
              ]}
            >
              <Text style={styles.cancelLabel}>Cancel</Text>
            </Pressable>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdropShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: withAlpha(theme.colors.ink, 0.24),
  },
  backdrop: {
    flex: 1,
  },
  panelWrap: {
    shadowColor: theme.colors.ink,
    shadowOffset: {
      width: 0,
      height: -10,
    },
    shadowOpacity: 0.12,
    shadowRadius: 28,
    elevation: 18,
  },
  panel: {
    backgroundColor: theme.colors.surfaceStrong,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  title: {
    color: theme.colors.muted,
    ...theme.typography.eyebrow,
  },
  options: {
    gap: theme.spacing.xs,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surfaceMuted,
  },
  optionSelected: {
    backgroundColor: theme.colors.primarySoft,
  },
  optionPressed: {
    opacity: 0.8,
  },
  optionLabel: {
    color: theme.colors.text,
    ...theme.typography.cardTitle,
  },
  optionLabelSelected: {
    color: theme.colors.primaryStrong,
  },
  cancel: {
    alignItems: "center",
    paddingVertical: theme.spacing.md,
  },
  cancelLabel: {
    color: theme.colors.muted,
    fontSize: 15,
    fontWeight: "700",
  },
});
