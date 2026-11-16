export function notificationRoute(
  data: Record<string, unknown>,
  userId: string,
) {
  if (String(data.userId) !== userId) return null;
  if (
    data.type === "payday-reminder" &&
    typeof data.payday === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(data.payday)
  )
    return { pathname: "/calendar" as const, params: { date: data.payday } };
  if (
    data.type === "bill-reminder" &&
    (data.screen === "/bills" || data.screen === "/money?tab=bills")
  )
    return { pathname: "/money" as const, params: { tab: "bills" } };
  return null;
}
