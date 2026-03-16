import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  fetchBill,
  fetchBillCategories,
  updateBill,
  type BillCategory,
  type BillInput,
} from "@features/planning/api";
import { useBillReminders } from "@features/notifications/bill-reminder-context";
import { getApiErrorMessage } from "@shared/lib/api-error";
import {
  parseCurrencyInput,
  formatCurrency,
  formatFrequency,
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

const frequencyOptions: BillInput["frequency"][] = [
  "weekly",
  "biweekly",
  "monthly",
  "once",
];

export default function EditBillScreen() {
  const router = useRouter();
  const billReminders = useBillReminders();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [categories, setCategories] = useState<BillCategory[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<BillInput["frequency"]>("monthly");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subscriptionMode, setSubscriptionMode] = useState<
    "bill" | "subscription"
  >("bill");
  const [isActive, setIsActive] = useState(true);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedStartDate = isoDateFromInput(startDate);
  const normalizedEndDate = isoDateFromInput(endDate);
  const derivedMonthDay = monthDayFromIsoDate(startDate);
  const derivedWeekday = weekdayFromIsoDate(startDate);

  const load = useCallback(async () => {
    if (!id) return;

    setInitialLoading(true);

    try {
      const [bill, nextCategories] = await Promise.all([
        fetchBill(id),
        fetchBillCategories(),
      ]);

      setCategories(nextCategories);
      setName(bill.name);
      setAmount(bill.amount);
      setFrequency(bill.frequency as BillInput["frequency"]);
      setStartDate(bill.start_date);
      setEndDate(bill.end_date ?? "");
      setDueDay(bill.due_day ? String(bill.due_day) : "");
      setCategoryId(bill.bill_category_id ? String(bill.bill_category_id) : "");
      setSubscriptionMode(bill.is_subscription ? "subscription" : "bill");
      setIsActive(bill.is_active);
      setNotes(bill.notes ?? "");
      setError(null);
    } catch (nextError) {
      setError(getApiErrorMessage(nextError));
    } finally {
      setInitialLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const submit = async () => {
    const normalizedAmount = parseCurrencyInput(amount);

    if (!name.trim()) {
      setError("Enter a bill name.");
      return;
    }

    if (!normalizedAmount) {
      setError("Enter a valid bill amount.");
      return;
    }

    if (!normalizedStartDate) {
      setError("Select the first due date.");
      return;
    }

    if (normalizedEndDate && normalizedEndDate < normalizedStartDate) {
      setError("The end date must be on or after the first due date.");
      return;
    }

    const payload: BillInput = {
      name: name.trim(),
      amount: normalizedAmount,
      frequency,
      start_date: normalizedStartDate,
      end_date: normalizedEndDate,
      bill_category_id: categoryId ? Number(categoryId) : null,
      is_subscription: subscriptionMode === "subscription",
      is_active: isActive,
      notes: notes.trim() || null,
    };

    if (frequency === "weekly" || frequency === "biweekly") {
      payload.weekday = derivedWeekday;
      payload.interval_value = frequency === "weekly" ? 1 : 2;
    }

    if (frequency === "monthly") {
      payload.due_day = Number(dueDay || derivedMonthDay || 0) || null;
    }

    setLoading(true);
    setError(null);

    try {
      await updateBill(id, payload);
      await billReminders.refreshReminders();
      router.back();
    } catch (nextError) {
      setError(getApiErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
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
            void load();
          }}
          title="Could not load bill"
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.screen}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <SurfaceCard tone="warning">
          <SectionTitle
            subtitle="Change the first due date, category, or recurring pattern here."
            title="Edit bill"
          />
          <Text style={styles.previewValue}>
            {formatCurrency(parseCurrencyInput(amount) ?? 0)}
          </Text>
          <Text style={styles.previewBody}>
            {name.trim() || "Your bill"} as a{" "}
            {subscriptionMode === "subscription"
              ? "subscription"
              : "standard bill"}
            , {formatFrequency(frequency).toLowerCase()}.
          </Text>
        </SurfaceCard>

        <SurfaceCard>
          <Field
            autoCapitalize="words"
            label="Name"
            onChangeText={setName}
            placeholder="Rent"
            value={name}
          />
          <CurrencyField
            label="Amount"
            onChangeText={setAmount}
            placeholder="$1,200.00"
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
            hint="This is the field to change when you want a different due date pattern."
            label="First due date"
            onChange={setStartDate}
            value={startDate}
          />

          {frequency === "monthly" ? (
            <Field
              hint={
                derivedMonthDay
                  ? `Defaults to day ${derivedMonthDay} based on the first due date.`
                  : "Enter the calendar day this bill repeats on."
              }
              keyboardType="number-pad"
              label="Due day of month"
              onChangeText={setDueDay}
              placeholder={derivedMonthDay ? String(derivedMonthDay) : "1"}
              value={dueDay}
            />
          ) : null}

          <DatePickerField
            allowClear
            hint="Optional. Leave empty for ongoing recurring bills."
            label="End date"
            minimumDate={startDate}
            onChange={setEndDate}
            value={endDate}
          />

          <View style={styles.chipWrap}>
            <ChoiceChip
              label="Standard bill"
              onPress={() => {
                setSubscriptionMode("bill");
              }}
              selected={subscriptionMode === "bill"}
            />
            <ChoiceChip
              label="Subscription"
              onPress={() => {
                setSubscriptionMode("subscription");
              }}
              selected={subscriptionMode === "subscription"}
            />
          </View>

          {categories.length ? (
            <View style={styles.categorySection}>
              <Text style={styles.sectionLabel}>Category</Text>
              <View style={styles.chipWrap}>
                <ChoiceChip
                  label="No category"
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

          <Field
            label="Notes"
            multiline
            onChangeText={setNotes}
            placeholder="Optional context for this bill"
            style={styles.notesInput}
            value={notes}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.actions}>
            <SecondaryButton
              disabled={loading}
              label="Cancel"
              onPress={() => {
                router.back();
              }}
            />
            <PrimaryButton
              disabled={loading}
              icon="content-save-outline"
              label={loading ? "Saving..." : "Save changes"}
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
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.background,
    padding: theme.spacing.lg,
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
  categorySection: {
    gap: theme.spacing.sm,
  },
  sectionLabel: {
    color: theme.colors.ink,
    fontSize: 13,
    fontWeight: "700",
  },
  notesInput: {
    minHeight: 96,
    textAlignVertical: "top",
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
