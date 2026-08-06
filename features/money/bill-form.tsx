import { useMemo, useState, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useAuth } from "@features/auth/auth-context";
import { coverageForDueDate } from "@features/money/coverage";
import {
  frequencyChipLabel,
  recurrencePatternSentence,
  shortMonthNote,
} from "@features/money/labels";
import { MoreOptions } from "@features/money/more-options";
import { SchedulePreviewCard } from "@features/money/schedule-preview-card";
import {
  type Bill,
  type BillCategory,
  type BillInput,
} from "@features/planning/api";
import { useForecastWindowQuery } from "@features/planning/queries";
import { currentForecastWindow } from "@features/planning/window";
import { usePlanningRevision } from "@shared/api/planning-revision";
import {
  formatDate,
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

const FREQUENCIES: BillInput["frequency"][] = [
  "monthly",
  "weekly",
  "biweekly",
  "yearly",
  "once",
];

type FieldErrors = {
  name?: string;
  amount?: string;
  startDate?: string;
  endDate?: string;
};

export type BillFormProps = {
  bill?: Bill | null;
  categories: BillCategory[];
  submitLabel: string;
  submitting: boolean;
  onSubmit: (payload: BillInput) => void;
  onCancel: () => void;
  footer?: ReactNode;
};

export function BillForm({
  bill,
  categories,
  submitLabel,
  submitting,
  onSubmit,
  onCancel,
  footer,
}: BillFormProps) {
  const { user } = useAuth();
  const today = todayInAppTimezone();
  const planningRevision = usePlanningRevision();
  const forecastWindow = useMemo(() => currentForecastWindow(), []);

  const [name, setName] = useState(bill?.name ?? "");
  const [amount, setAmount] = useState(bill?.amount ?? "");
  const [frequency, setFrequency] = useState<BillInput["frequency"]>(
    (bill?.frequency as BillInput["frequency"]) ?? "monthly",
  );
  /**
   * A stored bill's `start_date` is when the series began, not when it is due —
   * `due_day` / `weekday` decide that. Show the date the rule really lands on,
   * so the form describes the bill truthfully and saving it back is a no-op.
   */
  const seededStartDate = useMemo(() => {
    if (!bill) return "";

    return (
      firstOccurrenceOf({
        frequency: bill.frequency as BillInput["frequency"],
        startDate: bill.start_date,
        endDate: bill.end_date,
        monthDay: bill.due_day,
        weekday: bill.weekday,
      }) ?? bill.start_date
    );
  }, [bill]);

  const [startDate, setStartDate] = useState(seededStartDate);
  const [endDate, setEndDate] = useState(bill?.end_date ?? "");
  const [categoryId, setCategoryId] = useState(
    bill?.bill_category_id ? String(bill.bill_category_id) : "",
  );
  const [notes, setNotes] = useState(bill?.notes ?? "");
  const [isActive, setIsActive] = useState(bill?.is_active ?? true);
  const [errors, setErrors] = useState<FieldErrors>({});

  const clearError = (key: keyof FieldErrors) => {
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const normalizedStartDate = isoDateFromInput(startDate);
  const normalizedEndDate = isoDateFromInput(endDate);

  /**
   * True while the stored schedule is still exactly as loaded. The original
   * `due_day` / `weekday` then remain authoritative — re-deriving them from the
   * displayed date would round a clamped day and move the bill.
   */
  const scheduleUnchanged =
    bill != null &&
    frequency === bill.frequency &&
    normalizedStartDate === seededStartDate;
  const storedDueDay = scheduleUnchanged ? bill.due_day : null;
  const storedWeekday = scheduleUnchanged ? bill.weekday : null;

  const dates = useMemo(
    () =>
      normalizedStartDate
        ? nextOccurrences(
            {
              frequency,
              startDate: normalizedStartDate,
              endDate: normalizedEndDate,
              monthDay: storedDueDay,
              weekday: storedWeekday,
              // An existing bill's series may have begun long ago; show what is
              // still ahead, since that is what coverage is judged against.
              notBefore: today,
            },
            3,
          )
        : [],
    [
      frequency,
      normalizedEndDate,
      normalizedStartDate,
      storedDueDay,
      storedWeekday,
      today,
    ],
  );

  /**
   * The forecast is a large payload for one sentence, so it is not requested
   * until there is a date to judge coverage against — opening the form and
   * backing out costs nothing. The window matches the Calendar tab's, so the
   * response is usually already cached.
   */
  const forecastQuery = useForecastWindowQuery(
    { revision: planningRevision, userId: user?.id },
    forecastWindow,
    { enabled: dates.length > 0 },
  );

  const coverage = useMemo(() => {
    const firstDate = dates[0];

    if (!firstDate || !forecastQuery.data) return null;

    return coverageForDueDate(firstDate, forecastQuery.data.paychecks);
  }, [dates, forecastQuery.data]);

  const submit = () => {
    const normalizedAmount = parseCurrencyInput(amount);
    const nextErrors: FieldErrors = {};

    if (!name.trim()) nextErrors.name = "Give this bill a name.";
    if (!normalizedAmount) nextErrors.amount = "Enter how much it costs.";
    if (!normalizedStartDate) nextErrors.startDate = "Pick the first due date.";
    if (
      normalizedStartDate &&
      normalizedEndDate &&
      normalizedEndDate < normalizedStartDate
    ) {
      nextErrors.endDate =
        "The end date must be on or after the first due date.";
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0 || !normalizedAmount) return;

    const payload: BillInput = {
      name: name.trim(),
      amount: normalizedAmount,
      frequency,
      start_date:
        scheduleUnchanged && bill ? bill.start_date : normalizedStartDate!,
      end_date: normalizedEndDate,
      bill_category_id: categoryId ? Number(categoryId) : null,
      // No longer offered in the UI; carried through so saving never flips it.
      is_subscription: bill?.is_subscription ?? false,
      is_active: isActive,
      notes: notes.trim() || null,
    };

    if (frequency === "weekly" || frequency === "biweekly") {
      payload.weekday =
        storedWeekday ?? weekdayFromIsoDate(normalizedStartDate!);
      payload.interval_value = frequency === "weekly" ? 1 : 2;
    }

    // Derived from the first due date, so the two can never contradict.
    if (frequency === "monthly") {
      payload.due_day =
        storedDueDay ?? monthDayFromIsoDate(normalizedStartDate!);
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
          clearError("name");
        }}
        placeholder="Rent"
        value={name}
      />

      <CurrencyField
        error={errors.amount}
        label="Amount"
        onChangeText={(value) => {
          setAmount(value);
          clearError("amount");
        }}
        placeholder="$1,200.00"
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
        label={frequency === "once" ? "Due date" : "First due date"}
        onChange={(value) => {
          setStartDate(value);
          clearError("startDate");
        }}
        value={startDate}
      />

      <SchedulePreviewCard
        amount={Number(parseCurrencyInput(amount) ?? 0)}
        coverage={coverage}
        coverageLabels={{
          covered: (date) => `Covered by your ${formatDate(date)} paycheck`,
          beforeFirst: (date) =>
            `Due before your first paycheck on ${formatDate(date)}`,
          noIncome: "Add your income to see which paycheck covers this",
        }}
        dates={dates}
        emptyHint="Pick a due date to see when this lands."
        name={name}
        namePlaceholder="Your bill"
        note={
          normalizedStartDate
            ? shortMonthNote(frequency, normalizedStartDate)
            : null
        }
        pattern={
          normalizedStartDate
            ? recurrencePatternSentence(frequency, normalizedStartDate)
            : null
        }
      />

      <MoreOptions
        defaultExpanded={Boolean(
          bill && (bill.end_date || bill.bill_category_id || bill.notes),
        )}
      >
        <DatePickerField
          allowClear
          error={errors.endDate}
          hint="Leave empty if this bill keeps going."
          label="Stop after"
          minimumDate={startDate}
          onChange={(value) => {
            setEndDate(value);
            clearError("endDate");
          }}
          value={endDate}
        />

        {categories.length ? (
          <View style={styles.fieldGroup}>
            <Text style={styles.groupLabel}>Category</Text>
            <View style={styles.chipWrap}>
              <ChoiceChip
                label="None"
                onPress={() => {
                  setCategoryId("");
                }}
                selected={!categoryId}
              />
              {categories.map((category) => (
                <ChoiceChip
                  key={String(category.id)}
                  label={category.name}
                  onPress={() => {
                    setCategoryId(String(category.id));
                  }}
                  selected={categoryId === String(category.id)}
                />
              ))}
            </View>
          </View>
        ) : null}

        <Field
          label="Notes"
          multiline
          onChangeText={setNotes}
          placeholder="Anything worth remembering about this bill"
          style={styles.notesInput}
          value={notes}
        />

        {bill ? (
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
              Paused bills stop generating new due dates.
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
  notesInput: {
    minHeight: 96,
    textAlignVertical: "top",
  },
  hintText: {
    color: theme.colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
});
