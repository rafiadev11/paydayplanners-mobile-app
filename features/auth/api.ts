import { api, setAuthToken } from "@shared/api/client";
import { getDeviceName } from "@shared/device/id";
import type { BillingSummary } from "@features/billing/types";

export type User = {
  id: number | string;
  name: string;
  email: string;
  timezone?: string | null;
  billing?: BillingSummary;
  email_verified_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ResourceEnvelope<T> = {
  data?: T;
  user?: T;
  token?: string;
};

const unwrap = <T>(payload: ResourceEnvelope<T> | T): T =>
  (payload as ResourceEnvelope<T>).data ??
  (payload as ResourceEnvelope<T>).user ??
  (payload as T);

export type RegisterInput = {
  name: string;
  email: string;
  password: string;
  passwordConfirmation: string;
};

type AuthResponse = {
  token: string;
  user?: User;
  data?: User;
};

type AuthResponseEnvelope = {
  data?: AuthResponse;
  token?: string;
  user?: User;
};

function isAuthResponse(payload: unknown): payload is AuthResponse {
  if (!payload || typeof payload !== "object") return false;

  return "token" in payload;
}

function unwrapAuthResponse(payload: AuthResponseEnvelope | AuthResponse) {
  const auth: AuthResponse =
    "data" in payload && isAuthResponse(payload.data)
      ? payload.data
      : (payload as AuthResponse);

  return {
    token: auth.token ?? "",
    user: auth.user ?? auth.data ?? null,
  };
}

export type DashboardResponse = {
  window: {
    start_date: string;
    end_date: string;
  };
  summary: {
    projected_income: string;
    assigned_bills_total: string;
    unassigned_bills_total: string;
    remaining_after_assigned: string;
  };
  next_paycheck: {
    id: number | string;
    occurrence_date: string;
    amount: string;
    status: string;
    assigned_total: string;
    remaining_amount: string;
    pay_schedule?: {
      id?: number | string | null;
      name?: string | null;
      frequency?: string | null;
    } | null;
  } | null;
  next_paycheck_bill_occurrences: {
    id: number | string;
    due_date: string;
    amount: string;
    status: string;
    bill?: {
      id?: number | string;
      name?: string;
    } | null;
  }[];
  bills_due_before_next_paycheck: {
    id: number | string;
    due_date: string;
    amount: string;
    status: string;
    bill?: {
      id?: number | string;
      name?: string;
    } | null;
  }[];
  unassigned_bill_occurrences: {
    id: number | string;
    due_date: string;
    amount: string;
    status: string;
    bill?: {
      id?: number | string;
      name?: string;
    } | null;
  }[];
};

export async function login(email: string, password: string) {
  const device_name = await getDeviceName();
  const { data } = await api.post<AuthResponseEnvelope>("/api/v1/login", {
    email,
    password,
    device_name,
  });

  const auth = unwrapAuthResponse(data);
  if (!auth.token || !auth.user) {
    throw new Error("Invalid login response from API.");
  }
  await setAuthToken(auth.token);
  return auth.user;
}

export async function register(input: RegisterInput) {
  const device_name = await getDeviceName();
  const { data } = await api.post<AuthResponseEnvelope>("/api/v1/register", {
    name: input.name,
    email: input.email,
    password: input.password,
    password_confirmation: input.passwordConfirmation,
    device_name,
  });

  const auth = unwrapAuthResponse(data);
  if (!auth.token || !auth.user) {
    throw new Error("Invalid registration response from API.");
  }
  await setAuthToken(auth.token);
  return auth.user;
}

export async function me() {
  const { data } = await api.get<ResourceEnvelope<User> | User>("/api/v1/me");
  return unwrap<User>(data);
}

export async function logout() {
  try {
    await api.post("/api/v1/logout");
  } finally {
    await setAuthToken(null);
  }
}

export async function fetchDashboard() {
  const { data } = await api.get<DashboardResponse>("/api/v1/dashboard");
  return data;
}
