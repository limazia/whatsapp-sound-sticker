import type { ZodType } from "zod";

import { env } from "@/env";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request(path: string, options?: RequestInit) {
  const response = await fetch(path, { ...options, redirect: "error" });
  if (!response.ok) {
    const data: { error?: string } | null = await response.json().catch(() => null);
    throw new ApiError(response.status, data?.error ?? "Falha na API.");
  }
  return response;
}

export function apiResponse(path: string, options?: RequestInit) {
  if (!env || !path.startsWith(`${env.BASE_URL}api/`)) throw new Error("Caminho da API inválido.");
  const headers = new Headers(options?.headers);
  headers.set("X-API-Key", import.meta.env.API_KEY);
  return request(path, { ...options, headers });
}

async function parseJson<T>(response: Response, schema: ZodType<T>) {
  const result = schema.safeParse(await response.json());
  if (!result.success) throw new Error("Resposta inválida da API.");
  return result.data;
}

export async function api<T>(path: string, schema: ZodType<T>, options?: RequestInit) {
  return parseJson(await apiResponse(path, options), schema);
}

export function postJson(body: object) {
  return { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

export function message(error: unknown) {
  return error instanceof Error ? error.message : "Ocorreu um erro.";
}
