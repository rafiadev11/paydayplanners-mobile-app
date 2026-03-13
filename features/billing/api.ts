import { api } from "@shared/api/client";

import type { BillingStatus } from "./types";

type ItemEnvelope<T> = {
  data: T;
};

function item<T>(payload: ItemEnvelope<T> | T) {
  if (payload && typeof payload === "object" && "data" in payload) {
    return payload.data as T;
  }

  return payload as T;
}

export async function fetchBillingStatus() {
  const { data } = await api.get<ItemEnvelope<BillingStatus> | BillingStatus>(
    "/api/v1/billing/status",
  );

  return item(data);
}

export async function startBillingTrial() {
  const { data } = await api.post<ItemEnvelope<BillingStatus> | BillingStatus>(
    "/api/v1/billing/trial/start",
  );

  return item(data);
}

export async function createCheckoutSession(interval: "month" | "year") {
  const { data } = await api.post<{ url: string }>(
    "/api/v1/billing/checkout-session",
    { interval },
  );

  return data.url;
}

export async function syncCheckoutSession(sessionId: string) {
  const { data } = await api.post<ItemEnvelope<BillingStatus> | BillingStatus>(
    "/api/v1/billing/checkout-session/sync",
    { session_id: sessionId },
  );

  return item(data);
}

export async function createCustomerPortalSession() {
  const { data } = await api.post<{ url: string }>(
    "/api/v1/billing/customer-portal",
    {},
  );

  return data.url;
}
