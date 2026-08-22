import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { Redirect, useRouter } from "expo-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@features/auth/auth-context";
import { frequencyChipLabel } from "@features/money/labels";
import { MoreOptions } from "@features/money/more-options";
import { completeOnboarding, skipOnboarding } from "@features/onboarding/api";
import {
  clearOnboardingDraft,
  loadOnboardingDraft,
  saveOnboardingDraft,
} from "@features/onboarding/draft-storage";
import {
  emptyOnboardingDraft,
  MAX_STARTER_BILLS,
  paycheckDraftErrors,
  STARTER_BILL_TEMPLATES,
  starterBillDraftErrors,
  starterBillFromTemplate,
  type OnboardingDraft,
  type StarterBillDraft,
  type StarterBillTemplate,
} from "@features/onboarding/model";
import { shouldEnterGuidedOnboarding } from "@features/onboarding/routing";
import {
  type DashboardResponse,
  type PayScheduleInput,
} from "@features/planning/api";
import { planningKeys } from "@features/planning/queries";
import { getApiErrorMessage } from "@shared/lib/api-error";
import {
  formatCurrency,
  formatDate,
  formatWeekdayDate,
  isoDateFromInput,
  monthDayFromIsoDate,
  parseCurrencyInput,
} from "@shared/lib/format";
import { nextOccurrences } from "@shared/lib/recurrence";
import { todayInAppTimezone } from "@shared/lib/timezone";
import {
  ChoiceChip,
  CurrencyField,
  Field,
  PrimaryButton,
  SurfaceCard,
} from "@shared/ui/primitives";
import { DatePickerField } from "@shared/ui/date-picker-field";
import { theme, withAlpha } from "@shared/ui/theme";

const PAY_FREQUENCIES: PayScheduleInput["frequency"][] = [
  "biweekly",
  "semimonthly",
  "weekly",
  "monthly",
  "once",
];
const BILL_FREQUENCIES: StarterBillDraft["frequency"][] = [
  "monthly",
  "weekly",
  "biweekly",
  "yearly",
  "once",
];
const SECOND_PAY_DAYS = [1, 5, 10, 15, 20, 25, 28, 31];

type PaycheckErrors = ReturnType<typeof paycheckDraftErrors>;
type BillErrors = ReturnType<typeof starterBillDraftErrors>;

