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
  planning_revision?: number | string | null;
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
  kind?: "bill" | "planned_expense";
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

export type BillOccurrenceStatus = "projected" | "paid" | "overdue" | "skipped";

export type BillOccurrence = {
  id: number | string;
  bill_id?: number | string;
  due_date: string;
  scheduled_due_date?: string;
  adjusted_due_date?: string | null;
  amount: string;
  actual_amount?: string | null;
  effective_amount?: string;
  allocated_amount?: string | null;
  unfunded_amount?: string | null;
  notes?: string | null;
  assigned_paycheck_occurrence_id?: number | string | null;
  assigned_paycheck_occurrence?: PaycheckOccurrence | null;
  is_assignment_manual?: boolean;
  is_adjusted?: boolean;
  status: string;
  bill?: Bill | null;
  allocations?: {
    id: number | string;
    amount: string;
    paycheck_occurrence_id: number | string;
    paycheck_occurrence?: PaycheckOccurrence | null;
  }[];
};

export type BillOccurrenceAdjustmentInput = {
  amount: string;
  due_date: string;
  status?: BillOccurrenceStatus;
  expected_planning_revision: number;
};

export type BillOccurrenceAdjustmentImpact = {
  id: number | string;
  occurrence_date: string;
  name?: string | null;
  before_remaining: string;
  after_remaining: string;
  change_amount: string;
};

export type BillOccurrenceAdjustmentPreview = {
  proposed: {
    amount: string;
    due_date: string;
    status: BillOccurrenceStatus;
    is_adjusted: boolean;
    unfunded_amount: string;
  };
  before_paycheck?: {
    id: number | string;
    occurrence_date: string;
    name?: string | null;
  } | null;
  after_paycheck?: {
    id: number | string;
    occurrence_date: string;
    name?: string | null;
  } | null;
  impacts: BillOccurrenceAdjustmentImpact[];
  planning_revision: number;
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
  frequency: "weekly" | "biweekly" | "semimonthly" | "monthly" | "once";
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
  kind?: "bill" | "planned_expense";
  amount: string;
  frequency: "weekly" | "biweekly" | "monthly" | "yearly" | "once";
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
  planning_revision?: number | string;
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
  planning_revision?: number | string;
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

export type PurchasePlanVerdict =
  | "fits_comfortably"
  | "fits_tight"
  | "save_across_paychecks"
  | "choose_later_date"
  | "plan_needs_attention"
  | "add_income_first";

export type PurchasePlanPaycheckImpact = {
  id: number | string;
  occurrence_date: string;
  name?: string | null;
  before_remaining: string;
  after_remaining: string;
  above_cushion: boolean;
};

export type PurchasePlanContribution = PurchasePlanPaycheckImpact & {
  contribution_amount: string;
};

export type PurchasePlanInput = {
  name: string;
  amount: string;
  target_date: string;
  minimum_cushion: string;
  expected_planning_revision: number;
};

export type PurchasePlanPreview = {
  purchase: {
    name: string;
    amount: string;
    target_date: string;
  };
  verdict: PurchasePlanVerdict;
  minimum_cushion: string;
  direct_impact:
    | (PurchasePlanPaycheckImpact & {
        purchase_amount: string;
        non_negative: boolean;
      })
    | null;
  saving_plan: {
    feasible_by_target: boolean;
    target_date: string;
    planned_total: string;
    shortfall: string;
    earliest_ready_date?: string | null;
    contributions: PurchasePlanContribution[];
    later_contributions: PurchasePlanContribution[];
  };
  baseline_warnings: {
    kind: "short_paycheck" | "uncovered_bill";
    date: string;
    name?: string | null;
    amount: string;
  }[];
  can_commit_planned_expense: boolean;
  can_commit_savings_goal: boolean;
  planning_revision: number;
};

export type PurchasePlanCommit = {
  commit_as: "planned_expense" | "savings_goal";
  resource: Bill | SavingsGoal;
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

export async function previewPurchasePlan(
  input: PurchasePlanInput,
  signal?: AbortSignal,
) {
  const { data } = await api.post<ItemEnvelope<PurchasePlanPreview>>(
    "/api/v1/purchase-plans/preview",
    input,
    { signal },
  );

  return item(data);
}

export async function commitPurchasePlan(
  input: PurchasePlanInput & {
    commit_as: PurchasePlanCommit["commit_as"];
    request_id: string;
  },
) {
  const { data } = await api.post<ItemEnvelope<PurchasePlanCommit>>(
    "/api/v1/purchase-plans/commit",
    input,
  );

  return item(data);
}

export type ForecastWindow = {
  start_date: string;
  end_date: string;
};

/**
 * Forecast over an explicit window. `buildWindow` anchors at today, which cannot
 * render the days already gone by in the current month, so the calendar names
 * its own start date.
 */
export async function fetchForecastWindow(window: ForecastWindow) {
  const { data } = await api.get<ForecastResponse>("/api/v1/forecast", {
    params: window,
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

export async function fetchBillOccurrence(id: number | string) {
  const { data } = await api.get<ItemEnvelope<BillOccurrence>>(
    `/api/v1/bill-occurrences/${id}`,
  );

  return item(data);
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

export async function deletePaySchedule(id: number | string) {
  await api.delete(`/api/v1/pay-schedules/${id}`);
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

export async function deleteBill(id: number | string) {
  await api.delete(`/api/v1/bills/${id}`);
}

/**
 * Only ever send `status`. Passing `actual_amount` alongside it strands the
 * occurrence: the assignment action skips non-projected rows, so its allocation
 * freezes at the old amount and the bill stays unfunded forever.
 */
export async function updateBillOccurrenceStatus(
  id: number | string,
  status: BillOccurrenceStatus,
) {
  const { data } = await api.patch<
    ItemEnvelope<BillOccurrence> | BillOccurrence
  >(`/api/v1/bill-occurrences/${id}`, { status });

  return item(data);
}

export async function previewBillOccurrenceAdjustment(
  id: number | string,
  input: BillOccurrenceAdjustmentInput,
  signal?: AbortSignal,
) {
  const { data } = await api.post<
    ItemEnvelope<BillOccurrenceAdjustmentPreview>
  >(`/api/v1/bill-occurrences/${id}/preview`, input, { signal });

  return item(data);
}

export async function updateBillOccurrence(
  id: number | string,
  input: BillOccurrenceAdjustmentInput,
) {
  const { data } = await api.patch<ItemEnvelope<BillOccurrence>>(
    `/api/v1/bill-occurrences/${id}`,
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
