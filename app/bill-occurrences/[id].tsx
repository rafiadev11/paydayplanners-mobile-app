import { MaterialCommunityIcons } from "@expo/vector-icons";
import axios from "axios";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useAuth } from "@features/auth/auth-context";
import { useBillReminders } from "@features/notifications/bill-reminder-context";
import {
  billOccurrenceAdjustmentSignature,
  billOccurrenceDraftHasChanges,
  billOccurrenceDraftIsAdjusted,
  type BillOccurrenceAdjustmentDraft,
  type BillOccurrenceAdjustmentErrors,
  validateBillOccurrenceAdjustment,
} from "@features/planning/bill-occurrence-adjustment";
import {
  fetchBillOccurrence,
  previewBillOccurrenceAdjustment,
  updateBillOccurrence,
  type BillOccurrence,
  type BillOccurrenceAdjustmentPreview,
  type BillOccurrenceStatus,
} from "@features/planning/api";
import { usePlanningRevision } from "@shared/api/planning-revision";
import { getApiErrorMessage } from "@shared/lib/api-error";
import {
  formatCurrency,
  formatCurrencyPrecise,
  formatWeekdayDate,
  parseCurrencyInput,
} from "@shared/lib/format";
import { addDaysToIsoDate, todayInAppTimezone } from "@shared/lib/timezone";
import { DatePickerField } from "@shared/ui/date-picker-field";
import {
  ChoiceChip,
  CurrencyField,
  ErrorState,
  PrimaryButton,
  SecondaryButton,
  StatusBadge,
  SurfaceCard,
} from "@shared/ui/primitives";
import { theme } from "@shared/ui/theme";

type ApiErrorEnvelope = {
  errors?: Record<string, string[]>;
};

function normalizedStatus(value: string): BillOccurrenceStatus {
  if (
    value === "paid" ||
    value === "skipped" ||
    value === "overdue" ||
    value === "projected"
  ) {
    return value;
  }

  return "projected";
}

function fieldErrors(error: unknown): BillOccurrenceAdjustmentErrors {
  if (!axios.isAxiosError<ApiErrorEnvelope>(error)) return {};

  const errors = error.response?.data?.errors;

  return {
    amount: errors?.amount?.[0],
    dueDate: errors?.due_date?.[0],
  };
}

