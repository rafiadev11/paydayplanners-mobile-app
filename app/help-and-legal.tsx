import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Redirect, useRootNavigationState, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@features/auth/auth-context";
import { submitSupportRequest, type SupportTopic } from "@features/support/api";
import { getApiErrorMessage } from "@shared/lib/api-error";
import { PRIVACY_URL, TERMS_URL } from "@shared/lib/env";
import {
  ChoiceChip,
  Field,
  PrimaryButton,
  SecondaryButton,
  SurfaceCard,
} from "@shared/ui/primitives";
import { theme, withAlpha } from "@shared/ui/theme";

const SUPPORT_EMAIL = "support@powermyfitness.com";

const topicOptions: {
  label: string;
  subtitle: string;
  value: SupportTopic;
}[] = [
  {
    label: "Billing",
    subtitle: "Trials, subscriptions, and payments.",
    value: "billing",
  },
  {
    label: "Bug report",
    subtitle: "Something feels broken or inaccurate.",
    value: "bug_report",
  },
  {
    label: "Feature request",
    subtitle: "A workflow you want improved.",
    value: "feature_request",
  },
  {
    label: "Account",
    subtitle: "Profile, sign-in, or access questions.",
    value: "account",
  },
  {
    label: "Other",
    subtitle: "Anything that does not fit the list above.",
    value: "other",
  },
];

function NoticeBanner({
  icon,
  message,
  tone = "info",
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  message: string;
  tone?: "info" | "success" | "danger";
}) {
  return (
    <View
      style={[
        styles.noticeBanner,
        tone === "success" ? styles.noticeBannerSuccess : null,
        tone === "danger" ? styles.noticeBannerDanger : null,
      ]}
    >
      <MaterialCommunityIcons
        color={
          tone === "danger"
            ? theme.colors.danger
            : tone === "success"
              ? theme.colors.success
              : theme.colors.primaryStrong
        }
        name={icon}
        size={18}
      />
      <Text
        style={[
          styles.noticeLabel,
          tone === "success" ? styles.noticeLabelSuccess : null,
          tone === "danger" ? styles.noticeLabelDanger : null,
        ]}
      >
        {message}
      </Text>
    </View>
  );
}

function LegalRow({
  icon,
  label,
  subtitle,
  onPress,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.legalRow,
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={styles.legalRowIcon}>
        <MaterialCommunityIcons
          color={theme.colors.primaryStrong}
          name={icon}
          size={20}
        />
      </View>
      <View style={styles.legalRowCopy}>
        <Text style={styles.legalRowLabel}>{label}</Text>
        <Text style={styles.legalRowSubtitle}>{subtitle}</Text>
      </View>
      <MaterialCommunityIcons
        color={theme.colors.muted}
        name="open-in-new"
        size={18}
      />
    </Pressable>
  );
}

