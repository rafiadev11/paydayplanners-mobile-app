import DateTimePicker from "@react-native-community/datetimepicker";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  dateFromIso,
  formatDateWithYear,
  isoDateFromDate,
} from "@shared/lib/format";
import { getAppTimezone } from "@shared/lib/timezone";
import { theme, withAlpha } from "@shared/ui/theme";

type DatePickerFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  placeholder?: string;
  minimumDate?: string;
  maximumDate?: string;
  allowClear?: boolean;
};

function atStartOfDay(date: Date) {
  return new Date(date.getTime());
}

function withinRange(
  date: Date,
  minimumDate?: Date | null,
  maximumDate?: Date | null,
) {
  if (minimumDate && date < atStartOfDay(minimumDate)) {
    return false;
  }

  if (maximumDate && date > atStartOfDay(maximumDate)) {
    return false;
  }

  return true;
}

function defaultPickerDate(
  minimumDate?: Date | null,
  maximumDate?: Date | null,
) {
  const today = dateFromIso(isoDateFromDate(new Date())) ?? new Date();

  if (withinRange(today, minimumDate, maximumDate)) {
    return today;
  }

  if (minimumDate && today < atStartOfDay(minimumDate)) {
    return atStartOfDay(minimumDate);
  }

  if (maximumDate && today > atStartOfDay(maximumDate)) {
    return atStartOfDay(maximumDate);
  }

  return today;
}

export function DatePickerField({
  label,
  value,
  onChange,
  hint,
  placeholder = "Select a date",
  minimumDate,
  maximumDate,
  allowClear = false,
}: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const minDate = useMemo(() => dateFromIso(minimumDate), [minimumDate]);
  const maxDate = useMemo(() => dateFromIso(maximumDate), [maximumDate]);

  const selectedDate = useMemo(
    () => dateFromIso(value) ?? defaultPickerDate(minDate, maxDate),
    [maxDate, minDate, value],
  );

  const picker = (
    <DateTimePicker
      accentColor={theme.colors.primary}
      display={Platform.OS === "ios" ? "inline" : "default"}
      maximumDate={maxDate ?? undefined}
      minimumDate={minDate ?? undefined}
      mode="date"
      timeZoneName={getAppTimezone()}
      onChange={(event, nextDate) => {
        if (event.type === "dismissed" || !nextDate) {
          if (Platform.OS === "android") {
            setOpen(false);
          }

          return;
        }

        onChange(isoDateFromDate(nextDate));
        setOpen(false);
      }}
      value={selectedDate}
    />
  );

  return (
    <View style={styles.group}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {allowClear && value ? (
          <Pressable
            hitSlop={8}
            onPress={() => {
              onChange("");
              setOpen(false);
            }}
          >
            <Text style={styles.clearLabel}>Clear</Text>
          </Pressable>
        ) : null}
      </View>

      <Pressable
        onPress={() => {
          Keyboard.dismiss();
          if (!value) {
            onChange(isoDateFromDate(defaultPickerDate(minDate, maxDate)));
          }
          setOpen((current) => !current);
        }}
        style={({ pressed }) => [
          styles.trigger,
          pressed ? styles.triggerPressed : null,
          open ? styles.triggerOpen : null,
        ]}
      >
        <View style={styles.triggerCopy}>
          <MaterialCommunityIcons
            color={theme.colors.primaryStrong}
            name="calendar-month-outline"
            size={18}
          />
          <Text
            style={[styles.triggerText, !value ? styles.placeholder : null]}
          >
            {value ? formatDateWithYear(value) : placeholder}
          </Text>
        </View>
        <MaterialCommunityIcons
          color={theme.colors.muted}
          name={open ? "chevron-up" : "chevron-down"}
          size={20}
        />
      </Pressable>

      {Platform.OS === "ios" && open ? (
        <View style={styles.iosPickerWrap}>{picker}</View>
      ) : null}
      {Platform.OS !== "ios" && open ? picker : null}

      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: 8,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  label: {
    color: theme.colors.ink,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  clearLabel: {
    color: theme.colors.primaryStrong,
    fontSize: 13,
    fontWeight: "700",
  },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceStrong,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  triggerPressed: {
    opacity: 0.9,
  },
  triggerOpen: {
    borderColor: theme.colors.primary,
  },
  triggerCopy: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  triggerText: {
    color: theme.colors.text,
    fontSize: 16,
  },
  placeholder: {
    color: theme.colors.muted,
  },
  iosPickerWrap: {
    overflow: "hidden",
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.primary, 0.14),
    backgroundColor: theme.colors.surfaceStrong,
    padding: 8,
  },
  hint: {
    color: theme.colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
});
