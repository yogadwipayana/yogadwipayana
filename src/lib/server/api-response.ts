import { NextResponse } from "next/server";

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

const isProduction = process.env.NODE_ENV === "production";

export function fail(err: unknown) {
  if (err instanceof ApiError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message, details: err.details } },
      { status: err.status },
    );
  }

  const message = err instanceof Error ? err.message : "Unknown error";
  if (message === "UNAUTHORIZED") {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 },
    );
  }
  if (message === "FORBIDDEN") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Insufficient permissions" } },
      { status: 403 },
    );
  }

  if (err instanceof Error) {
    console.error("[API Error]", err.message, err.stack);
  } else {
    console.error("[API Error]", err);
  }

  const responseMessage = isProduction
    ? "An internal server error occurred"
    : message;

  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: responseMessage } },
    { status: 500 },
  );
}
