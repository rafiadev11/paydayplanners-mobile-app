import { Redirect } from "expo-router";

/** Goals moved into Money as the Goals segment. */
export default function GoalsRedirect() {
  return <Redirect href="/money?tab=goals" />;
}
