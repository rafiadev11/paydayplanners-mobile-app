import { Text, View } from "react-native";
import {
  SurfaceCard,
  PrimaryButton,
  SecondaryButton,
} from "@shared/ui/primitives";
import { theme } from "@shared/ui/theme";
import { getAppTimezone } from "@shared/lib/timezone";
import { usePaydayReminders } from "./payday-reminder-context";

export function PaydayReminderCard() {
  const { preferences, ready, busy, message, save, refresh, openSettings } =
    usePaydayReminders();
  const disabled = !ready || busy;
  return (
    <SurfaceCard>
      <View style={{ gap: 12 }}>
        <Text
          style={{ color: theme.colors.ink, fontSize: 20, fontWeight: "700" }}
        >
          Payday reminders
        </Text>
        <Text style={{ color: theme.colors.muted }}>
          A gentle nudge to review your bills and available money. Optional,
          with no amounts shown on your lock screen.
        </Text>
        <SecondaryButton
          disabled={disabled}
          label={
            preferences.dayBefore
              ? "Timing: the day before payday"
              : "Timing: on payday"
          }
          onPress={() => {
            void save({ ...preferences, dayBefore: !preferences.dayBefore });
          }}
        />
        <Text style={{ color: theme.colors.muted }}>
          Reminder time ({getAppTimezone()})
        </Text>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {[
            { hour: 8, label: "8 am" },
            { hour: 9, label: "9 am" },
            { hour: 18, label: "6 pm" },
          ].map((time) => (
            <SecondaryButton
              key={time.hour}
              disabled={disabled}
              label={`${preferences.hour === time.hour ? "✓ " : ""}${time.label}`}
              onPress={() => {
                void save({ ...preferences, hour: time.hour, minute: 0 });
              }}
            />
          ))}
        </View>
        <PrimaryButton
          disabled={disabled}
          label={
            busy
              ? "Updating reminders…"
              : preferences.enabled
                ? "Turn off payday reminders"
                : "Turn on payday reminders"
          }
          onPress={() => {
            void save({ ...preferences, enabled: !preferences.enabled });
          }}
        />
        {message ? (
          <Text
            accessibilityLiveRegion="polite"
            style={{ color: theme.colors.muted }}
          >
            {message}
          </Text>
        ) : null}
        {preferences.enabled ? (
          <SecondaryButton
            disabled={disabled}
            label="Refresh payday reminders"
            onPress={refresh}
          />
        ) : null}
        <SecondaryButton label="Notification settings" onPress={openSettings} />
      </View>
    </SurfaceCard>
  );
}
