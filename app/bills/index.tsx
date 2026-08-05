import { Redirect } from "expo-router";

/** Bills moved into Money. Kept so older links and notifications still land. */
export default function BillsRedirect() {
  return <Redirect href="/money?tab=bills" />;
}
