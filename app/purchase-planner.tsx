import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import * as Crypto from "expo-crypto";
import { useRouter, type Href } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@features/auth/auth-context";
import { useBillReminders } from "@features/notifications/bill-reminder-context";
import {
  buildPurchasePlanInput,
  normalizePurchasePlannerCushion,
  shouldShowPurchaseSavingPath,
  type PurchasePlanDraft,
  type PurchasePlanDraftErrors,
  purchasePlanSignature,
  purchaseVerdictContent,
  validatePurchasePlanDraft,
} from "@features/purchase-planner/model";
import {
  commitPurchasePlan,
  previewPurchasePlan,
  type PurchasePlanCommit,
  type PurchasePlanContribution,
  type PurchasePlanPreview,
} from "@features/planning/api";
import { usePlanningRevision } from "@shared/api/planning-revision";
import { getApiErrorMessage } from "@shared/lib/api-error";
import {
  formatCurrency,
  formatDate,
  formatWeekdayDate,
} from "@shared/lib/format";
import { addDaysToIsoDate, todayInAppTimezone } from "@shared/lib/timezone";
import { purchasePlannerCushionStorage } from "@shared/storage/secure";
import { DatePickerField } from "@shared/ui/date-picker-field";
import {
  AppScreen,
  ChoiceChip,
  CurrencyField,
  Field,
  PrimaryButton,
  Row,
  ScreenHeader,
  SecondaryButton,
  SectionTitle,
  StatusBadge,
  SurfaceCard,
} from "@shared/ui/primitives";
import { theme } from "@shared/ui/theme";

const CUSHION_CHOICES = ["0", "100", "250"];

function PaycheckImpactRows({
  contributions,
}: {
  contributions: PurchasePlanContribution[];
}) {
  return (
    <View style={styles.rows}>
      {contributions.map((contribution) => (
        <Row
          key={String(contribution.id)}
          subtitle={`${formatCurrency(contribution.before_remaining)} → ${formatCurrency(contribution.after_remaining)} left`}
          title={
            contribution.name
              ? `${contribution.name} · ${formatWeekdayDate(contribution.occurrence_date)}`
              : formatWeekdayDate(contribution.occurrence_date)
          }
          value={formatCurrency(contribution.contribution_amount)}
          valueTone={contribution.above_cushion ? "success" : "danger"}
        />
      ))}
    </View>
  );
}

