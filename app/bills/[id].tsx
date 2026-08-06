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

import { BillForm } from "@features/money/bill-form";
import { useBillReminders } from "@features/notifications/bill-reminder-context";
import {
  deleteBill,
  fetchBill,
  fetchBillCategories,
  updateBill,
  type Bill,
  type BillCategory,
  type BillInput,
} from "@features/planning/api";
import { getApiErrorMessage } from "@shared/lib/api-error";
import { ErrorState, SecondaryButton } from "@shared/ui/primitives";
import { theme } from "@shared/ui/theme";

export default function EditBillScreen() {
  const router = useRouter();
  const billReminders = useBillReminders();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [bill, setBill] = useState<Bill | null>(null);
  const [categories, setCategories] = useState<BillCategory[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;

    setInitialLoading(true);

    try {
      const [nextBill, nextCategories] = await Promise.all([
        fetchBill(id),
        fetchBillCategories(),
      ]);

      setBill(nextBill);
      setCategories(nextCategories);
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

  const save = async (payload: BillInput) => {
    if (!id) return;

    setSaving(true);
    setError(null);

    try {
      await updateBill(id, payload);
      await billReminders.refreshReminders();
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
      await deleteBill(id);

      try {
        await billReminders.refreshReminders();
      } catch {
        // Deleting the bill succeeded; reminder refresh can recover later.
      }

      router.replace("/money?tab=bills");
    } catch (nextError) {
      setError(getApiErrorMessage(nextError));
      setDeleting(false);
    }
  };

  const promptDeletion = () => {
    Alert.alert(
      "Delete this bill?",
      "This bill and its future due dates will be permanently removed from your plan. This cannot be undone.",
      [
        {
          style: "cancel",
          text: "Keep bill",
        },
        {
          style: "destructive",
          text: "Delete bill",
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

  if (!bill) {
    return (
      <View style={styles.loadingScreen}>
        <ErrorState
          body={error ?? "This bill could not be loaded."}
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
          bill={bill}
          categories={categories}
          footer={
            <View style={styles.footer}>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <SecondaryButton
                disabled={saving || deleting}
                icon="trash-can-outline"
                label={deleting ? "Deleting…" : "Delete bill"}
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
