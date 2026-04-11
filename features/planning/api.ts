import { api } from "@shared/api/client";
import { addDaysToIsoDate, todayInAppTimezone } from "@shared/lib/timezone";

type CollectionEnvelope<T> = {
  data: T[];
};

type ItemEnvelope<T> = {
  data: T;
};

export type User = {
  id: number | string;
  name: string;
  email: string;
};

export type BillCategory = {
  id: number | string;
  name: string;
  color?: string | null;
  is_default: boolean;
};

export type Bill = {
  id: number | string;
  bill_category_id?: number | string | null;
  name: string;
  amount: string;
  frequency: string;
  due_day?: number | null;
  weekday?: number | null;
  start_date: string;
  end_date?: string | null;
  interval_value?: number | null;
  is_subscription: boolean;
  is_active: boolean;
  notes?: string | null;
  bill_category?: BillCategory | null;
};

export type PaySchedule = {
  id: number | string;
  name: string;
  amount: string;
  frequency: string;
  is_one_time?: boolean;
  start_date: string;
  end_date?: string | null;
  weekday?: number | null;
  month_day?: number | null;
  interval_value?: number | null;
  is_active: boolean;
};

export type PaycheckOccurrence = {
  id: number | string;
  pay_schedule_id?: number | string;
  occurrence_date: string;
  amount: string;
  actual_amount?: string | null;
  effective_amount?: string;
  notes?: string | null;
  status: string;
  pay_schedule?: PaySchedule | null;
};

export type BillOccurrence = {
  id: number | string;
  bill_id?: number | string;
  due_date: string;
  amount: string;
  actual_amount?: string | null;
  effective_amount?: string;
  allocated_amount?: string | null;
  unfunded_amount?: string | null;
  notes?: string | null;
  assigned_paycheck_occurrence_id?: number | string | null;
  is_assignment_manual?: boolean;
  status: string;
  bill?: Bill | null;
  allocations?: {
    id: number | string;
    amount: string;
    paycheck_occurrence_id: number | string;
    paycheck_occurrence?: PaycheckOccurrence | null;
  }[];
};

export type SavingsGoal = {
  id: number | string;
  name: string;
  target_amount: string;
  saved_amount: string;
  contribution_amount?: string | null;
  remaining_target: string;
  start_date: string;
  target_date?: string | null;
  completed_at?: string | null;
  is_completed: boolean;
  priority: number;
  is_active: boolean;
  notes?: string | null;
  planned_contributions_total?: string;
  unallocated_amount?: string;
  contributions?: {
    paycheck_occurrence_id: number | string;
    occurrence_date: string;
    amount: string;
  }[];
};

export type PayScheduleInput = {
  name: string;
  amount: string;
  frequency: "weekly" | "biweekly" | "monthly" | "once";
  start_date: string;
  end_date?: string | null;
  weekday?: number | null;
  month_day?: number | null;
  interval_value?: number | null;
  is_active?: boolean;
};

export type BillInput = {
  name: string;
  bill_category_id?: number | string | null;
  amount: string;
  frequency: "weekly" | "biweekly" | "monthly" | "once";
  due_day?: number | null;
  weekday?: number | null;
  start_date: string;
  end_date?: string | null;
  interval_value?: number | null;
  is_subscription?: boolean;
  is_active?: boolean;
  notes?: string | null;
};

export type SavingsGoalInput = {
  name: string;
  target_amount: string;
  saved_amount?: string;
  contribution_amount?: string | null;
  start_date: string;
  target_date?: string | null;
  priority?: number;
  is_active?: boolean;
  notes?: string | null;
};

export type DashboardResponse = {
  window: {
    start_date: string;
    end_date: string;
  };
  summary: {
    projected_income: string;
    assigned_bills_total: string;
    unassigned_bills_total: string;
    assigned_expenses_total: string;
    unassigned_expenses_total: string;
    savings_goal_contributions_total: string;
    unallocated_savings_goal_total: string;
    remaining_after_assigned: string;
  };
  next_paycheck:
    | (PaycheckOccurrence & {
        assigned_total: string;
        savings_goal_total: string;
        remaining_amount: string;
      })
    | null;
  next_paycheck_bill_occurrences: BillOccurrence[];
  next_paycheck_savings_goal_contributions: {
    savings_goal_id: number | string;
    name: string;
    amount: string;
    target_date?: string | null;
    priority: number;
  }[];
  bills_due_before_next_paycheck: BillOccurrence[];
  unassigned_bill_occurrences: BillOccurrence[];
  savings_goals: SavingsGoal[];
  insights: {
    tightest_paycheck?: {
      id: number | string;
      occurrence_date: string;
      remaining_amount: string;
      pay_schedule_name?: string | null;
    } | null;
    largest_expense?: {
      id: number | string;
      name?: string | null;
      due_date: string;
      amount: string;
    } | null;
  };
};