function PaycheckImpact({
  preview,
  loading,
  error,
}: {
  preview: BillOccurrenceAdjustmentPreview | null;
  loading: boolean;
  error: string | null;
}) {
  if (!preview && loading) {
    return (
      <SurfaceCard style={styles.impactCard}>
        <View style={styles.inlineRow}>
          <ActivityIndicator color={theme.colors.primary} size="small" />
          <Text style={styles.impactBody}>Updating the paycheck impact…</Text>
        </View>
      </SurfaceCard>
    );
  }

  if (error) {
    return (
      <SurfaceCard style={styles.impactCard} tone="warning">
        <View style={styles.impactHeading}>
          <MaterialCommunityIcons
            color={theme.colors.warning}
            name="alert-circle-outline"
            size={21}
          />
          <Text style={styles.impactTitle}>Impact unavailable</Text>
        </View>
        <Text style={styles.impactBody}>{error}</Text>
      </SurfaceCard>
    );
  }

  if (!preview) return null;

  const beforeDate = preview.before_paycheck?.occurrence_date;
  const afterDate = preview.after_paycheck?.occurrence_date;
  const moved = beforeDate && afterDate && beforeDate !== afterDate;
  const unfunded = Number(preview.proposed.unfunded_amount) > 0;

  return (
    <SurfaceCard
      style={styles.impactCard}
      tone={unfunded ? "warning" : "accent"}
    >
      <View style={styles.impactHeading}>
        <MaterialCommunityIcons
          color={unfunded ? theme.colors.warning : theme.colors.primaryStrong}
          name={unfunded ? "alert-outline" : "chart-timeline-variant"}
          size={22}
        />
        <Text style={styles.impactTitle}>Paycheck impact</Text>
        {loading ? (
          <ActivityIndicator color={theme.colors.primary} size="small" />
        ) : null}
      </View>

      {preview.proposed.status === "skipped" ? (
        <Text style={styles.impactBody}>
          This payment will be left out of your paycheck totals until you
          restore it.
        </Text>
      ) : unfunded ? (
        <Text style={styles.impactBody}>
          {`${formatCurrency(preview.proposed.unfunded_amount)} will not be covered by a paycheck on this date.`}
        </Text>
      ) : moved ? (
        <Text style={styles.impactBody}>
          {`Moves from your ${formatWeekdayDate(beforeDate)} paycheck to your ${formatWeekdayDate(afterDate)} paycheck.`}
        </Text>
      ) : afterDate ? (
        <Text style={styles.impactBody}>
          {`Covered by your ${formatWeekdayDate(afterDate)} paycheck.`}
        </Text>
      ) : (
        <Text style={styles.impactBody}>
          This payment is not covered by a paycheck yet.
        </Text>
      )}

      {preview.impacts.length ? (
        <View style={styles.impactRows}>
          {preview.impacts.map((impact) => {
            const afterRemaining = Number(impact.after_remaining);

            return (
              <View key={String(impact.id)} style={styles.impactRow}>
                <View style={styles.impactRowCopy}>
                  <Text style={styles.impactRowTitle}>
                    {impact.name ?? "Paycheck"}
                  </Text>
                  <Text style={styles.impactRowDate}>
                    {formatWeekdayDate(impact.occurrence_date)}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.impactValue,
                    afterRemaining < 0 ? styles.impactValueDanger : null,
                  ]}
                >
                  {`${formatCurrency(impact.before_remaining)} → ${formatCurrency(impact.after_remaining)}`}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </SurfaceCard>
  );
}

export default function AdjustBillOccurrenceScreen() {
  const router = useRouter();
  const { id, returnTo } = useLocalSearchParams<{
    id: string;
    returnTo?: "calendar" | "dashboard";
  }>();
  const { user } = useAuth();
  const billReminders = useBillReminders();
  const planningRevision = usePlanningRevision();
  const adjustmentsEnabled = Boolean(
    user?.features?.bill_occurrence_adjustments,
  );
  const [occurrence, setOccurrence] = useState<BillOccurrence | null>(null);
  const [draft, setDraft] = useState<BillOccurrenceAdjustmentDraft>({
    amount: "",
    dueDate: "",
    status: "projected",
  });
  const [errors, setErrors] = useState<BillOccurrenceAdjustmentErrors>({});
  const [initialLoading, setInitialLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [preview, setPreview] =
    useState<BillOccurrenceAdjustmentPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewSignature, setPreviewSignature] = useState<string | null>(null);
  const [amountFocused, setAmountFocused] = useState(false);
  const previewRequest = useRef(0);

  const load = useCallback(async () => {
    if (!id || !adjustmentsEnabled) {
      setInitialLoading(false);
      return;
    }

    setInitialLoading(true);

    try {
      const nextOccurrence = await fetchBillOccurrence(id);
      setOccurrence(nextOccurrence);
      setDraft({
        amount: nextOccurrence.effective_amount ?? nextOccurrence.amount,
        dueDate: nextOccurrence.due_date,
        status: normalizedStatus(nextOccurrence.status),
      });
      setErrors({});
      setLoadError(null);
    } catch (nextError) {
      setLoadError(getApiErrorMessage(nextError));
    } finally {
      setInitialLoading(false);
    }
  }, [adjustmentsEnabled, id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const signature = useMemo(
    () => billOccurrenceAdjustmentSignature(draft, planningRevision),
    [draft, planningRevision],
  );
  const validationErrors = useMemo(
    () => validateBillOccurrenceAdjustment(draft),
    [draft],
  );

  useEffect(() => {
    if (
      !id ||
      !occurrence ||
      planningRevision < 1 ||
      Object.keys(validationErrors).length > 0
    ) {
      setPreview(null);
      setPreviewSignature(null);
      setPreviewLoading(false);
      setPreviewError(null);
      return;
    }

    if (amountFocused) {
      setPreview(null);
      setPreviewSignature(null);
      setPreviewLoading(false);
      setPreviewError(null);
      return;
    }

    const requestId = previewRequest.current + 1;
    previewRequest.current = requestId;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setPreviewLoading(true);
      setPreviewError(null);

      void previewBillOccurrenceAdjustment(
        id,
        {
          amount: parseCurrencyInput(draft.amount)!,
          due_date: draft.dueDate,
          status: draft.status,
          expected_planning_revision: planningRevision,
        },
        controller.signal,
      )
        .then((nextPreview) => {
          if (previewRequest.current !== requestId) return;
          setPreview(nextPreview);
          setPreviewSignature(signature);
          setErrors({});
        })
        .catch((nextError) => {
          if (
            previewRequest.current !== requestId ||
            axios.isCancel(nextError)
          ) {
            return;
          }

          setErrors(fieldErrors(nextError));
          setPreviewError(getApiErrorMessage(nextError));
          setPreviewSignature(null);
        })
        .finally(() => {
          if (previewRequest.current === requestId) {
            setPreviewLoading(false);
          }
        });
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    amountFocused,
    draft,
    id,
    occurrence,
    planningRevision,
    signature,
    validationErrors,
  ]);

  const scheduledDueDate =
    occurrence?.scheduled_due_date ?? occurrence?.due_date;
  const draftIsAdjusted = occurrence
    ? billOccurrenceDraftIsAdjusted(draft, occurrence.amount, scheduledDueDate!)
    : false;
  const draftHasChanges = occurrence
    ? billOccurrenceDraftHasChanges(
        draft,
        occurrence.effective_amount ?? occurrence.amount,
        occurrence.due_date,
        normalizedStatus(occurrence.status),
      )
    : false;
  const minimumDate = addDaysToIsoDate(todayInAppTimezone(), -365);
  const maximumDate = addDaysToIsoDate(todayInAppTimezone(), 365);

  const save = async () => {
    if (!id || !occurrence) return;

    const nextErrors = validateBillOccurrenceAdjustment(draft);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) return;

    if (!preview || previewSignature !== signature || previewLoading) {
      setPreviewError("Wait for the updated paycheck impact before saving.");
      return;
    }

    setSaving(true);
    setPreviewError(null);

    try {
      await updateBillOccurrence(id, {
        amount: parseCurrencyInput(draft.amount)!,
        due_date: draft.dueDate,
        status: draft.status,
        expected_planning_revision: planningRevision,
      });

      void billReminders.refreshReminders().catch(() => {
        // The payment is saved; reminder syncing can recover on app focus.
      });

      if (returnTo === "calendar") {
        router.replace({
          pathname: "/calendar",
          params: { date: draft.dueDate },
        });
      } else {
        router.back();
      }
    } catch (nextError) {
      setErrors(fieldErrors(nextError));
      setPreviewError(getApiErrorMessage(nextError));

      if (axios.isAxiosError(nextError) && nextError.response?.status === 409) {
        await load();
      }
    } finally {
      setSaving(false);
    }
  };

  if (!adjustmentsEnabled) {
    return (
      <View style={styles.centered}>
        <ErrorState
          body="This feature is not available right now."
          onRetry={() => {
            router.back();
          }}
          title="Adjustments unavailable"
        />
      </View>
    );
  }

  if (initialLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (!occurrence) {
    return (
      <View style={styles.centered}>
        <ErrorState
          body={loadError ?? "This payment could not be loaded."}
          onRetry={() => {
            void load();
          }}
          title="Could not load payment"
        />
      </View>
    );
  }

  const category = occurrence.bill?.bill_category?.name;
  const statusLabel =
    draft.status === "paid"
      ? "Paid"
      : draft.status === "skipped"
        ? "Skipped"
        : draftIsAdjusted
          ? "Adjusted"
          : "Scheduled";

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.screen}
    >
      <ScrollView
        automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        contentContainerStyle={styles.content}
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <SurfaceCard style={styles.hero} tone="accent">
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}>
              <MaterialCommunityIcons
                color={theme.colors.primaryStrong}
                name="receipt-text-outline"
                size={25}
              />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroEyebrow}>
                {category ?? "One payment"}
              </Text>
              <Text style={styles.heroTitle}>
                {occurrence.bill?.name ?? "Bill payment"}
              </Text>
              <Text style={styles.heroSubtitle}>
                {`${formatCurrencyPrecise(occurrence.amount)} scheduled for ${formatWeekdayDate(scheduledDueDate)}`}
              </Text>
            </View>
            <StatusBadge
              label={statusLabel}
              tone={
                draft.status === "paid"
                  ? "success"
                  : draft.status === "skipped"
                    ? "neutral"
                    : draftIsAdjusted
                      ? "primary"
                      : "neutral"
              }
            />
          </View>
          <View style={styles.promiseRow}>
            <MaterialCommunityIcons
              color={theme.colors.primaryStrong}
              name="shield-check-outline"
              size={17}
            />
            <Text style={styles.promiseText}>
              Only this payment changes. Your recurring bill stays the same.
            </Text>
          </View>
        </SurfaceCard>

        <View style={styles.form}>
          <CurrencyField
            error={errors.amount}
            label="Payment amount"
            onBlur={() => {
              setAmountFocused(false);
            }}
            onChangeText={(amount) => {
              setDraft((current) => ({ ...current, amount }));
              setErrors((current) => ({ ...current, amount: undefined }));
            }}
            onFocus={() => {
              setAmountFocused(true);
            }}
            value={draft.amount}
          />

          <DatePickerField
            error={errors.dueDate}
            label="Due date"
            maximumDate={maximumDate}
            minimumDate={minimumDate}
            onChange={(dueDate) => {
              setDraft((current) => ({ ...current, dueDate }));
              setErrors((current) => ({ ...current, dueDate: undefined }));
            }}
            value={draft.dueDate}
          />

          <View style={styles.statusGroup}>
            <Text style={styles.fieldLabel}>Payment status</Text>
            <View style={styles.statusChoices}>
              <ChoiceChip
                label="Upcoming"
                onPress={() => {
                  setDraft((current) => ({ ...current, status: "projected" }));
                }}
                selected={
                  draft.status === "projected" || draft.status === "overdue"
                }
              />
              <ChoiceChip
                label="Paid"
                onPress={() => {
                  setDraft((current) => ({ ...current, status: "paid" }));
                }}
                selected={draft.status === "paid"}
              />
              <ChoiceChip
                label="Skipped"
                onPress={() => {
                  setDraft((current) => ({ ...current, status: "skipped" }));
                }}
                selected={draft.status === "skipped"}
              />
            </View>
          </View>

          <PaycheckImpact
            error={previewError}
            loading={previewLoading}
            preview={preview}
          />

          {draftIsAdjusted ? (
            <SecondaryButton
              disabled={saving}
              icon="restore"
              label="Restore scheduled amount and date"
              onPress={() => {
                setDraft((current) => ({
                  ...current,
                  amount: occurrence.amount,
                  dueDate: scheduledDueDate!,
                }));
                setErrors({});
              }}
            />
          ) : null}

          <View style={styles.actions}>
            <SecondaryButton
              disabled={saving}
              label="Cancel"
              onPress={() => {
                router.back();
              }}
            />
            <PrimaryButton
              disabled={
                saving ||
                !draftHasChanges ||
                previewLoading ||
                !preview ||
                previewSignature !== signature
              }
              icon="content-save-outline"
              label={saving ? "Saving…" : "Save adjustment"}
              onPress={() => {
                void save();
              }}
            />
          </View>
        </View>

        {occurrence.bill_id ? (
          <View style={styles.seriesLink}>
            <Text style={styles.seriesHint}>
              Need to change every future payment instead?
            </Text>
            <SecondaryButton
              icon="calendar-sync-outline"
              label="Edit recurring bill"
              onPress={() => {
                router.replace(`/bills/${occurrence.bill_id}`);
              }}
            />
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
  },
  content: {
    flexGrow: 1,
    gap: theme.spacing.lg,
    padding: theme.spacing.lg,
    paddingBottom: 72,
  },
  hero: {
    gap: theme.spacing.md,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.md,
  },
  heroIcon: {
    width: 46,
    height: 46,
    borderRadius: theme.radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surfaceStrong,
  },
  heroCopy: {
    flex: 1,
    gap: 3,
  },
  heroEyebrow: {
    color: theme.colors.primaryStrong,
    ...theme.typography.eyebrow,
  },
  heroTitle: {
    color: theme.colors.ink,
    fontSize: 23,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    color: theme.colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  promiseRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.md,
  },
  promiseText: {
    flex: 1,
    color: theme.colors.primaryStrong,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
  form: {
    gap: theme.spacing.lg,
  },
  fieldLabel: {
    color: theme.colors.ink,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  statusGroup: {
    gap: theme.spacing.sm,
  },
  statusChoices: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  impactCard: {
    gap: theme.spacing.md,
  },
  impactHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  impactTitle: {
    flex: 1,
    color: theme.colors.ink,
    ...theme.typography.cardTitle,
  },
  impactBody: {
    flex: 1,
    color: theme.colors.inkMuted,
    ...theme.typography.body,
  },
  inlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  impactRows: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  impactRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.md,
  },
  impactRowCopy: {
    flex: 1,
    gap: 2,
  },
  impactRowTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  impactRowDate: {
    color: theme.colors.muted,
    fontSize: 12,
  },
  impactValue: {
    color: theme.colors.primaryStrong,
    fontSize: 14,
    fontWeight: "800",
  },
  impactValueDanger: {
    color: theme.colors.danger,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  seriesLink: {
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
  },
  seriesHint: {
    color: theme.colors.muted,
    fontSize: 13,
    textAlign: "center",
  },
});
