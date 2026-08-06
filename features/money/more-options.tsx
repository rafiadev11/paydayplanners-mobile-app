import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { theme } from "@shared/ui/theme";

/**
 * Keeps rarely-used fields off the first screen without hiding them.
 *
 * `defaultExpanded` should be set when editing a record that already uses one
 * of the fields inside — a value the user entered earlier must never be tucked
 * away where they cannot see it.
 */
export function MoreOptions({
  children,
  defaultExpanded = false,
  label = "More options",
}: {
  children: ReactNode;
  defaultExpanded?: boolean;
  label?: string;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => {
          setExpanded((current) => !current);
        }}
        style={({ pressed }) => [
          styles.trigger,
          pressed ? styles.triggerPressed : null,
        ]}
      >
        <MaterialCommunityIcons
          color={theme.colors.primaryStrong}
          name={expanded ? "chevron-down" : "chevron-right"}
          size={20}
        />
        <Text style={styles.label}>{label}</Text>
      </Pressable>

      {expanded ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: theme.spacing.md,
  },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.xs,
  },
  triggerPressed: {
    opacity: 0.6,
  },
  label: {
    color: theme.colors.primaryStrong,
    fontSize: 15,
    fontWeight: "700",
  },
  body: {
    gap: theme.spacing.lg,
  },
});
