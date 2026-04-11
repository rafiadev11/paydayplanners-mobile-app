import { api, type ApiRequestConfig } from "@shared/api/client";

export type SupportTopic =
  | "bug_report"
  | "feature_request"
  | "account"
  | "other";

export type ContactSupportInput = {
  topic: SupportTopic;
  subject: string;
  message: string;
};

export async function submitSupportRequest(input: ContactSupportInput) {
  const config: ApiRequestConfig = {
    omitClientPlatform: true,
  };
  const { data } = await api.post<{ message: string }>(
    "/api/v1/support/contact",
    {
      topic: input.topic,
      subject: input.subject,
      message: input.message,
    },
    config,
  );

  return data;
}
