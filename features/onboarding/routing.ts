import { type User } from "@features/auth/api";
import { type Href } from "expo-router";

export function shouldEnterGuidedOnboarding(user: User | null | undefined) {
  return Boolean(
    user?.onboarding?.enabled &&
    Number(user.onboarding.version ?? 0) < 1 &&
    user.onboarding.status === "pending",
  );
}

export function authenticatedEntryRoute(user: User): Href {
  return shouldEnterGuidedOnboarding(user)
    ? ("/onboarding" as Href)
    : "/dashboard";
}
