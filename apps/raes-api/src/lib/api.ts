import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiClient, type AuthenticatedApiClient, hasScope } from "@/lib/api-client-auth";
import { isAdminRequest } from "@/lib/admin-auth";
import { supabase } from "@/lib/supabase";
import type { Json } from "@/types/database";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}
export function fail(status: number, code: string, message: string): never {
  throw new ApiError(status, code, message);
}
export type RouteContext = { params: Promise<{ id: string }> };
export function route<T extends unknown[]>(handler: (...args: T) => Promise<Response>) {
  return async (...args: T) => {
    try { return await handler(...args); }
    catch (error) {
      if (error instanceof ApiError) return NextResponse.json({ error: error.code, message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }) }, { status: error.status });
      // Do not log payloads, credentials, or raw database error details.
      console.error("Unexpected API failure");
      return NextResponse.json({ error: "INTERNAL_SERVER_ERROR", message: "Ocurrió un error inesperado" }, { status: 500 });
    }
  };
}
export function admin(request: Request) {
  if (!isAdminRequest(request)) fail(401, "UNAUTHORIZED", "No está autorizado para administrar RAES");
}
export async function authorize(request: Request, scope?: string, institutional = false): Promise<AuthenticatedApiClient> {
  const authentication = await authenticateApiClient(request);
  if (!authentication.ok) fail(authentication.status, authentication.error, authentication.message);
  const client = authentication.client;
  if (institutional && client.clientType !== "INSTITUTION") fail(403, "INSTITUTION_CLIENT_REQUIRED", "Se requiere una integración institucional");
  if (client.clientType === "INSTITUTION" && !client.institutionId) fail(403, "INVALID_API_CLIENT", "La integración no tiene una institución asociada");
  if (scope && !hasScope(client, scope)) fail(403, "INSUFFICIENT_SCOPE", "La integración no tiene el permiso requerido");
  return client;
}
export async function adminOrInstitution(request: Request, scope?: string) {
  if (isAdminRequest(request)) return null;
  return authorize(request, scope, true);
}
export const uuid = z.string().uuid();
export const lifecycle = z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]);
export const text = (min = 1, max = 200) => z.string().trim().min(min).max(max);
export const metadata = z.record(z.string().max(100), z.unknown()).refine(
  value => Buffer.byteLength(JSON.stringify(value)) <= 16384, "Metadata excede 16 KiB",
);
export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new ApiError(400, "INVALID_REQUEST", "Los datos enviados no son válidos", result.error.flatten());
  return result.data;
}
export async function readBody(request: Request, allowEmpty = false): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader && allowEmpty) return {};
  if (!reader) fail(400, "INVALID_REQUEST", "Debe enviar JSON válido");
  let size = 0; const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 262144) { await reader.cancel(); fail(400, "REQUEST_TOO_LARGE", "El cuerpo excede 256 KiB"); }
    chunks.push(value);
  }
  if (size === 0 && allowEmpty) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { fail(400, "INVALID_REQUEST", "Debe enviar JSON válido"); }
}
const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export function pagination(request: Request) {
  const url = new URL(request.url);
  const { page, limit } = parse(paginationSchema, {
    page: url.searchParams.get("page") ?? undefined, limit: url.searchParams.get("limit") ?? undefined,
  });
  return { page, limit, from: (page - 1) * limit, to: page * limit - 1 };
}
export function queryParams(request: Request) { return Object.fromEntries(new URL(request.url).searchParams); }
export function dbError(error: { code?: string; message: string } | null) {
  if (!error) return;
  if (error.code === "23505") fail(409, "RESOURCE_ALREADY_EXISTS", "El recurso ya existe");
  if (error.code === "23503") fail(404, "RELATED_RESOURCE_NOT_FOUND", "El recurso relacionado no existe");
  if (error.code === "23514" || error.code === "23502") fail(400, "INVALID_REQUEST", "Los datos incumplen una regla de negocio");
  const mapped: Record<string, number> = {
    RESOURCE_NOT_FOUND: 404, API_CLIENT_ALREADY_REVOKED: 409, API_CLIENT_NOT_ACTIVE: 403,
    INSTITUTION_NOT_ACTIVE: 409, INVALID_DOCUMENT_TYPE: 400, IMPORT_ALREADY_PROCESSED: 409,
    CREDENTIAL_ACCESS_DENIED: 403, INSUFFICIENT_SCOPE: 403, INVALID_IMPORT_RECORDS: 400,
  };
  if (mapped[error.message]) fail(mapped[error.message], error.message, "La operación no está permitida para este recurso");
  fail(500, "DATABASE_ERROR", "No fue posible completar la operación");
}
export async function manage(resource: string, operation: string, data: Record<string, unknown>, id?: string) {
  const result = await supabase.rpc("manage_core_resource", { p_resource: resource, p_operation: operation,
    p_data: data as Json, ...(id ? { p_id: id } : {}) });
  dbError(result.error); return result.data;
}
export function json(data: unknown, status = 200) { return NextResponse.json({ data }, { status }); }
export function collection(data: unknown, count: number | null, paging: ReturnType<typeof pagination>) {
  return NextResponse.json({ data, pagination: { page: paging.page, limit: paging.limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / paging.limit) } });
}
