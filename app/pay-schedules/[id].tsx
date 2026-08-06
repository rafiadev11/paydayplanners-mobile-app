import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { PayScheduleForm } from "@features/money/pay-schedule-form";
import {
  deletePaySchedule,
  fetchPaySchedule,
  updatePaySchedule,
  type PaySchedule,
  type PayScheduleInput,
} from "@features/planning/api";
import { getApiErrorMessage } from "@shared/lib/api-error";
import { ErrorState, SecondaryButton } from "@shared/ui/primitives";
import { theme } from "@shared/ui/theme";

export default function EditPayScheduleScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [schedule, setSchedule] = useState<PaySchedule | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;

    setInitialLoading(true);

    try {
      setSchedule(await fetchPaySchedule(id));
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

  const save = async (payload: PayScheduleInput) => {
    if (!id) return;

    setSaving(true);
    setError(null);

    try {
      await updatePaySchedule(id, payload);
      router.back();
    } catch (nextError) {
      setError(getApiErrorMessage(nextError));
    } finally {
      setSaving(false);
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

  if (!schedule) {
    return (
      <View style={styles.loadingScreen}>
        <ErrorState
          body={error ?? "This income source could not be loaded."}
          onRetry={() => {
            void load();
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
        automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        contentContainerStyle={styles.content}
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <PayScheduleForm
          footer={
            <View style={styles.footer}>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <SecondaryButton
                disabled={saving || deleting}
                icon="trash-can-outline"
                label={deleting ? "Deleting…" : "Delete income source"}
                onPress={promptDeletion}
              />
            </View>
          }
          onCancel={() => {
            router.back();
          }}
          onSubmit={(payload) => {
            void save(payload);
          }}
          schedule={schedule}
          submitLabel="Save changes"
          submitting={saving}
        />
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
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
  },
  content: {
    flexGrow: 1,
    padding: theme.spacing.lg,
    paddingBottom: 72,
  },
  footer: {
    gap: theme.spacing.sm,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: 14,
    fontWeight: "600",
  },
});
