import { randomUUID } from "expo-crypto";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  fetchDashboard,
  fetchSavingsGoal,
  fetchSavingsContributions,
  recordSavingsContribution,
  undoSavingsContribution,
  type SavingsGoal,
  type SavingsContribution,
} from "@features/planning/api";
import { GoalProgressBlock } from "@features/goals/goal-progress";
import { getApiErrorMessage } from "@shared/lib/api-error";
import {
  formatCurrencyPrecise,
  formatDate,
  parseCurrencyInput,
} from "@shared/lib/format";
import { todayInAppTimezone } from "@shared/lib/timezone";
import { DatePickerField } from "@shared/ui/date-picker-field";
import {
  CurrencyField,
  Field,
  LoadingState,
  ErrorState,
  PrimaryButton,
  SecondaryButton,
  SurfaceCard,
  SectionTitle,
} from "@shared/ui/primitives";
import { theme } from "@shared/ui/theme";

type Planned = NonNullable<SavingsGoal["contributions"]>[number];
export default function SavingsActivityScreen() {
  const { id, add } = useLocalSearchParams<{ id: string; add?: string }>();
  const router = useRouter();
  const [goal, setGoal] = useState<SavingsGoal | null>(null);
  const [history, setHistory] = useState<SavingsContribution[]>([]);
  const [planned, setPlanned] = useState<Planned[]>([]);
  const [form, setForm] = useState<{
    paycheck?: Planned;
    requestId: string;
  } | null>(null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayInAppTimezone());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const autoOpened = useRef(false);
  const openForm = useCallback((paycheck?: Planned) => {
    setAmount(paycheck?.amount ?? "");
    setDate(todayInAppTimezone());
    setNote("");
    setError(null);
    setNotice("");
    setForm({ paycheck, requestId: randomUUID() });
  }, []);
  const load = useCallback(async () => {
    try {
      const [nextGoal, entries, dashboard] = await Promise.all([
        fetchSavingsGoal(id),
        fetchSavingsContributions(id),
        fetchDashboard().catch(() => null),
      ]);
      setGoal(nextGoal);
      setHistory(entries);
      setPlanned(
        dashboard?.savings_goals.find((g) => String(g.id) === id)
          ?.contributions ?? [],
      );
      setError(
        dashboard
          ? null
          : "Payday plans could not load. You can still record extra savings; reopen this screen to retry.",
      );
      if (add && !autoOpened.current) {
        autoOpened.current = true;
        openForm();
      }
    } catch (e) {
      setError(getApiErrorMessage(e));
    }
  }, [id, add, openForm]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  const save = async () => {
    if (!form || locked.current) return;
    const value = parseCurrencyInput(amount, 0.01);
    if (!value || !date || date > todayInAppTimezone()) {
      setError(
        "Enter an amount greater than zero and a date no later than today.",
      );
      return;
    }
    locked.current = true;
    setBusy(true);
    setError(null);
    try {
      const updated = await recordSavingsContribution(id, {
        request_id: form.requestId,
        amount: value,
        saved_on: date,
        note: note.trim() || undefined,
        paycheck_occurrence_id: form.paycheck?.paycheck_occurrence_id,
      });
      setGoal(updated);
      setForm(null);
      setNotice(
        `${formatCurrencyPrecise(value)} recorded. ${updated.is_completed ? "Goal reached!" : `${formatCurrencyPrecise(updated.saved_amount)} saved in total.`}`,
      );
      await load();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };
  const undo = async (entry: SavingsContribution) => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError(null);
    try {
      setGoal(await undoSavingsContribution(id, entry.id));
      setNotice("Savings entry undone.");
      await load();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };
  if (!goal)
    return error ? (
      <ErrorState
        title="Savings unavailable"
        body={error}
        onRetry={() => void load()}
      />
    ) : (
      <LoadingState label="Loading savings" />
    );
  const outstanding = planned.filter(
    (p) =>
      !history.some(
        (h) =>
          String(h.paycheck_occurrence_id) === String(p.paycheck_occurrence_id),
      ),
  );
  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <SurfaceCard>
          <GoalProgressBlock goal={goal} context={{}} />
          <Text style={styles.body}>
            Record money you have set aside. This does not transfer money
            between accounts.
          </Text>
          {!form && (
            <PrimaryButton
              label="Add savings"
              icon="plus"
              disabled={busy}
              onPress={() => openForm()}
            />
          )}
          <SecondaryButton
            label="Edit goal"
            disabled={busy}
            onPress={() => router.push(`/savings-goals/${id}`)}
          />
        </SurfaceCard>
        {!!notice && (
          <Text accessibilityLiveRegion="polite" style={styles.success}>
            {notice}
          </Text>
        )}
        {!!error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}
        {form ? (
          <SurfaceCard>
            <SectionTitle
              title={
                form.paycheck ? "Mark payday savings as saved" : "Add savings"
              }
              subtitle={
                form.paycheck
                  ? `From your ${formatDate(form.paycheck.occurrence_date)} paycheck. Adjust the amount if needed.`
                  : "Extra money you have already saved toward this goal."
              }
            />
            <CurrencyField
              label="Amount saved"
              value={amount}
              onChangeText={setAmount}
              placeholder="$0.00"
            />
            <DatePickerField
              label="Date saved"
              maximumDate={todayInAppTimezone()}
              value={date}
              onChange={setDate}
            />
            <Field
              label="Note (optional)"
              value={note}
              onChangeText={setNote}
              maxLength={255}
              placeholder="Gift, bonus, or a little extra"
            />
            <PrimaryButton
              label={busy ? "Recording…" : "Record savings"}
              disabled={busy}
              onPress={() => void save()}
            />
            <SecondaryButton
              label="Cancel"
              disabled={busy}
              onPress={() => {
                setForm(null);
                setError(null);
              }}
            />
          </SurfaceCard>
        ) : (
          <SurfaceCard>
            <SectionTitle
              title="Payday savings"
              subtitle="Planned amounts count toward your goal only after you mark them saved."
            />
            {outstanding.slice(0, 6).map((p) => (
              <View key={String(p.paycheck_occurrence_id)} style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.label}>
                    {formatCurrencyPrecise(p.amount)}
                  </Text>
                  <Text style={styles.body}>
                    {formatDate(p.occurrence_date)} paycheck · Planned
                  </Text>
                </View>
                <SecondaryButton
                  label="Mark saved"
                  disabled={busy}
                  onPress={() => openForm(p)}
                />
              </View>
            ))}
            {!outstanding.length && (
              <Text style={styles.body}>
                {goal.is_completed
                  ? "You have reached your goal."
                  : "No payday savings planned in this window. You can still add savings above."}
              </Text>
            )}
          </SurfaceCard>
        )}
        <SurfaceCard>
          <SectionTitle
            title="Savings history"
            subtitle="Recorded contributions, most recent first."
          />
          {!history.length && (
            <Text style={styles.body}>
              Your first contribution will appear here. Any starting balance is
              already included in your total.
            </Text>
          )}
          {history.map((entry) => (
            <View key={entry.id} style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.label}>
                  +{formatCurrencyPrecise(entry.amount)}
                </Text>
                <Text style={styles.body}>
                  {formatDate(entry.saved_on.slice(0, 10))} ·{" "}
                  {entry.paycheck_occurrence_id
                    ? "Payday savings"
                    : "Extra savings"}
                </Text>
                {!!entry.note && <Text style={styles.body}>{entry.note}</Text>}
              </View>
              <SecondaryButton
                label="Undo"
                disabled={busy}
                onPress={() =>
                  Alert.alert(
                    "Undo savings entry?",
                    `${formatCurrencyPrecise(entry.amount)} will be removed from your recorded total. No money will be moved.`,
                    [
                      { text: "Keep entry", style: "cancel" },
                      {
                        text: "Undo entry",
                        style: "destructive",
                        onPress: () => void undo(entry),
                      },
                    ],
                  )
                }
              />
            </View>
          ))}
        </SurfaceCard>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: {
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    paddingBottom: 72,
  },
  body: { color: theme.colors.muted, fontSize: 15, lineHeight: 22 },
  label: { color: theme.colors.ink, fontSize: 18, fontWeight: "700" },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  rowText: { flex: 1, minWidth: 160, gap: 4 },
  error: { color: theme.colors.danger, fontSize: 15 },
  success: {
    color: theme.colors.primaryStrong,
    fontSize: 16,
    fontWeight: "600",
  },
});
