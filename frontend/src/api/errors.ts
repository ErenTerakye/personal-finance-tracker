import type { ApiErrorBody } from "../types";

const FALLBACK_MESSAGE = "The request could not be completed.";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function normalizeApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  if (error instanceof DOMException && error.name === "AbortError") {
    return new ApiError(error.message || "The request was cancelled.", 0);
  }
  if (error instanceof Error) {
    return new ApiError(error.message || FALLBACK_MESSAGE, 0);
  }
  if (isApiErrorBody(error)) {
    return new ApiError(readApiErrorBody(error), 0);
  }
  return new ApiError(FALLBACK_MESSAGE, 0);
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return typeof value === "object" && value !== null;
}

function readApiErrorBody(body: ApiErrorBody): string {
  if (typeof body.error === "string") {
    return body.error;
  }
  if (body.error?.message) {
    return body.error.message;
  }
  if (typeof body.detail === "string") {
    return body.detail;
  }
  if (body.detail?.error) {
    return body.detail.error;
  }
  return FALLBACK_MESSAGE;
}
