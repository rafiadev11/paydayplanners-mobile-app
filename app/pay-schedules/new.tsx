import { useRouter } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
} from "react-native";

import { PayScheduleForm } from "@features/money/pay-schedule-form";
import {
  createPaySchedule,
  type PayScheduleInput,
} from "@features/planning/api";
import { getApiErrorMessage } from "@shared/lib/api-error";
import { theme } from "@shared/ui/theme";

export default function NewPayScheduleScreen() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (payload: PayScheduleInput) => {
    setSaving(true);
    setError(null);

    try {
      await createPaySchedule(payload);
      router.back();
    } catch (nextError) {
      setError(getApiErrorMessage(nextError));
    } finally {
      setSaving(false);
    }
  };

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
          footer={error ? <Text style={styles.errorText}>{error}</Text> : null}
          onCancel={() => {
            router.back();
          }}
          onSubmit={(payload) => {
            void save(payload);
          }}
          submitLabel="Save income"
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
  content: {
    flexGrow: 1,
    padding: theme.spacing.lg,
    paddingBottom: 72,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: 14,
    fontWeight: "600",
  },
});
