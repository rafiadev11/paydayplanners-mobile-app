import { Redirect } from "expo-router";

/** Paychecks moved into Money as the Income segment. */
export default function PaychecksRedirect() {
  return <Redirect href="/money?tab=income" />;
}
