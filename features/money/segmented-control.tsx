import { Pressable, StyleSheet, Text, View } from "react-native";

import { theme } from "@shared/ui/theme";

export type Segment<TValue extends string> = {
  key: TValue;
  label: string;
};

export function SegmentedControl<TValue extends string>({
  segments,
  value,
  onChange,
}: {
  segments: Segment<TValue>[];
  value: TValue;
  onChange: (next: TValue) => void;
}) {
  return (
    <View style={styles.track}>
      {segments.map((segment) => {
        const selected = segment.key === value;

        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={segment.key}
            onPress={() => {
              onChange(segment.key);
            }}
            style={({ pressed }) => [
              styles.segment,
              selected ? styles.segmentSelected : null,
              pressed && !selected ? styles.segmentPressed : null,
            ]}
          >
            <Text
              style={[styles.label, selected ? styles.labelSelected : null]}
            >
              {segment.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    padding: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.backgroundStrong,
  },
  segment: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: theme.spacing.sm + 2,
    borderRadius: theme.radius.pill,
  },
  segmentSelected: {
    backgroundColor: theme.colors.ink,
  },
  segmentPressed: {
    opacity: 0.7,
  },
  label: {
    color: theme.colors.muted,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  labelSelected: {
    color: theme.colors.white,
    fontWeight: "800",
  },
});
