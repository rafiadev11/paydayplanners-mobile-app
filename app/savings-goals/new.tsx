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
  createSavingsGoal,
  type SavingsGoalInput,
} from "@features/planning/api";
import { getApiErrorMessage } from "@shared/lib/api-error";
import {
  formatCurrency,
  isoDateFromInput,
  parseCurrencyInput,
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

export default function NewSavingsGoalScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [savedAmount, setSavedAmount] = useState("");
  const [contributionAmount, setContributionAmount] = useState("");
  const [startDate, setStartDate] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [priority, setPriority] =
    useState<NonNullable<SavingsGoalInput["priority"]>>(5);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const normalizedTargetAmount = parseCurrencyInput(targetAmount, 0.01);
    const normalizedSavedAmount = parseCurrencyInput(savedAmount || "0", 0);
    const normalizedContributionAmount = parseCurrencyInput(
      contributionAmount,
      0.01,
    );
    const normalizedStartDate = isoDateFromInput(startDate);
    const normalizedTargetDate = isoDateFromInput(targetDate);

    if (!name.trim()) {
      setError("Enter a name for the goal.");
      return;
    }

    if (!normalizedTargetAmount) {
      setError("Enter a valid target amount greater than zero.");
      return;
    }

    if (!normalizedStartDate) {
      setError("Select a start date.");
      return;
    }

    if (normalizedTargetDate && normalizedTargetDate < normalizedStartDate) {
      setError("The target date must be on or after the start date.");
      return;
    }

    if (contributionAmount && !normalizedContributionAmount) {
      setError("Enter a valid per-paycheck contribution or leave it empty.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await createSavingsGoal({
        name: name.trim(),
        target_amount: normalizedTargetAmount,
        saved_amount: normalizedSavedAmount ?? "0.00",
        contribution_amount: normalizedTargetDate
          ? null
          : (normalizedContributionAmount ?? null),
        start_date: normalizedStartDate,
        target_date: normalizedTargetDate ?? null,
        priority,
        is_active: true,
        notes: notes.trim() || null,
      });
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
        showsVerticalScrollIndicator={false}
      >
        <SurfaceCard tone="accent">
          <SectionTitle
            subtitle="Savings goals are scheduled into future paychecks just like bills."
            title="Goal preview"
          />
          <Text style={styles.previewValue}>
            {formatCurrency(parseCurrencyInput(targetAmount, 0.01) ?? 0)}
          </Text>
          <Text style={styles.previewBody}>
            {name.trim() || "Your goal"} with priority {priority}.
          </Text>
        </SurfaceCard>

        <SurfaceCard>
          <Field
            autoCapitalize="words"
            label="Name"
            onChangeText={setName}
            placeholder="Emergency fund"
            value={name}
          />
          <CurrencyField
            label="Target amount"
            onChangeText={setTargetAmount}
            placeholder="$2,000.00"
            value={targetAmount}
          />
          <CurrencyField
            label="Already saved"
            onChangeText={setSavedAmount}
            placeholder="$0.00"
            value={savedAmount}
          />
          <DatePickerField
            label="Start date"
            onChange={setStartDate}
            value={startDate}
          />
          <DatePickerField
            allowClear
            hint="Optional. Leave empty to keep this goal open until it is fully funded."
            label="Target date"
            minimumDate={startDate}
            onChange={setTargetDate}
            value={targetDate}
          />
          {!targetDate ? (
            <CurrencyField
              hint="Optional. For open-ended goals, set how much to reserve from each paycheck."
              label="Per paycheck contribution"
              onChangeText={setContributionAmount}
              placeholder="$200.00"
              value={contributionAmount}
            />
          ) : null}

          <View style={styles.prioritySection}>
            <Text style={styles.sectionLabel}>Priority</Text>
            <View style={styles.chipWrap}>
              {[1, 3, 5, 8, 10].map((value) => (
                <ChoiceChip
                  key={value}
                  label={`P${value}`}
                  onPress={() => {
                    setPriority(value);
                  }}
                  selected={priority === value}
                />
              ))}
            </View>
            <Text style={styles.helperCopy}>
              P1 is highest priority. Higher-priority goals are planned before
              lower-priority goals.
            </Text>
          </View>

          <Field
            label="Notes"
            multiline
            onChangeText={setNotes}
            placeholder="Optional context for this goal"
            style={styles.notesInput}
            value={notes}
          />

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
              label={loading ? "Saving..." : "Save goal"}
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
  prioritySection: {
    gap: theme.spacing.sm,
  },
  sectionLabel: {
    color: theme.colors.ink,
    fontSize: 13,
    fontWeight: "700",
  },
  helperCopy: {
    color: theme.colors.muted,
    ...theme.typography.body,
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
