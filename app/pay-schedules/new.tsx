import { useRouter } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  createPaySchedule,
  type PayScheduleInput,
} from "@features/planning/api";
import { getApiErrorMessage } from "@shared/lib/api-error";
import {
  parseCurrencyInput,
  formatCurrency,
  formatFrequency,
  formatLongWeekday,
  isoDateFromInput,
  monthDayFromIsoDate,
  weekdayFromIsoDate,
} from "@shared/lib/format";
import {
  ChoiceChip,
  CurrencyField,
  Field,
  PrimaryButton,
  SecondaryButton,
  SectionTitle,
  SurfaceCard,
} from "@shared/ui/primitives";
import { DatePickerField } from "@shared/ui/date-picker-field";
import { theme } from "@shared/ui/theme";

const frequencyOptions: PayScheduleInput["frequency"][] = [
  "weekly",
  "biweekly",
  "monthly",
  "once",
];

export default function NewPayScheduleScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] =
    useState<PayScheduleInput["frequency"]>("biweekly");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [monthDay, setMonthDay] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedStartDate = isoDateFromInput(startDate);
  const normalizedEndDate = isoDateFromInput(endDate);
  const derivedWeekday = weekdayFromIsoDate(startDate);
  const derivedMonthDay = monthDayFromIsoDate(startDate);

  const submit = async () => {
    const normalizedAmount = parseCurrencyInput(amount);

    if (!name.trim()) {
      setError("Enter a name for this paycheck.");
      return;
    }

    if (!normalizedAmount) {
      setError("Enter a valid paycheck amount.");
      return;
    }

    if (!normalizedStartDate) {
      setError("Select the first pay date.");
      return;
    }

    if (
      frequency !== "once" &&
      normalizedEndDate &&
      normalizedEndDate < normalizedStartDate
    ) {
      setError("The end date must be on or after the start date.");
      return;
    }

    const payload: PayScheduleInput = {
      name: name.trim(),
      amount: normalizedAmount,
      frequency,
      start_date: normalizedStartDate,
      end_date: normalizedEndDate,
      is_active: true,
    };

    if (frequency === "weekly" || frequency === "biweekly") {
      payload.weekday = derivedWeekday;
      payload.interval_value = frequency === "weekly" ? 1 : 2;
    }

    if (frequency === "monthly") {
      payload.month_day = Number(monthDay || derivedMonthDay || 0) || null;
    }

    setLoading(true);
    setError(null);

    try {
      await createPaySchedule(payload);
      router.back();
    } catch (nextError) {
      setError(getApiErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.screen}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        showsVerticalScrollIndicator={false}
      >
        <SurfaceCard tone="accent">
          <SectionTitle
            subtitle="Set the income pattern that will anchor all upcoming bills."
            title="Paycheck setup"
          />
          <Text style={styles.previewValue}>
            {formatCurrency(parseCurrencyInput(amount) ?? 0)}
          </Text>
          <Text style={styles.previewBody}>
            {name.trim() || "Your paycheck"} on{" "}
            {normalizedStartDate
              ? formatLongWeekday(normalizedStartDate)
              : "the selected date"}
            , {formatFrequency(frequency).toLowerCase()}.
          </Text>
        </SurfaceCard>

        <SurfaceCard>
          <Field
            autoCapitalize="words"
            label="Name"
            onChangeText={setName}
            placeholder="Primary paycheck"
            value={name}
          />
          <CurrencyField
            label="Amount"
            onChangeText={setAmount}
            placeholder="$2,400.00"
            value={amount}
          />

          <View style={styles.chipWrap}>
            {frequencyOptions.map((option) => (
              <ChoiceChip
                key={option}
                label={formatFrequency(option)}
                onPress={() => {
                  setFrequency(option);
                }}
                selected={frequency === option}
              />
            ))}
          </View>

          <DatePickerField
            hint="Pick the first pay date and the app will send the exact ISO date to the backend."
            label="First pay date"
            onChange={setStartDate}
            value={startDate}
          />

          {frequency === "monthly" ? (
            <Field
              hint={
                derivedMonthDay
                  ? `Leave matching the first pay date as day ${derivedMonthDay}, or override it.`
                  : "Enter the calendar day this paycheck repeats on."
              }
              keyboardType="number-pad"
              label="Day of month"
              onChangeText={setMonthDay}
              placeholder={derivedMonthDay ? String(derivedMonthDay) : "15"}
              value={monthDay}
            />
          ) : null}

          <DatePickerField
            allowClear
            hint="Optional. Leave empty if this income continues indefinitely."
            label="End date"
            minimumDate={startDate}
            onChange={setEndDate}
            value={endDate}
          />

          {frequency === "weekly" || frequency === "biweekly" ? (
            <Text style={styles.helperCopy}>
              Weekday is derived from the first pay date so the API accepts the
              schedule without mismatch errors.
            </Text>
          ) : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.actions}>
            <SecondaryButton
              label="Cancel"
              onPress={() => {
                router.back();
              }}
            />
            <PrimaryButton
              disabled={loading}
              icon="content-save-outline"
              label={loading ? "Saving..." : "Save paycheck"}
              onPress={() => {
                void submit();
              }}
            />
          </View>
        </SurfaceCard>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
    paddingBottom: 72,
  },
  previewValue: {
    color: theme.colors.ink,
    ...theme.typography.metric,
  },
  previewBody: {
    color: theme.colors.muted,
    ...theme.typography.body,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  helperCopy: {
    color: theme.colors.muted,
    ...theme.typography.body,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: 14,
    fontWeight: "600",
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
});
