import { useMemo, useState, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import {
  frequencyChipLabel,
  recurrencePatternSentence,
  shortMonthNote,
} from "@features/money/labels";
import { MoreOptions } from "@features/money/more-options";
import { SchedulePreviewCard } from "@features/money/schedule-preview-card";
import {
  type PaySchedule,
  type PayScheduleInput,
} from "@features/planning/api";
import {
  isoDateFromInput,
  monthDayFromIsoDate,
  parseCurrencyInput,
  weekdayFromIsoDate,
} from "@shared/lib/format";
import { firstOccurrenceOf, nextOccurrences } from "@shared/lib/recurrence";
import { todayInAppTimezone } from "@shared/lib/timezone";
import {
  ChoiceChip,
  CurrencyField,
  Field,
  PrimaryButton,
  SecondaryButton,
} from "@shared/ui/primitives";
import { DatePickerField } from "@shared/ui/date-picker-field";
import { theme } from "@shared/ui/theme";

const FREQUENCIES: PayScheduleInput["frequency"][] = [
  "biweekly",
  "semimonthly",
  "weekly",
  "monthly",
  "once",
];

/**
 * The backend stores the second semimonthly pay day in `interval_value`, where
 * 31 means "the last day of the month" — see `StorePayScheduleRequest::payload`.
 * Offering the common choices as chips avoids asking for a raw number.
 */
const SECOND_DAY_CHOICES = [15, 20, 25, 28, 31];

function secondDayLabel(day: number) {
  return day >= 31 ? "Last day" : `${day}th`;
}

type FieldErrors = {
  name?: string;
  amount?: string;
  startDate?: string;
  endDate?: string;
  secondMonthDay?: string;
};

export type PayScheduleFormProps = {
  schedule?: PaySchedule | null;
  submitLabel: string;
  submitting: boolean;
  onSubmit: (payload: PayScheduleInput) => void;
  onCancel: () => void;
  footer?: ReactNode;
};

export function PayScheduleForm({
  schedule,
  submitLabel,
  submitting,
  onSubmit,
  onCancel,
  footer,
}: PayScheduleFormProps) {
  const today = todayInAppTimezone();
  const [name, setName] = useState(schedule?.name ?? "");
  const [amount, setAmount] = useState(schedule?.amount ?? "");
  const [frequency, setFrequency] = useState<PayScheduleInput["frequency"]>(
    (schedule?.frequency as PayScheduleInput["frequency"]) ?? "biweekly",
  );
  /** See `bill-form` — `start_date` is when the series began, not when it lands. */
  const seededStartDate = useMemo(() => {
    if (!schedule) return "";

    return (
      firstOccurrenceOf({
        frequency: schedule.frequency as PayScheduleInput["frequency"],
        startDate: schedule.start_date,
        endDate: schedule.end_date,
        monthDay: schedule.month_day,
        weekday: schedule.weekday,
        secondMonthDay:
          schedule.frequency === "semimonthly" ? schedule.interval_value : null,
      }) ?? schedule.start_date
    );
  }, [schedule]);

  const [startDate, setStartDate] = useState(seededStartDate);
  const [endDate, setEndDate] = useState(schedule?.end_date ?? "");
  const [secondMonthDay, setSecondMonthDay] = useState<number>(
    schedule?.frequency === "semimonthly" && schedule.interval_value
      ? schedule.interval_value
      : 31,
  );
  const [isActive, setIsActive] = useState(schedule?.is_active ?? true);
  const [errors, setErrors] = useState<FieldErrors>({});

  const normalizedStartDate = isoDateFromInput(startDate);
  const normalizedEndDate = isoDateFromInput(endDate);
  const firstMonthDay = normalizedStartDate
    ? monthDayFromIsoDate(normalizedStartDate)
    : null;
  const secondDayClashes =
    frequency === "semimonthly" && firstMonthDay === secondMonthDay;

  /** See `bill-form` — the stored month_day / weekday stay authoritative until touched. */
  const scheduleUnchanged =
    Boolean(schedule) &&
    frequency === schedule!.frequency &&
    normalizedStartDate === seededStartDate;

  const dates = useMemo(
    () =>
      normalizedStartDate
        ? nextOccurrences(
            {
              frequency,
              startDate: normalizedStartDate,
              endDate: normalizedEndDate,
              monthDay: scheduleUnchanged ? schedule!.month_day : null,
              weekday: scheduleUnchanged ? schedule!.weekday : null,
              secondMonthDay,
              // See `bill-form` — show the pay dates still ahead, not old ones.
              notBefore: today,
            },
            3,
          )
        : [],
    [
      frequency,
      normalizedEndDate,
      normalizedStartDate,
      schedule,
      scheduleUnchanged,
      secondMonthDay,
      today,
    ],
  );

  const submit = () => {
    const normalizedAmount = parseCurrencyInput(amount);
    const nextErrors: FieldErrors = {};

    if (!name.trim()) nextErrors.name = "Give this income a name.";
    if (!normalizedAmount) nextErrors.amount = "Enter how much you take home.";
    if (!normalizedStartDate) nextErrors.startDate = "Pick the first pay date.";
    if (
      frequency !== "once" &&
      normalizedStartDate &&
      normalizedEndDate &&
      normalizedEndDate < normalizedStartDate
    ) {
      nextErrors.endDate =
        "The end date must be on or after the first pay date.";
    }
    if (secondDayClashes) {
      nextErrors.secondMonthDay =
        "Pick a different day from your first pay day.";
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0 || !normalizedAmount) return;

    const payload: PayScheduleInput = {
      name: name.trim(),
      amount: normalizedAmount,
      frequency,
      start_date: scheduleUnchanged
        ? schedule!.start_date
        : normalizedStartDate!,
      end_date: normalizedEndDate,
      is_active: isActive,
    };

    const storedMonthDay = scheduleUnchanged ? schedule!.month_day : null;

    if (frequency === "weekly" || frequency === "biweekly") {
      payload.weekday =
        (scheduleUnchanged ? schedule!.weekday : null) ??
        weekdayFromIsoDate(normalizedStartDate!);
      payload.interval_value = frequency === "weekly" ? 1 : 2;
    }

    // Derived from the first pay date, so nothing can contradict it.
    if (frequency === "monthly") {
      payload.month_day =
        storedMonthDay ?? Number(normalizedStartDate!.slice(8, 10));
    }

    if (frequency === "semimonthly") {
      payload.month_day =
        storedMonthDay ?? Number(normalizedStartDate!.slice(8, 10));
      payload.interval_value = secondMonthDay;
    }

    onSubmit(payload);
  };

  return (
    <View style={styles.wrap}>
      <Field
        autoCapitalize="words"
        error={errors.name}
        label="Name"
        onChangeText={(value) => {
          setName(value);
          setErrors((current) => ({ ...current, name: undefined }));
        }}
        placeholder="Main paycheck"
        value={name}
      />

      <CurrencyField
        error={errors.amount}
        hint="What actually hits your account, after tax."
        label="Amount"
        onChangeText={(value) => {
          setAmount(value);
          setErrors((current) => ({ ...current, amount: undefined }));
        }}
        placeholder="$2,400.00"
        value={amount}
      />

      <View style={styles.fieldGroup}>
        <Text style={styles.groupLabel}>How often</Text>
        <View style={styles.chipWrap}>
          {FREQUENCIES.map((option) => (
            <ChoiceChip
              key={option}
              label={frequencyChipLabel(option)}
              onPress={() => {
                setFrequency(option);
              }}
              selected={frequency === option}
            />
          ))}
        </View>
      </View>

      <DatePickerField
        error={errors.startDate}
        label={frequency === "once" ? "Pay date" : "First pay date"}
        onChange={(value) => {
          setStartDate(value);
          setErrors((current) => ({ ...current, startDate: undefined }));
        }}
        value={startDate}
      />

      {frequency === "semimonthly" ? (
        <View style={styles.fieldGroup}>
          <Text style={styles.groupLabel}>Also paid on</Text>
          <View style={styles.chipWrap}>
            {SECOND_DAY_CHOICES.map((day) => (
              <ChoiceChip
                key={day}
                label={secondDayLabel(day)}
                onPress={() => {
                  setSecondMonthDay(day);
                  setErrors((current) => ({
                    ...current,
                    secondMonthDay: undefined,
                  }));
                }}
                selected={secondMonthDay === day}
              />
            ))}
          </View>
          {errors.secondMonthDay || secondDayClashes ? (
            <Text style={styles.errorText}>
              {errors.secondMonthDay ??
                "Pick a different day from your first pay day."}
            </Text>
          ) : (
            <Text style={styles.hintText}>
              Your first pay date sets the other day of the month.
            </Text>
          )}
        </View>
      ) : null}

      <SchedulePreviewCard
        amount={Number(parseCurrencyInput(amount) ?? 0)}
        dates={dates}
        emptyHint="Pick a pay date to see when this arrives."
        name={name}
        namePlaceholder="Your paycheck"
        note={
          normalizedStartDate
            ? shortMonthNote(frequency, normalizedStartDate)
            : null
        }
        pattern={
          normalizedStartDate && !secondDayClashes
            ? recurrencePatternSentence(frequency, normalizedStartDate, {
                verb: "Paid",
                secondMonthDay,
              })
            : null
        }
      />

      <MoreOptions defaultExpanded={Boolean(schedule?.end_date)}>
        <DatePickerField
          allowClear
          error={errors.endDate}
          hint="Leave empty if this income keeps going."
          label="Stop after"
          minimumDate={startDate}
          onChange={(value) => {
            setEndDate(value);
            setErrors((current) => ({ ...current, endDate: undefined }));
          }}
          value={endDate}
        />

        {schedule ? (
          <View style={styles.fieldGroup}>
            <Text style={styles.groupLabel}>Status</Text>
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
            <Text style={styles.hintText}>
              Paused income stops generating new pay dates.
            </Text>
          </View>
        ) : null}
      </MoreOptions>

      <View style={styles.actions}>
        <SecondaryButton label="Cancel" onPress={onCancel} />
        <PrimaryButton
          disabled={submitting}
          icon="content-save-outline"
          label={submitting ? "Saving…" : submitLabel}
          onPress={submit}
        />
      </View>

      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: theme.spacing.lg,
  },
  fieldGroup: {
    gap: theme.spacing.sm,
  },
  groupLabel: {
    color: theme.colors.ink,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  hintText: {
    color: theme.colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
});
