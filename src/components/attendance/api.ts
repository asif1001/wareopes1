"use client";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

/** JSON call to the attendance API using the existing WareOps session cookie. */
export async function api<T = Record<string, unknown>>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(`/api/attendance${path}`, {
    method: init.method ?? "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: init.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  let data: Record<string, unknown> = {};
  try {
    data = await res.json();
  } catch {
    // non-JSON error page
  }
  if (!res.ok || data.success === false) {
    throw new ApiError(String(data.error ?? `Request failed (${res.status})`), res.status, data.code as string | undefined);
  }
  return data as T;
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong";
}
