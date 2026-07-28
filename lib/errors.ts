import axios from "axios";

export type ApiValidationError = {
  field: string;
  messages: string[];
};

type ApiErrorBody = {
  message?: string | string[];
  error?: string;
  validationErrors?: ApiValidationError[];
};

export function getApiValidationErrors(error: unknown) {
  if (!axios.isAxiosError<ApiErrorBody>(error)) return [];
  return error.response?.data?.validationErrors ?? [];
}

export function getApiErrorMessage(error: unknown, fallback = "Something went wrong.") {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    const validationErrors = getApiValidationErrors(error);
    if (validationErrors.length) {
      return validationErrors.flatMap((item) => item.messages).join(" ");
    }
    const message = error.response?.data?.message;
    if (Array.isArray(message)) return message.join(" ");
    if (message) return message;
    if (error.response?.data?.error) return error.response.data.error;
    if (!error.response) return "Cannot connect to the API. Check that the server is running.";
  }
  return error instanceof Error && error.message ? error.message : fallback;
}
