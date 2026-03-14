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

export async function createCustomerPortalSession(returnUrl?: string) {
  const { data } = await api.post<{ url: string }>(
    "/api/v1/billing/customer-portal",
    returnUrl ? { return_url: returnUrl } : {},
  );

  return data.url;
}

export async function createCustomerPortalActionSession(
  action: "manage" | "cancel" | "switch",
  options?: {
    returnUrl?: string;
    interval?: "month" | "year";
  },
) {
  const { data } = await api.post<{ url: string }>(
    "/api/v1/billing/customer-portal",
    {
      ...(options?.returnUrl ? { return_url: options.returnUrl } : {}),
      action,
      ...(options?.interval ? { interval: options.interval } : {}),
    },
  );

  return data.url;
}

export async function syncCustomerPortalSubscription() {
  const { data } = await api.post<ItemEnvelope<BillingStatus> | BillingStatus>(
    "/api/v1/billing/customer-portal/sync",
    {},
  );

  return item(data);
}

export async function resumeBillingSubscription() {
  const { data } = await api.post<ItemEnvelope<BillingStatus> | BillingStatus>(
    "/api/v1/billing/subscription/resume",
    {},
  );

  return item(data);
}