export type ForecastPaycheck = PaycheckOccurrence & {
  assigned_total: string;
  savings_goal_total: string;
  savings_goal_contributions: {
    savings_goal_id: number | string;
    name: string;
    amount: string;
    target_date?: string | null;
    priority: number;
  }[];
  remaining_amount: string;
  assigned_bill_occurrences: {
    allocation_id: number | string;
    allocation_amount: string;
    bill_occurrence: BillOccurrence;
  }[];
};

export type ForecastResponse = {
  window: {
    start_date: string;
    end_date: string;
  };
  summary: DashboardResponse["summary"];
  paychecks: ForecastPaycheck[];
  bill_occurrences: BillOccurrence[];
  unassigned_bill_occurrences: BillOccurrence[];
  savings_goals: SavingsGoal[];
  insights: DashboardResponse["insights"];
};

function collection<T>(payload: CollectionEnvelope<T>) {
  return payload.data;
}

function item<T>(payload: ItemEnvelope<T> | T) {
  if (payload && typeof payload === "object" && "data" in payload) {
    return payload.data as T;
  }

  return payload as T;
}

function buildWindow(days = 365) {
  const startDate = todayInAppTimezone();

  return {
    start_date: startDate,
    end_date: addDaysToIsoDate(startDate, days),
  };
}

export async function fetchDashboard() {
  const { data } = await api.get<DashboardResponse>("/api/v1/dashboard");
  return data;
}

export async function fetchForecast(days = 365) {
  const { data } = await api.get<ForecastResponse>("/api/v1/forecast", {
    params: buildWindow(days),
  });
  return data;
}

export async function fetchPaySchedules() {
  const { data } = await api.get<CollectionEnvelope<PaySchedule>>(
    "/api/v1/pay-schedules",
  );
  return collection(data);
}

export async function fetchPaySchedule(id: number | string) {
  const { data } = await api.get<ItemEnvelope<PaySchedule> | PaySchedule>(
    `/api/v1/pay-schedules/${id}`,
  );

  return item(data);
}

export async function fetchBills() {
  const { data } = await api.get<CollectionEnvelope<Bill>>("/api/v1/bills");
  return collection(data);
}

export async function fetchBill(id: number | string) {
  const { data } = await api.get<ItemEnvelope<Bill> | Bill>(
    `/api/v1/bills/${id}`,
  );
  return item(data);
}

export async function fetchBillCategories() {
  const { data } = await api.get<CollectionEnvelope<BillCategory>>(
    "/api/v1/bill-categories",
  );
  return collection(data);
}

export async function fetchSavingsGoals() {
  const { data } = await api.get<CollectionEnvelope<SavingsGoal>>(
    "/api/v1/savings-goals",
  );
  return collection(data);
}

export async function fetchSavingsGoal(id: number | string) {
  const { data } = await api.get<ItemEnvelope<SavingsGoal> | SavingsGoal>(
    `/api/v1/savings-goals/${id}`,
  );

  return item(data);
}

export async function fetchPaycheckOccurrences(days = 365) {
  const { data } = await api.get<CollectionEnvelope<PaycheckOccurrence>>(
    "/api/v1/paycheck-occurrences",
    {
      params: buildWindow(days),
    },
  );
  return collection(data);
}

export async function fetchBillOccurrences(days = 365) {
  const { data } = await api.get<CollectionEnvelope<BillOccurrence>>(
    "/api/v1/bill-occurrences",
    {
      params: buildWindow(days),
    },
  );
  return collection(data);
}

export async function createPaySchedule(input: PayScheduleInput) {
  const { data } = await api.post<ItemEnvelope<PaySchedule>>(
    "/api/v1/pay-schedules",
    input,
  );

  return item(data);
}

export async function updatePaySchedule(
  id: number | string,
  input: PayScheduleInput,
) {
  const { data } = await api.put<ItemEnvelope<PaySchedule> | PaySchedule>(
    `/api/v1/pay-schedules/${id}`,
    input,
  );

  return item(data);
}

export async function createBill(input: BillInput) {
  const { data } = await api.post<ItemEnvelope<Bill>>("/api/v1/bills", input);
  return item(data);
}

export async function updateBill(id: number | string, input: BillInput) {
  const { data } = await api.put<ItemEnvelope<Bill> | Bill>(
    `/api/v1/bills/${id}`,
    input,
  );

  return item(data);
}

export async function createSavingsGoal(input: SavingsGoalInput) {
  const { data } = await api.post<ItemEnvelope<SavingsGoal>>(
    "/api/v1/savings-goals",
    input,
  );

  return item(data);
}

export async function updateSavingsGoal(
  id: number | string,
  input: SavingsGoalInput,
) {
  const { data } = await api.put<ItemEnvelope<SavingsGoal> | SavingsGoal>(
    `/api/v1/savings-goals/${id}`,
    input,
  );

  return item(data);
}