export default function HelpAndLegalScreen() {
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const insets = useSafeAreaInsets();
  const { ready, user } = useAuth();
  const [topic, setTopic] = useState<SupportTopic>("billing");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!navigationState?.key) {
      return;
    }

    if (router.canGoBack()) {
      return;
    }

    router.replace("/dashboard");
  }, [navigationState?.key, router]);

  const normalizedSubject = subject.trim();
  const normalizedMessage = message.trim();
  const messageLengthLabel = useMemo(
    () => `${normalizedMessage.length}/5000`,
    [normalizedMessage.length],
  );

  if (!ready) {
    return null;
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  const openLegalDocument = async (url: string) => {
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      Alert.alert("Unable to open link", "Please try again in a moment.");
    }
  };

  const submit = async () => {
    if (!normalizedSubject) {
      setErrorMessage(
        "Add a short subject so support can triage this quickly.",
      );
      setSuccessMessage(null);
      return;
    }

    if (normalizedMessage.length < 20) {
      setErrorMessage(
        "Add a bit more detail so the support team has enough context to help.",
      );
      setSuccessMessage(null);
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await submitSupportRequest({
        topic,
        subject: normalizedSubject,
        message: normalizedMessage,
      });

      setSuccessMessage(
        response.message ||
          "Your note is on its way to support. Replies will go to your account email.",
      );
      setSubject("");
      setMessage("");
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const confirmClearDraft = () => {
    Alert.alert(
      "Clear this draft?",
      "This will remove the subject and message you have entered.",
      [
        {
          style: "cancel",
          text: "Keep draft",
        },
        {
          style: "destructive",
          text: "Clear draft",
          onPress: () => {
            setSubject("");
            setMessage("");
            setErrorMessage(null);
            setSuccessMessage(null);
          },
        },
      ],
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.screen}
    >
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={styles.topInkOrb} />
        <View style={styles.topTealOrb} />
        <View style={styles.bottomGoldOrb} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom: insets.bottom + theme.spacing.xxl,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Help & Support</Text>
          <Text style={styles.title}>Get help or review our policies</Text>
          <Text style={styles.subtitle}>
            Open terms or privacy in your browser, or send a support request
            directly from the app.
          </Text>
        </View>

        <SurfaceCard tone="accent" style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Contact support</Text>
            <Text style={styles.sectionSubtitle}>
              Share what happened and we will reply to {user.email}.
            </Text>
          </View>

          {successMessage ? (
            <NoticeBanner
              icon="check-circle-outline"
              message={successMessage}
              tone="success"
            />
          ) : null}

          {errorMessage ? (
            <NoticeBanner
              icon="alert-circle-outline"
              message={errorMessage}
              tone="danger"
            />
          ) : null}

          <View style={styles.topicWrap}>
            <Text style={styles.fieldLabel}>What do you need help with?</Text>
            <View style={styles.topicChips}>
              {topicOptions.map((option) => (
                <ChoiceChip
                  key={option.value}
                  label={option.label}
                  onPress={() => {
                    setTopic(option.value);
                  }}
                  selected={option.value === topic}
                />
              ))}
            </View>
            <Text style={styles.fieldHint}>
              {topicOptions.find((option) => option.value === topic)?.subtitle}
            </Text>
          </View>

          <Field
            autoCapitalize="sentences"
            hint="Keep it specific so support can scan it fast."
            label="Subject"
            maxLength={120}
            onChangeText={setSubject}
            placeholder="Example: My forecast is missing this Friday's paycheck"
            returnKeyType="next"
            value={subject}
          />

          <Field
            autoCapitalize="sentences"
            hint={`Minimum 20 characters. ${messageLengthLabel}`}
            label="Message"
            multiline
            numberOfLines={7}
            onChangeText={setMessage}
            placeholder="Tell support what you expected, what happened instead, and anything you already tried."
            style={styles.messageInput}
            textAlignVertical="top"
            value={message}
          />

          <View style={styles.formFooter}>
            <PrimaryButton
              disabled={submitting}
              icon="send-outline"
              label={submitting ? "Sending to support..." : "Send message"}
              onPress={() => {
                void submit();
              }}
            />
            <SecondaryButton
              disabled={submitting || (!subject && !message)}
              icon="refresh"
              label="Clear draft"
              onPress={confirmClearDraft}
            />
          </View>

          <Text style={styles.formNote}>
            Messages go to {SUPPORT_EMAIL} and are marked as coming from Payday
            Planner so the support team can route them correctly.
          </Text>
        </SurfaceCard>

        <SurfaceCard style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Legal</Text>
            <Text style={styles.sectionSubtitle}>
              These open in your browser so you can read the full documents.
            </Text>
          </View>
          <View style={styles.legalList}>
            <LegalRow
              icon="file-document-outline"
              label="Terms & Conditions"
              onPress={() => {
                void openLegalDocument(TERMS_URL);
              }}
              subtitle="Review the rules, plan terms, and account responsibilities."
            />
            <LegalRow
              icon="shield-lock-outline"
              label="Privacy Policy"
              onPress={() => {
                void openLegalDocument(PRIVACY_URL);
              }}
              subtitle="See what data is collected, stored, and shared."
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
  topInkOrb: {
    position: "absolute",
    top: -80,
    left: -32,
    width: 240,
    height: 240,
    borderRadius: 240,
    backgroundColor: withAlpha(theme.colors.ink, 0.12),
  },
  topTealOrb: {
    position: "absolute",
    top: 76,
    right: -42,
    width: 132,
    height: 132,
    borderRadius: 132,
    backgroundColor: withAlpha(theme.colors.primary, 0.14),
  },
  bottomGoldOrb: {
    position: "absolute",
    bottom: 72,
    left: -36,
    width: 180,
    height: 180,
    borderRadius: 180,
    backgroundColor: withAlpha(theme.colors.accent, 0.12),
  },
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  header: {
    gap: theme.spacing.xs,
  },
  eyebrow: {
    color: theme.colors.primaryStrong,
    ...theme.typography.eyebrow,
  },
  title: {
    color: theme.colors.text,
    ...theme.typography.title,
  },
  subtitle: {
    color: theme.colors.muted,
    ...theme.typography.body,
  },
  sectionCard: {
    gap: theme.spacing.md,
  },
  sectionHeader: {
    gap: theme.spacing.xs,
  },
  sectionTitle: {
    color: theme.colors.text,
    ...theme.typography.cardTitle,
    fontSize: 22,
  },
  sectionSubtitle: {
    color: theme.colors.muted,
    ...theme.typography.body,
  },
  legalList: {
    gap: theme.spacing.sm,
  },
  legalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceStrong,
  },
  legalRowIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.primarySoft,
  },
  legalRowCopy: {
    flex: 1,
    gap: 4,
  },
  legalRowLabel: {
    color: theme.colors.text,
    ...theme.typography.cardTitle,
    fontSize: 18,
  },
  legalRowSubtitle: {
    color: theme.colors.muted,
    ...theme.typography.body,
  },
  noticeBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.primary, 0.14),
    backgroundColor: theme.colors.surfaceStrong,
    padding: theme.spacing.md,
  },
  noticeBannerSuccess: {
    borderColor: withAlpha(theme.colors.success, 0.16),
    backgroundColor: theme.colors.successSoft,
  },
  noticeBannerDanger: {
    borderColor: withAlpha(theme.colors.danger, 0.16),
    backgroundColor: theme.colors.dangerSoft,
  },
  noticeLabel: {
    flex: 1,
    color: theme.colors.primaryStrong,
    ...theme.typography.body,
  },
  noticeLabelSuccess: {
    color: theme.colors.success,
  },
  noticeLabelDanger: {
    color: theme.colors.danger,
  },
  topicWrap: {
    gap: theme.spacing.sm,
  },
  topicChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  fieldLabel: {
    color: theme.colors.inkMuted,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  fieldHint: {
    color: theme.colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  messageInput: {
    minHeight: 156,
  },
  formFooter: {
    gap: theme.spacing.sm,
  },
  formNote: {
    color: theme.colors.muted,
    ...theme.typography.body,
  },
  pressed: {
    opacity: 0.84,
  },
});