function ResultCard({
  preview,
  saving,
  onCommit,
  onUseLaterDate,
  onStartOver,
}: {
  preview: PurchasePlanPreview;
  saving: PurchasePlanCommit["commit_as"] | null;
  onCommit: (commitAs: PurchasePlanCommit["commit_as"]) => void;
  onUseLaterDate: (date: string) => void;
  onStartOver: () => void;
}) {
  const content = purchaseVerdictContent(preview);
  const dark = content.tone === "dark";
  const contributions = preview.saving_plan.feasible_by_target
    ? preview.saving_plan.contributions
    : preview.saving_plan.later_contributions;
  const showSavingPath = shouldShowPurchaseSavingPath(preview);

  return (
    <>
      <SurfaceCard tone={content.tone} style={styles.resultHero}>
        <Text style={[styles.resultEyebrow, dark ? styles.onDarkMuted : null]}>
          {content.eyebrow}
        </Text>
        <Text style={[styles.resultTitle, dark ? styles.onDark : null]}>
          {content.title}
        </Text>
        <Text style={[styles.resultBody, dark ? styles.onDarkMuted : null]}>
          {content.body}
        </Text>
      </SurfaceCard>

      {preview.direct_impact ? (
        <SurfaceCard>
          <SectionTitle
            subtitle={`${formatCurrency(preview.direct_impact.before_remaining)} before the purchase`}
            title="If you pay all at once"
          />
          <View style={styles.directImpact}>
            <View>
              <Text style={styles.impactDate}>
                {formatWeekdayDate(preview.direct_impact.occurrence_date)}
              </Text>
              <Text style={styles.impactLabel}>
                {preview.direct_impact.name ?? "Paycheck"}
              </Text>
            </View>
            <View style={styles.afterAmountWrap}>
              <Text
                style={[
                  styles.afterAmount,
                  !preview.direct_impact.non_negative
                    ? styles.afterAmountDanger
                    : null,
                ]}
              >
                {formatCurrency(preview.direct_impact.after_remaining)}
              </Text>
              <Text style={styles.impactLabel}>left afterward</Text>
            </View>
          </View>
        </SurfaceCard>
      ) : null}

      {showSavingPath && contributions.length > 1 ? (
        <SurfaceCard>
          <SectionTitle
            subtitle={
              preview.saving_plan.feasible_by_target
                ? `Reach ${formatCurrency(preview.purchase.amount)} by ${formatDate(preview.purchase.target_date)}.`
                : `The earliest comfortable date is ${preview.saving_plan.earliest_ready_date ? formatDate(preview.saving_plan.earliest_ready_date) : "not in the current forecast"}.`
            }
            title="Paycheck-by-paycheck"
          />
          <PaycheckImpactRows contributions={contributions} />
        </SurfaceCard>
      ) : null}

      {preview.baseline_warnings.length ? (
        <SurfaceCard tone="warning">
          <SectionTitle
            subtitle="These were already part of your plan before this purchase was tested."
            title="Current plan warnings"
          />
          <View style={styles.warningList}>
            {preview.baseline_warnings.map((warning, index) => (
              <View
                key={`${warning.kind}-${warning.date}-${index}`}
                style={styles.warningRow}
              >
                <MaterialCommunityIcons
                  color={theme.colors.warning}
                  name="alert-outline"
                  size={20}
                />
                <Text style={styles.warningCopy}>
                  {warning.kind === "short_paycheck"
                    ? `${warning.name ?? "Paycheck"} is already ${formatCurrency(warning.amount)} short on ${formatDate(warning.date)}.`
                    : `${warning.name ?? "A bill"} still has ${formatCurrency(warning.amount)} uncovered on ${formatDate(warning.date)}.`}
                </Text>
              </View>
            ))}
          </View>
        </SurfaceCard>
      ) : null}

      <SurfaceCard>
        <Text style={styles.disclosure}>
          Based on the paychecks, bills, and goals you have added. Everyday
          spending is not included.
        </Text>

        <View style={styles.actions}>
          {preview.can_commit_planned_expense ? (
            <PrimaryButton
              disabled={saving !== null}
              icon="calendar-plus"
              label={saving === "planned_expense" ? "Adding…" : "Add to plan"}
              onPress={() => {
                onCommit("planned_expense");
              }}
            />
          ) : null}

          {preview.can_commit_savings_goal &&
          preview.verdict !== "fits_comfortably" ? (
            <PrimaryButton
              disabled={saving !== null}
              icon="bullseye-arrow"
              label={
                saving === "savings_goal" ? "Creating…" : "Create savings plan"
              }
              onPress={() => {
                onCommit("savings_goal");
              }}
            />
          ) : null}

          {preview.verdict === "choose_later_date" &&
          preview.saving_plan.earliest_ready_date ? (
            <SecondaryButton
              disabled={saving !== null}
              icon="calendar-arrow-right"
              label={`Try ${formatDate(preview.saving_plan.earliest_ready_date)}`}
              onPress={() => {
                onUseLaterDate(preview.saving_plan.earliest_ready_date!);
              }}
            />
          ) : null}

          <SecondaryButton
            disabled={saving !== null}
            icon="pencil-outline"
            label="Change the plan"
            onPress={onStartOver}
          />
        </View>
      </SurfaceCard>
    </>
  );
}