function OnboardingFrame({
  step,
  title,
  subtitle,
  onBack,
  onSkip,
  busy,
  children,
  footer,
}: {
  step: 1 | 2 | 3;
  title: string;
  subtitle: string;
  onBack?: () => void;
  onSkip?: () => void;
  busy?: boolean;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={styles.topOrb} />
        <View style={styles.accentOrb} />
        <View style={styles.bottomOrb} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <View style={styles.topBar}>
          <View style={styles.topBarSide}>
            {onBack ? (
              <Pressable
                accessibilityLabel="Back"
                disabled={busy}
                hitSlop={10}
                onPress={onBack}
                style={({ pressed }) => [
                  styles.iconButton,
                  pressed ? styles.pressed : null,
                ]}
              >
                <MaterialCommunityIcons
                  color={theme.colors.ink}
                  name="arrow-left"
                  size={22}
                />
              </Pressable>
            ) : null}
          </View>

          <View
            accessible
            accessibilityLabel={`Step ${step} of 3`}
            style={styles.progressWrap}
          >
            <Text style={styles.progressLabel}>{`Step ${step} of 3`}</Text>
            <View style={styles.progressTrack}>
              {[1, 2, 3].map((value) => (
                <View
                  key={value}
                  style={[
                    styles.progressSegment,
                    value <= step ? styles.progressSegmentActive : null,
                  ]}
                />
              ))}
            </View>
          </View>

          <View style={[styles.topBarSide, styles.topBarSideRight]}>
            {onSkip ? (
              <Pressable
                disabled={busy}
                hitSlop={10}
                onPress={onSkip}
                style={({ pressed }) => (pressed ? styles.pressed : null)}
              >
                <Text style={styles.skipLabel}>Do this later</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <ScrollView
          automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
          contentContainerStyle={styles.content}
          keyboardDismissMode={
            Platform.OS === "ios" ? "interactive" : "on-drag"
          }
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heading}>
            <Text style={styles.eyebrow}>Your first payday plan</Text>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
          {children}
        </ScrollView>

        <View style={styles.footer}>{footer}</View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function PaycheckStep({
  draft,
  errors,
  error,
  busy,
  onChange,
  onContinue,
  onSkip,
}: {
  draft: OnboardingDraft;
  errors: PaycheckErrors;
  error: string | null;
  busy: boolean;
  onChange: (paycheck: OnboardingDraft["paycheck"]) => void;
  onContinue: () => void;
  onSkip: () => void;
}) {
  const paycheck = draft.paycheck;
  const normalizedStartDate = isoDateFromInput(paycheck.startDate);
  const previewDates = useMemo(
    () =>
      normalizedStartDate
        ? nextOccurrences(
            {
              frequency: paycheck.frequency,
              startDate: normalizedStartDate,
              monthDay: monthDayFromIsoDate(normalizedStartDate),
              secondMonthDay: paycheck.secondMonthDay,
            },
            3,
          )
        : [],
    [normalizedStartDate, paycheck.frequency, paycheck.secondMonthDay],
  );

  const update = (patch: Partial<OnboardingDraft["paycheck"]>) => {
    onChange({ ...paycheck, ...patch });
  };

  return (
    <OnboardingFrame
      busy={busy}
      footer={
        <View style={styles.footerActions}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <PrimaryButton
            disabled={busy}
            icon="arrow-right"
            label="Continue"
            onPress={onContinue}
          />
        </View>
      }
      onSkip={onSkip}
      step={1}
      subtitle="Add the paycheck you expect next. We’ll use it to place every bill on the right side of payday."
      title="When do you get paid?"
    >
      <SurfaceCard tone="dark" style={styles.payPreview}>
        <Text style={styles.previewEyebrow}>Expected take-home</Text>
        <Text style={styles.previewAmount}>
          {formatCurrency(parseCurrencyInput(paycheck.amount, 0) ?? 0)}
        </Text>
        <Text style={styles.previewBody}>
          {previewDates.length
            ? previewDates.map(formatDate).join("  ·  ")
            : "Your next three paydays will appear here."}
        </Text>
      </SurfaceCard>

      <SurfaceCard style={styles.formCard}>
        <CurrencyField
          error={errors.amount}
          hint="What normally reaches your account after tax."
          label="Take-home amount"
          onChangeText={(amount) => {
            update({ amount });
          }}
          placeholder="$2,400.00"
          value={paycheck.amount}
        />

        <DatePickerField
          error={errors.startDate}
          label="Next pay date"
          minimumDate={todayInAppTimezone()}
          onChange={(startDate) => {
            update({ startDate });
          }}
          value={paycheck.startDate}
        />

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>How often</Text>
          <View style={styles.chips}>
            {PAY_FREQUENCIES.map((frequency) => (
              <ChoiceChip
                key={frequency}
                label={frequencyChipLabel(frequency)}
                onPress={() => {
                  update({ frequency });
                }}
                selected={paycheck.frequency === frequency}
              />
            ))}
          </View>
        </View>

        {paycheck.frequency === "semimonthly" ? (
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Second pay day</Text>
            <View style={styles.chips}>
              {SECOND_PAY_DAYS.map((day) => (
                <ChoiceChip
                  key={day}
                  label={day === 31 ? "Last day" : String(day)}
                  onPress={() => {
                    update({ secondMonthDay: day });
                  }}
                  selected={paycheck.secondMonthDay === day}
                />
              ))}
            </View>
            {errors.secondDay ? (
              <Text style={styles.errorText}>{errors.secondDay}</Text>
            ) : null}
          </View>
        ) : null}

        <MoreOptions>
          <Field
            autoCapitalize="words"
            hint="You can rename this later."
            label="Paycheck name"
            onChangeText={(name) => {
              update({ name });
            }}
            value={paycheck.name}
          />
        </MoreOptions>
      </SurfaceCard>
    </OnboardingFrame>
  );
}

function StarterTemplateCard({
  template,
  disabled,
  onPress,
}: {
  template: StarterBillTemplate;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.templateCard,
        disabled ? styles.disabled : null,
        pressed && !disabled ? styles.templatePressed : null,
      ]}
    >
      <View style={styles.templateIcon}>
        <MaterialCommunityIcons
          color={theme.colors.primaryStrong}
          name={template.icon}
          size={22}
        />
      </View>
      <Text style={styles.templateLabel}>{template.label}</Text>
      <MaterialCommunityIcons
        color={theme.colors.muted}
        name="plus"
        size={18}
      />
    </Pressable>
  );
}

function BillEditor({
  bill,
  errors,
  onChange,
  onCancel,
}: {
  bill: StarterBillDraft;
  errors: BillErrors;
  onChange: (bill: StarterBillDraft) => void;
  onCancel: () => void;
}) {
  const update = (patch: Partial<StarterBillDraft>) => {
    onChange({ ...bill, ...patch });
  };

  return (
    <SurfaceCard tone="accent" style={styles.billEditor}>
      <View style={styles.sectionHeadingRow}>
        <View style={styles.sectionHeadingCopy}>
          <Text style={styles.cardTitle}>Bill details</Text>
          <Text style={styles.cardSubtitle}>
            Add what you expect; you can adjust individual bills later.
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Close bill editor"
          hitSlop={10}
          onPress={onCancel}
          style={({ pressed }) => (pressed ? styles.pressed : null)}
        >
          <MaterialCommunityIcons
            color={theme.colors.ink}
            name="close"
            size={22}
          />
        </Pressable>
      </View>

      <Field
        autoCapitalize="words"
        error={errors.name}
        label="Name"
        onChangeText={(name) => {
          update({ name });
        }}
        value={bill.name}
      />
      <CurrencyField
        error={errors.amount}
        label="Expected amount"
        onChangeText={(amount) => {
          update({ amount });
        }}
        placeholder="$120.00"
        value={bill.amount}
      />
      <DatePickerField
        error={errors.startDate}
        label="Next due date"
        minimumDate={todayInAppTimezone()}
        onChange={(startDate) => {
          update({ startDate });
        }}
        value={bill.startDate}
      />

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>How often</Text>
        <View style={styles.chips}>
          {BILL_FREQUENCIES.map((frequency) => (
            <ChoiceChip
              key={frequency}
              label={frequencyChipLabel(frequency)}
              onPress={() => {
                update({ frequency });
              }}
              selected={bill.frequency === frequency}
            />
          ))}
        </View>
      </View>
    </SurfaceCard>
  );
}

function AddedBillRow({
  bill,
  onEdit,
  onRemove,
}: {
  bill: StarterBillDraft;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <SurfaceCard style={styles.addedBillRow}>
      <Pressable
        accessibilityLabel={`Edit ${bill.name}`}
        onPress={onEdit}
        style={({ pressed }) => [
          styles.addedBillMain,
          pressed ? styles.pressed : null,
        ]}
      >
        <View style={styles.addedBillIcon}>
          <MaterialCommunityIcons
            color={theme.colors.primaryStrong}
            name="receipt-text-outline"
            size={20}
          />
        </View>
        <View style={styles.addedBillCopy}>
          <Text style={styles.addedBillName}>{bill.name}</Text>
          <Text style={styles.addedBillMeta}>
            {`${formatCurrency(parseCurrencyInput(bill.amount, 0) ?? 0)} · ${formatDate(bill.startDate)}`}
          </Text>
        </View>
        <MaterialCommunityIcons
          color={theme.colors.muted}
          name="pencil-outline"
          size={19}
        />
      </Pressable>
      <Pressable
        accessibilityLabel={`Remove ${bill.name}`}
        hitSlop={8}
        onPress={onRemove}
        style={({ pressed }) => [
          styles.removeButton,
          pressed ? styles.pressed : null,
        ]}
      >
        <MaterialCommunityIcons
          color={theme.colors.danger}
          name="trash-can-outline"
          size={19}
        />
      </Pressable>
    </SurfaceCard>
  );
}

function BillsStep({
  draft,
  editor,
  editorErrors,
  busy,
  error,
  onBack,
  onSkip,
  onOpenTemplate,
  onEditBill,
  onRemoveBill,
  onChangeEditor,
  onCloseEditor,
  onSaveEditor,
  onComplete,
}: {
  draft: OnboardingDraft;
  editor: StarterBillDraft | null;
  editorErrors: BillErrors;
  busy: boolean;
  error: string | null;
  onBack: () => void;
  onSkip: () => void;
  onOpenTemplate: (template: StarterBillTemplate) => void;
  onEditBill: (bill: StarterBillDraft) => void;
  onRemoveBill: (id: string) => void;
  onChangeEditor: (bill: StarterBillDraft) => void;
  onCloseEditor: () => void;
  onSaveEditor: () => void;
  onComplete: () => void;
}) {
  const atLimit = draft.bills.length >= MAX_STARTER_BILLS;
  const monthlyTotal = draft.bills.reduce(
    (total, bill) => total + Number(parseCurrencyInput(bill.amount, 0) ?? 0),
    0,
  );

  return (
    <OnboardingFrame
      busy={busy}
      footer={
        <View style={styles.footerActions}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <PrimaryButton
            disabled={busy}
            icon={editor ? "check" : "creation-outline"}
            label={
              busy
                ? "Building your plan…"
                : editor
                  ? "Save bill"
                  : "Build my plan"
            }
            onPress={editor ? onSaveEditor : onComplete}
          />
          {!editor ? (
            <Text style={styles.footerHint}>
              {draft.bills.length
                ? `${draft.bills.length} ${draft.bills.length === 1 ? "bill" : "bills"} ready · ${formatCurrency(monthlyTotal)} listed`
                : "No bills yet? You can build the paycheck first and add them later."}
            </Text>
          ) : null}
        </View>
      }
      onBack={busy ? undefined : onBack}
      onSkip={onSkip}
      step={2}
      subtitle="Choose the bills you pay most often. Each one takes only an amount and its next due date."
      title="What gets paid next?"
    >
      {editor ? (
        <BillEditor
          bill={editor}
          errors={editorErrors}
          onCancel={onCloseEditor}
          onChange={onChangeEditor}
        />
      ) : (
        <>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Common bills</Text>
            <Text style={styles.sectionBody}>
              Tap one to add it. Nothing connects to your bank.
            </Text>
          </View>
          <View style={styles.templateGrid}>
            {STARTER_BILL_TEMPLATES.map((template) => (
              <StarterTemplateCard
                disabled={atLimit || busy}
                key={template.key}
                onPress={() => {
                  onOpenTemplate(template);
                }}
                template={template}
              />
            ))}
          </View>
        </>
      )}

      {draft.bills.length ? (
        <View style={styles.addedSection}>
          <View style={styles.sectionHeadingRow}>
            <View style={styles.sectionHeadingCopy}>
              <Text style={styles.sectionTitle}>Added to your plan</Text>
              <Text style={styles.sectionBody}>
                Tap a bill to make a change before building the forecast.
              </Text>
            </View>
            <Text
              style={styles.billCount}
            >{`${draft.bills.length}/${MAX_STARTER_BILLS}`}</Text>
          </View>
          <View style={styles.addedBills}>
            {draft.bills.map((bill) => (
              <AddedBillRow
                bill={bill}
                key={bill.id}
                onEdit={() => {
                  onEditBill(bill);
                }}
                onRemove={() => {
                  onRemoveBill(bill.id);
                }}
              />
            ))}
          </View>
        </View>
      ) : null}
    </OnboardingFrame>
  );
}

function RevealStep({
  dashboard,
  onFinish,
}: {
  dashboard: DashboardResponse;
  onFinish: () => void;
}) {
  const paycheck = dashboard.next_paycheck;
  const bills = dashboard.next_paycheck_bill_occurrences;
  const uncoveredCount = dashboard.bills_due_before_next_paycheck.filter(
    (bill) =>
      bill.status !== "paid" &&
      bill.status !== "skipped" &&
      Number(bill.unfunded_amount ?? bill.effective_amount ?? bill.amount) > 0,
  ).length;
  const remaining = Number(paycheck?.remaining_amount ?? 0);
  const short = remaining < 0;

  return (
    <OnboardingFrame
      footer={
        <PrimaryButton
          icon="home-outline"
          label="See my Home"
          onPress={onFinish}
        />
      }
      step={3}
      subtitle="Your recurring dates are saved, every bill has been placed against payday, and the plan will keep itself current."
      title="Your first plan is ready"
    >
      <SurfaceCard tone="dark" style={styles.revealHero}>
        <View style={styles.successIcon}>
          <MaterialCommunityIcons
            color={theme.colors.primaryStrong}
            name="check"
            size={28}
          />
        </View>
        <Text style={styles.previewEyebrow}>
          {short ? "Short after planned bills" : "Left after planned bills"}
        </Text>
        <Text
          style={[styles.revealAmount, short ? styles.revealAmountShort : null]}
        >
          {formatCurrency(Math.abs(remaining))}
        </Text>
        <Text style={styles.previewBody}>
          {paycheck
            ? `${formatWeekdayDate(paycheck.occurrence_date)} · ${paycheck.pay_schedule?.name ?? "Paycheck"} · ${formatCurrency(paycheck.effective_amount ?? paycheck.amount)}`
            : "Your first paycheck is saved."}
        </Text>
      </SurfaceCard>

      <SurfaceCard style={styles.revealDetails}>
        <View style={styles.revealMetricRow}>
          <View style={styles.revealMetric}>
            <Text style={styles.revealMetricLabel}>Bills planned</Text>
            <Text style={styles.revealMetricValue}>
              {formatCurrency(paycheck?.assigned_total ?? 0)}
            </Text>
          </View>
          <View style={styles.revealMetricDivider} />
          <View style={styles.revealMetric}>
            <Text style={styles.revealMetricLabel}>Covered bills</Text>
            <Text style={styles.revealMetricValue}>{String(bills.length)}</Text>
          </View>
        </View>

        {bills.slice(0, 4).map((bill) => (
          <View key={String(bill.id)} style={styles.revealBillRow}>
            <View style={styles.revealBillCheck}>
              <MaterialCommunityIcons
                color={theme.colors.success}
                name="check"
                size={15}
              />
            </View>
            <Text numberOfLines={1} style={styles.revealBillName}>
              {bill.bill?.name ?? "Bill"}
            </Text>
            <Text style={styles.revealBillAmount}>
              {formatCurrency(bill.effective_amount ?? bill.amount)}
            </Text>
          </View>
        ))}

        {uncoveredCount > 0 ? (
          <View style={styles.coverageNotice}>
            <MaterialCommunityIcons
              color={theme.colors.warning}
              name="alert-circle-outline"
              size={19}
            />
            <Text style={styles.coverageNoticeText}>
              {`${uncoveredCount} ${uncoveredCount === 1 ? "bill isn't" : "bills aren't"} fully covered yet. Home will keep ${uncoveredCount === 1 ? "it" : "them"} visible.`}
            </Text>
          </View>
        ) : null}
      </SurfaceCard>
    </OnboardingFrame>
  );
}

export default function OnboardingScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, syncUser } = useAuth();
  const [draft, setDraft] = useState<OnboardingDraft>(emptyOnboardingDraft);
  const [draftReady, setDraftReady] = useState(false);
  const [paycheckErrors, setPaycheckErrors] = useState<PaycheckErrors>({});
  const [editor, setEditor] = useState<StarterBillDraft | null>(null);
  const [editorErrors, setEditorErrors] = useState<BillErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DashboardResponse | null>(null);
  const userId = user?.id;

  useEffect(() => {
    let active = true;

    setDraftReady(false);

    if (!userId) {
      setDraftReady(true);
      return;
    }

    void loadOnboardingDraft(userId)
      .then((stored) => {
        if (!active) return;
        setDraft(stored ?? emptyOnboardingDraft());
        setDraftReady(true);
      })
      .catch(() => {
        if (!active) return;
        setDraft(emptyOnboardingDraft());
        setDraftReady(true);
      });

    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!draftReady || !userId || result) return;

    const timer = setTimeout(() => {
      void saveOnboardingDraft(userId, draft).catch(() => undefined);
    }, 250);

    return () => {
      clearTimeout(timer);
    };
  }, [draft, draftReady, result, userId]);

  const skip = useCallback(async () => {
    if (!userId || skipping || submitting) return;

    setSkipping(true);
    setError(null);

    try {
      const nextUser = await skipOnboarding();
      await syncUser(nextUser);
      void clearOnboardingDraft(userId).catch(() => undefined);
      router.replace("/dashboard");
    } catch (nextError) {
      setError(getApiErrorMessage(nextError));
      setSkipping(false);
    }
  }, [router, skipping, submitting, syncUser, userId]);

  const confirmSkip = useCallback(() => {
    Alert.alert(
      "Finish setup later?",
      "You can add your paycheck and bills from Home whenever you are ready.",
      [
        { style: "cancel", text: "Keep setting up" },
        {
          text: "Do this later",
          onPress: () => {
            void skip();
          },
        },
      ],
    );
  }, [skip]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (submitting || skipping) return true;

        if (result) {
          router.replace("/dashboard");
          return true;
        }

        if (draft.step === "bills") {
          setDraft((current) => ({ ...current, step: "paycheck" }));
          setEditor(null);
          return true;
        }

        confirmSkip();
        return true;
      },
    );

    return () => {
      subscription.remove();
    };
  }, [confirmSkip, draft.step, result, router, skipping, submitting]);

  if (!user) return <Redirect href="/login" />;
  if (!result && !shouldEnterGuidedOnboarding(user)) {
    return <Redirect href="/dashboard" />;
  }
  if (!draftReady) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <Text style={styles.loadingLabel}>Preparing your quick setup…</Text>
      </SafeAreaView>
    );
  }

  const continueFromPaycheck = () => {
    const nextErrors = paycheckDraftErrors(draft.paycheck);
    setPaycheckErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) return;

    setError(null);
    setDraft((current) => ({ ...current, step: "bills" }));
  };

  const openTemplate = (template: StarterBillTemplate) => {
    if (draft.bills.length >= MAX_STARTER_BILLS) return;

    setEditorErrors({});
    setEditor(
      starterBillFromTemplate(
        template,
        `${Date.now()}-${template.key}-${draft.bills.length}`,
      ),
    );
  };

  const saveEditor = () => {
    if (!editor) return;

    const nextErrors = starterBillDraftErrors(editor);
    setEditorErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) return;

    setDraft((current) => {
      const exists = current.bills.some((bill) => bill.id === editor.id);
      const bills = exists
        ? current.bills.map((bill) => (bill.id === editor.id ? editor : bill))
        : [...current.bills, editor];

      return { ...current, bills };
    });
    setEditor(null);
    setEditorErrors({});
  };

  const buildPlan = async () => {
    if (!userId || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const completion = await completeOnboarding(draft);
      const scope = {
        revision: Number(completion.user.planning_revision ?? 0),
        userId: completion.user.id,
      };

      queryClient.setQueryData(
        planningKeys.dashboard(scope),
        completion.dashboard,
      );
      setResult(completion.dashboard);
      await syncUser(completion.user, { prefetchPlanning: false });
      void clearOnboardingDraft(userId).catch(() => undefined);
    } catch (nextError) {
      setError(getApiErrorMessage(nextError));
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <RevealStep
        dashboard={result}
        onFinish={() => {
          router.replace("/dashboard");
        }}
      />
    );
  }

  if (draft.step === "paycheck") {
    return (
      <PaycheckStep
        busy={skipping}
        draft={draft}
        error={error}
        errors={paycheckErrors}
        onChange={(paycheck) => {
          setDraft((current) => ({ ...current, paycheck }));
          setPaycheckErrors({});
        }}
        onContinue={continueFromPaycheck}
        onSkip={confirmSkip}
      />
    );
  }

  return (
    <BillsStep
      busy={submitting || skipping}
      draft={draft}
      editor={editor}
      editorErrors={editorErrors}
      error={error}
      onBack={() => {
        setEditor(null);
        setDraft((current) => ({ ...current, step: "paycheck" }));
      }}
      onChangeEditor={(nextEditor) => {
        setEditor(nextEditor);
        setEditorErrors({});
      }}
      onCloseEditor={() => {
        setEditor(null);
        setEditorErrors({});
      }}
      onComplete={() => {
        void buildPlan();
      }}
      onEditBill={(bill) => {
        setEditorErrors({});
        setEditor({ ...bill });
      }}
      onOpenTemplate={openTemplate}
      onRemoveBill={(id) => {
        setDraft((current) => ({
          ...current,
          bills: current.bills.filter((bill) => bill.id !== id),
        }));
        if (editor?.id === id) setEditor(null);
      }}
      onSaveEditor={saveEditor}
      onSkip={confirmSkip}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.background,
  },
  loadingLabel: { color: theme.colors.muted, ...theme.typography.body },
  topOrb: {
    position: "absolute",
    top: -120,
    left: -72,
    width: 280,
    height: 280,
    borderRadius: 280,
    backgroundColor: withAlpha(theme.colors.ink, 0.1),
  },
  accentOrb: {
    position: "absolute",
    top: 140,
    right: -68,
    width: 190,
    height: 190,
    borderRadius: 190,
    backgroundColor: withAlpha(theme.colors.primary, 0.12),
  },
  bottomOrb: {
    position: "absolute",
    bottom: 70,
    left: -60,
    width: 220,
    height: 220,
    borderRadius: 220,
    backgroundColor: withAlpha(theme.colors.accent, 0.11),
  },
  topBar: {
    minHeight: 58,
    paddingHorizontal: theme.spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
  },
  topBarSide: { width: 96, alignItems: "flex-start" },
  topBarSideRight: { alignItems: "flex-end" },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surfaceStrong,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  skipLabel: {
    color: theme.colors.primaryStrong,
    fontSize: 13,
    fontWeight: "700",
  },
  progressWrap: { flex: 1, alignItems: "center", gap: 7 },
  progressLabel: {
    color: theme.colors.muted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  progressTrack: { flexDirection: "row", gap: 5, width: 112 },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
  },
  progressSegmentActive: { backgroundColor: theme.colors.primary },
  content: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.lg,
  },
  heading: { gap: theme.spacing.sm },
  eyebrow: { color: theme.colors.primaryStrong, ...theme.typography.eyebrow },
  title: { color: theme.colors.ink, ...theme.typography.title },
  subtitle: { color: theme.colors.muted, ...theme.typography.body },
  footer: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
    backgroundColor: withAlpha(theme.colors.surfaceStrong, 0.96),
  },
  footerActions: { gap: theme.spacing.sm },
  footerHint: {
    color: theme.colors.muted,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
  },
  payPreview: { gap: theme.spacing.sm, overflow: "hidden" },
  previewEyebrow: {
    color: withAlpha(theme.colors.white, 0.65),
    ...theme.typography.eyebrow,
  },
  previewAmount: {
    color: theme.colors.white,
    fontSize: 44,
    fontWeight: "800",
    letterSpacing: -1.5,
  },
  previewBody: {
    color: withAlpha(theme.colors.white, 0.76),
    ...theme.typography.body,
  },
  formCard: { gap: theme.spacing.lg },
  fieldGroup: { gap: theme.spacing.sm },
  fieldLabel: { color: theme.colors.ink, fontSize: 13, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
  errorText: { color: theme.colors.danger, fontSize: 13, fontWeight: "600" },
  templateGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  templateCard: {
    minHeight: 76,
    width: "48%",
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceStrong,
    ...theme.shadows.card,
  },
  templatePressed: { transform: [{ scale: 0.985 }], opacity: 0.88 },
  templateIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.primarySoft,
  },
  templateLabel: {
    flex: 1,
    color: theme.colors.ink,
    fontSize: 14,
    fontWeight: "700",
  },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.68 },
  sectionHeading: { gap: 4 },
  sectionHeadingRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing.md,
  },
  sectionHeadingCopy: { flex: 1, gap: 4 },
  sectionTitle: {
    color: theme.colors.ink,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  sectionBody: { color: theme.colors.muted, ...theme.typography.body },
  cardTitle: { color: theme.colors.ink, ...theme.typography.cardTitle },
  cardSubtitle: { color: theme.colors.inkMuted, ...theme.typography.body },
  billEditor: { gap: theme.spacing.lg },
  addedSection: { gap: theme.spacing.md },
  billCount: {
    color: theme.colors.primaryStrong,
    fontSize: 13,
    fontWeight: "800",
  },
  addedBills: { gap: theme.spacing.sm },
  addedBillRow: { flexDirection: "row", padding: 0, overflow: "hidden" },
  addedBillMain: {
    flex: 1,
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    padding: theme.spacing.md,
  },
  addedBillIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.primarySoft,
  },
  addedBillCopy: { flex: 1, gap: 3 },
  addedBillName: { color: theme.colors.ink, fontSize: 16, fontWeight: "800" },
  addedBillMeta: { color: theme.colors.muted, fontSize: 13 },
  removeButton: {
    width: 52,
    alignItems: "center",
    justifyContent: "center",
    borderLeftWidth: 1,
    borderLeftColor: theme.colors.divider,
    backgroundColor: theme.colors.dangerSoft,
  },
  revealHero: {
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xl,
  },
  successIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.xs,
    backgroundColor: theme.colors.primarySoft,
  },
  revealAmount: {
    color: theme.colors.white,
    fontSize: 54,
    fontWeight: "800",
    letterSpacing: -2,
  },
  revealAmountShort: { color: theme.colors.onInkDanger },
  revealDetails: { gap: theme.spacing.md },
  revealMetricRow: { flexDirection: "row", alignItems: "stretch" },
  revealMetric: { flex: 1, gap: 4 },
  revealMetricDivider: {
    width: 1,
    marginHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.divider,
  },
  revealMetricLabel: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  revealMetricValue: {
    color: theme.colors.ink,
    ...theme.typography.metricCompact,
  },
  revealBillRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
  },
  revealBillCheck: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.successSoft,
  },
  revealBillName: {
    flex: 1,
    color: theme.colors.ink,
    fontSize: 15,
    fontWeight: "700",
  },
  revealBillAmount: {
    color: theme.colors.ink,
    fontSize: 15,
    fontWeight: "800",
  },
  coverageNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.warningSoft,
  },
  coverageNoticeText: {
    flex: 1,
    color: theme.colors.warning,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
});
