import { type User } from "@features/auth/api";
import { type DashboardResponse } from "@features/planning/api";
import {
  buildOnboardingPayload,
  type OnboardingDraft,
} from "@features/onboarding/model";
import { api } from "@shared/api/client";

type CompleteOnboardingResponse = {
  data: {
    user: User;
    dashboard: DashboardResponse;
  };
  planning_revision: number | string;
};

type UserEnvelope = { data: User };

export async function completeOnboarding(draft: OnboardingDraft) {
  const { data } = await api.post<CompleteOnboardingResponse>(
    "/api/v1/onboarding/complete",
    buildOnboardingPayload(draft),
  );

  return data.data;
}

export async function skipOnboarding() {
  const { data } = await api.patch<UserEnvelope>("/api/v1/onboarding/skip");
  return data.data;
}
