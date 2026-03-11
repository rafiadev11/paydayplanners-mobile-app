import axios from "axios";

type ErrorEnvelope = {
  message?: string;
  errors?: Record<string, string[]>;
};

export function getApiErrorMessage(error: unknown): string {
  if (!axios.isAxiosError<ErrorEnvelope>(error)) {
    return "Something went wrong. Please try again.";
  }

  const fieldErrors = error.response?.data?.errors;
  const firstFieldMessage = fieldErrors
    ? Object.values(fieldErrors).flat()[0]
    : null;

  return (
    firstFieldMessage ||
    error.response?.data?.message ||
    error.message ||
    "Something went wrong. Please try again."
  );
}
