import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  deletePaySchedule,
  fetchPaySchedule,
  updatePaySchedule,
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
import { DatePickerField } from "@shared/ui/date-picker-field";
import {
  ChoiceChip,
  CurrencyField,
  ErrorState,
  Field,
  PrimaryButton,
  SecondaryButton,
  SectionTitle,
  SurfaceCard,
} from "@shared/ui/primitives";
import { theme } from "@shared/ui/theme";

const frequencyOptions: PayScheduleInput["frequency"][] = [
  "weekly",
  "biweekly",
  "semimonthly",
  "monthly",
  "once",
];

export default function EditPayScheduleScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [initialLoading, setInitialLoading] = useState(true);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] =
    useState<PayScheduleInput["frequency"]>("biweekly");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [monthDay, setMonthDay] = useState("");
  const [secondMonthDay, setSecondMonthDay] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedStartDate = isoDateFromInput(startDate);
  const normalizedEndDate = isoDateFromInput(endDate);
  const derivedWeekday = weekdayFromIsoDate(startDate);
  const derivedMonthDay = monthDayFromIsoDate(startDate);
  const busy = loading || deleting;

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!id) return;

      setInitialLoading(true);

      try {
        const schedule = await fetchPaySchedule(id);
        if (!active) return;

        setName(schedule.name);
        setAmount(schedule.amount);
        setFrequency(schedule.frequency as PayScheduleInput["frequency"]);
        setStartDate(schedule.start_date);
        setEndDate(schedule.end_date ?? "");
        setMonthDay(schedule.month_day ? String(schedule.month_day) : "");
        setSecondMonthDay(
          schedule.frequency === "semimonthly" && schedule.interval_value
            ? String(schedule.interval_value)
            : "",
        );
        setIsActive(schedule.is_active);
        setError(null);
      } catch (nextError) {
        if (!active) return;
        setError(getApiErrorMessage(nextError));
      } finally {
        if (active) setInitialLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [id]);

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
      is_active: isActive,
    };

    if (frequency === "weekly" || frequency === "biweekly") {
      payload.weekday = derivedWeekday;
      payload.interval_value = frequency === "weekly" ? 1 : 2;
    }

    if (frequency === "monthly") {
      payload.month_day = Number(monthDay || derivedMonthDay || 0) || null;
    }

    if (frequency === "semimonthly") {
      payload.month_day = Number(monthDay || derivedMonthDay || 0) || null;
      payload.interval_value = Number(secondMonthDay || 31) || null;
    }

    setLoading(true);
    setError(null);

    try {
      await updatePaySchedule(id, payload);
      router.back();
    } catch (nextError) {
      setError(getApiErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  };

  const performDeletion = async () => {
    if (!id) return;

    setDeleting(true);
    setError(null);

    try {
      await deletePaySchedule(id);
      router.replace("/money?tab=income");
    } catch (nextError) {
      setError(getApiErrorMessage(nextError));
      setDeleting(false);
    }
  };

  const promptDeletion = () => {
    Alert.alert(
      "Delete this income source?",
      "This paycheck income source and its generated future paycheck dates will be permanently removed from your plan. This cannot be undone.",
      [
        {
          style: "cancel",
          text: "Keep income source",
        },
        {
          style: "destructive",
          text: "Delete income source",
          onPress: () => {
            void performDeletion();
          },
        },
      ],
    );
  };

  if (initialLoading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (error && !name && !startDate) {
    return (
      <View style={styles.loadingScreen}>
        <ErrorState
          body={error}
          onRetry={() => {
            router.replace(`/pay-schedules/${id}`);
          }}
          title="Could not load paycheck"
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
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
            subtitle="Changing the first pay date updates the schedule used to generate future paycheck dates."
            title="Edit paycheck"
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
            hint="This is the field to change when you want a different paycheck date."
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

          {frequency === "semimonthly" ? (
            <>
              <Field
                hint={
                  derivedMonthDay
                    ? `Leave matching the first pay date as day ${derivedMonthDay}, or override it.`
                    : "Enter the first calendar day this paycheck repeats on."
                }
                keyboardType="number-pad"
                label="First day of month"
                onChangeText={setMonthDay}
                placeholder={derivedMonthDay ? String(derivedMonthDay) : "15"}
                value={monthDay}
              />
              <Field
                hint="Use 31 for the last available day in shorter months."
                keyboardType="number-pad"
                label="Second day of month"
                onChangeText={setSecondMonthDay}
                placeholder="31"
                value={secondMonthDay}
              />
            </>
          ) : null}

          <DatePickerField
            allowClear
            hint="Optional. Leave empty if this income continues indefinitely."
            label="End date"
            minimumDate={startDate}
            onChange={setEndDate}
            value={endDate}
          />

          <View style={styles.chipWrap}>
            <ChoiceChip
              label="Active"
              onPress={() => {
                setIsActive(true);
              }}
              selected={isActive}
            />
            <ChoiceChip
              label="Paused"
              onPress={() => {
                setIsActive(false);
              }}
              selected={!isActive}
            />
          </View>

          {frequency === "weekly" || frequency === "biweekly" ? (
            <Text style={styles.helperCopy}>
              Weekday is derived from the first pay date so the API accepts the
              schedule without mismatch errors.
            </Text>
          ) : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.actions}>
            <SecondaryButton
              disabled={busy}
              label="Cancel"
              onPress={() => {
                router.back();
              }}
            />
            <PrimaryButton
              disabled={busy}
              icon="content-save-outline"
              label={loading ? "Saving..." : "Save changes"}
              onPress={() => {
                void submit();
              }}
            />
          </View>

          <View style={styles.deleteSection}>
            <Text style={styles.deleteCopy}>
              Delete this income source if it should no longer generate paycheck
              dates in your plan.
            </Text>
            <SecondaryButton
              disabled={busy}
              icon="trash-can-outline"
              label={deleting ? "Deleting..." : "Delete income source"}
              onPress={promptDeletion}
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
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.background,
    padding: theme.spacing.lg,
  },
  content: {
    flexGrow: 1,
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
  deleteSection: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
    paddingTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  deleteCopy: {
    color: theme.colors.danger,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
});
