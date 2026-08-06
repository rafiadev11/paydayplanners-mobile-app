import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
} from "react-native";

import { BillForm } from "@features/money/bill-form";
import { useBillReminders } from "@features/notifications/bill-reminder-context";
import {
  createBill,
  fetchBillCategories,
  type BillCategory,
  type BillInput,
} from "@features/planning/api";
import { getApiErrorMessage } from "@shared/lib/api-error";
import { theme } from "@shared/ui/theme";

export default function NewBillScreen() {
  const router = useRouter();
  const billReminders = useBillReminders();
  const [categories, setCategories] = useState<BillCategory[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const loadCategories = async () => {
        try {
          const payload = await fetchBillCategories();
          if (active) setCategories(payload);
        } catch {
          if (active) setCategories([]);
        }
      };

      void loadCategories();

      return () => {
        active = false;
      };
    }, []),
  );

  const save = async (payload: BillInput) => {
    setSaving(true);
    setError(null);

    try {
      await createBill(payload);
      await billReminders.refreshReminders();
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
        <BillForm
          categories={categories}
          footer={error ? <Text style={styles.errorText}>{error}</Text> : null}
          onCancel={() => {
            router.back();
          }}
          onSubmit={(payload) => {
            void save(payload);
          }}
          submitLabel="Save bill"
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