export default function PurchasePlannerScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { refreshUser, user } = useAuth();
  const billReminders = useBillReminders();
  const planningRevision = usePlanningRevision();
  const [draft, setDraft] = useState<PurchasePlanDraft>({
    name: "",
    amount: "",
    targetDate: addDaysToIsoDate(todayInAppTimezone(), 30),
    minimumCushion: "0",
  });
  const [errors, setErrors] = useState<PurchasePlanDraftErrors>({});
  const [preview, setPreview] = useState<PurchasePlanPreview | null>(null);
  const [previewSignature, setPreviewSignature] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<PurchasePlanCommit["commit_as"] | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const previewAbortRef = useRef<AbortController | null>(null);
  const cushionEditedRef = useRef(false);
  const savingRef = useRef<PurchasePlanCommit["commit_as"] | null>(null);
  const commitRequestIdsRef = useRef<
    Partial<Record<PurchasePlanCommit["commit_as"], string>>
  >({});

  useEffect(() => {
    let active = true;

    void purchasePlannerCushionStorage
      .get()
      .then((stored) => {
        if (!active || cushionEditedRef.current || stored == null) return;

        const normalized = normalizePurchasePlannerCushion(stored);
        if (normalized !== null) {
          setDraft((current) => ({
            ...current,
            minimumCushion: normalized,
          }));
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  useEffect(
    () => () => {
      previewAbortRef.current?.abort();
    },
    [],
  );

  const input = useMemo(
    () => buildPurchasePlanInput(draft, planningRevision),
    [draft, planningRevision],
  );
  const signature = purchasePlanSignature(input);
  const previewIsCurrent = Boolean(
    preview && previewSignature && previewSignature === signature,
  );

  const updateDraft = <TKey extends keyof PurchasePlanDraft>(
    key: TKey,
    value: PurchasePlanDraft[TKey],
  ) => {
    if (key === "minimumCushion") cushionEditedRef.current = true;
    commitRequestIdsRef.current = {};
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setError(null);
  };

  const checkPlan = async () => {
    if (previewAbortRef.current !== null) return;

    const nextErrors = validatePurchasePlanDraft(draft);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0 || !input) return;

    setLoading(true);
    setError(null);
    commitRequestIdsRef.current = {};
    const controller = new AbortController();
    previewAbortRef.current = controller;

    try {
      const result = await previewPurchasePlan(input, controller.signal);
      setPreview(result);
      setPreviewSignature(purchasePlanSignature(input));
      void purchasePlannerCushionStorage
        .set(input.minimum_cushion)
        .catch(() => undefined);
    } catch (nextError) {
      if (axios.isCancel(nextError)) return;

      if (axios.isAxiosError(nextError) && nextError.response?.status === 409) {
        await refreshUser();
      }
      setError(getApiErrorMessage(nextError));
      setPreview(null);
      setPreviewSignature(null);
    } finally {
      if (previewAbortRef.current === controller) {
        previewAbortRef.current = null;
        setLoading(false);
      }
    }
  };

  const commit = async (commitAs: PurchasePlanCommit["commit_as"]) => {
    if (!input || !previewIsCurrent || savingRef.current !== null) return;

    savingRef.current = commitAs;
    setSaving(commitAs);
    setError(null);
    const requestId =
      commitRequestIdsRef.current[commitAs] ?? Crypto.randomUUID();
    commitRequestIdsRef.current[commitAs] = requestId;

    try {
      await commitPurchasePlan({
        ...input,
        commit_as: commitAs,
        request_id: requestId,
      });
      await queryClient.invalidateQueries({ queryKey: ["planning"] });

      if (commitAs === "planned_expense") {
        await billReminders.refreshReminders();
        router.replace(`/calendar?date=${input.target_date}` as Href);
      } else {
        router.replace("/money?tab=goals" as Href);
      }
    } catch (nextError) {
      if (axios.isAxiosError(nextError) && nextError.response?.status === 409) {
        await refreshUser();
      }
      setError(getApiErrorMessage(nextError));
    } finally {
      savingRef.current = null;
      setSaving(null);
    }
  };

  const close = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/dashboard" as Href);
  };

  if (!user?.features?.purchase_planner) {
    return (
      <AppScreen>
        <ScreenHeader title="Purchase Planner" />
        <SurfaceCard tone="warning">
          <SectionTitle
            subtitle="This feature is not available for this account yet."
            title="Purchase Planner unavailable"
          />
          <SecondaryButton label="Go back" onPress={close} />
        </SurfaceCard>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <ScreenHeader
        eyebrow="Try it before you plan it"
        right={
          <Pressable
            accessibilityLabel="Close Purchase Planner"
            accessibilityRole="button"
            hitSlop={10}
            onPress={close}
            style={({ pressed }) => [
              styles.closeButton,
              pressed ? styles.pressed : null,
            ]}
          >
            <MaterialCommunityIcons
              color={theme.colors.ink}
              name="close"
              size={22}
            />
          </Pressable>
        }
        subtitle="See how one purchase would affect the paychecks you already planned."
        title="Purchase Planner"
      />

      {!previewIsCurrent ? (
        <>
          <SurfaceCard tone="dark" style={styles.introCard}>
            <StatusBadge label="No bank connection" tone="primary" />
            <Text style={styles.introTitle}>What are you thinking about?</Text>
            <Text style={styles.introBody}>
              Add an amount and date. Your real plan stays untouched until you
              choose to save the result.
            </Text>
          </SurfaceCard>

          <SurfaceCard>
            <Field
              autoCapitalize="words"
              error={errors.name}
              label="Purchase"
              onChangeText={(value) => updateDraft("name", value)}
              placeholder="Laptop, trip, new tires…"
              value={draft.name}
            />
            <CurrencyField
              error={errors.amount}
              label="Amount"
              onChangeText={(value) => updateDraft("amount", value)}
              placeholder="$1,200.00"
              value={draft.amount}
            />
            <DatePickerField
              error={errors.targetDate}
              label="When would you like it?"
              minimumDate={todayInAppTimezone()}
              onChange={(value) => updateDraft("targetDate", value)}
              value={draft.targetDate}
            />

            <View style={styles.cushionGroup}>
              <Text style={styles.fieldLabel}>Keep free on every paycheck</Text>
              <View style={styles.chips}>
                {CUSHION_CHOICES.map((choice) => (
                  <ChoiceChip
                    key={choice}
                    label={
                      choice === "0" ? "No cushion" : formatCurrency(choice)
                    }
                    onPress={() => updateDraft("minimumCushion", choice)}
                    selected={
                      Number(draft.minimumCushion || 0) === Number(choice)
                    }
                  />
                ))}
              </View>
              <CurrencyField
                error={errors.minimumCushion}
                hint="Optional. This amount stays uncommitted after bills, goals, and this purchase."
                label="Custom cushion"
                onChangeText={(value) => updateDraft("minimumCushion", value)}
                value={draft.minimumCushion}
              />
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <PrimaryButton
              disabled={loading || planningRevision < 1}
              icon="chart-timeline-variant-shimmer"
              label={loading ? "Checking your plan…" : "Check my plan"}
              onPress={() => void checkPlan()}
            />
          </SurfaceCard>
        </>
      ) : preview ? (
        <ResultCard
          onCommit={(commitAs) => void commit(commitAs)}
          onStartOver={() => {
            commitRequestIdsRef.current = {};
            setPreview(null);
            setPreviewSignature(null);
          }}
          onUseLaterDate={(date) => {
            updateDraft("targetDate", date);
            setPreview(null);
            setPreviewSignature(null);
          }}
          preview={preview}
          saving={saving}
        />
      ) : null}

      {previewIsCurrent && error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  closeButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceStrong,
  },
  pressed: { opacity: 0.72 },
  introCard: { gap: theme.spacing.md },
  introTitle: { color: theme.colors.white, ...theme.typography.metricCompact },
  introBody: { color: theme.colors.backgroundStrong, ...theme.typography.body },
  cushionGroup: { gap: theme.spacing.sm },
  fieldLabel: { color: theme.colors.ink, fontSize: 13, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
  resultHero: { gap: theme.spacing.sm },
  resultEyebrow: {
    color: theme.colors.primaryStrong,
    ...theme.typography.eyebrow,
  },
  resultTitle: { color: theme.colors.ink, ...theme.typography.metricCompact },
  resultBody: { color: theme.colors.inkMuted, ...theme.typography.body },
  onDark: { color: theme.colors.white },
  onDarkMuted: { color: theme.colors.backgroundStrong },
  directImpact: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: theme.spacing.md,
  },
  impactDate: { color: theme.colors.ink, ...theme.typography.bodyStrong },
  impactLabel: { color: theme.colors.muted, fontSize: 13 },
  afterAmountWrap: { alignItems: "flex-end", gap: 2 },
  afterAmount: {
    color: theme.colors.success,
    ...theme.typography.metricCompact,
  },
  afterAmountDanger: { color: theme.colors.danger },
  rows: { gap: theme.spacing.sm },
  warningList: { gap: theme.spacing.sm },
  warningRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.sm,
  },
  warningCopy: {
    flex: 1,
    color: theme.colors.inkMuted,
    ...theme.typography.body,
  },
  disclosure: { color: theme.colors.muted, fontSize: 13, lineHeight: 19 },
  actions: { gap: theme.spacing.sm },
  errorText: { color: theme.colors.danger, fontSize: 14, fontWeight: "600" },
});
