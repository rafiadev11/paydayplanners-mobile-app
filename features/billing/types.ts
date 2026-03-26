export type BillingSummary = {
  plan: "free" | "pro";
  has_pro_access: boolean;
  has_complimentary_access: boolean;
  has_active_subscription: boolean;
  on_trial: boolean;
  access_source: "free" | "trial" | "subscription" | "complimentary";
  trial_available: boolean;
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
  subscription_status?: string | null;
};

export type BillingStatus = BillingSummary & {
  currency: string;
  subscription?: {
    type: string;
    stripe_status: string;
    stripe_price?: string | null;
    current_interval?: "month" | "year" | null;
    current_plan_name?: string | null;
    current_amount_cents?: number | null;
    ends_at?: string | null;
    trial_ends_at?: string | null;
    on_grace_period?: boolean;
  } | null;
  limits: {
    pay_schedules?: number;
    bills?: number;
    savings_goals?: number;
    forecast_days?: number;
    manual_allocations?: boolean;
  };
  plans: {
    slug: "free" | "pro";
    name: string;
    description?: string | null;
    features?: string[];
    limits?: BillingStatus["limits"];
    prices?: {
      interval: "month" | "year";
      name: string;
      amount_cents: number;
      currency: string;
      checkout_enabled: boolean;
    }[];
  }[];
};
