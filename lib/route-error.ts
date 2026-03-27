import { APICallError } from "ai";

export function getReadableRouteError(error: unknown): string {
  if (APICallError.isInstance(error)) {
    const upstreamMessage = extractUpstreamMessage(error.responseBody);
    const statusPrefix = error.statusCode ? `Provider error ${error.statusCode}` : "Provider error";

    return upstreamMessage
      ? `${statusPrefix}: ${upstreamMessage}`
      : `${statusPrefix}: ${error.message}`;
  }

  if (error instanceof Error && error.cause) {
    return getReadableRouteError(error.cause);
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected server error.";
}

function extractUpstreamMessage(responseBody?: string): string | null {
  if (!responseBody?.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(responseBody) as {
      error?: { message?: string } | string;
      message?: string;
    };

    if (typeof parsed.error === "string") {
      return parsed.error;
    }

    if (typeof parsed.error?.message === "string") {
      return parsed.error.message;
    }

    if (typeof parsed.message === "string") {
      return parsed.message;
    }
  } catch {
    return responseBody.slice(0, 240);
  }

  return responseBody.slice(0, 240);
}
