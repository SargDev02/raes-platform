import { z } from "zod";
import { admin, collection, dbError, json, manage, pagination, parse, queryParams, readBody, route, uuid } from "@/lib/api";
import { generateApiKey } from "@/lib/api-client-auth";
import { apiClientProjection, apiClientSchema } from "@/lib/api-client-input";
import { supabase } from "@/lib/supabase";
export const runtime = "nodejs";
export const POST = route(async (request: Request) => {
  admin(request); const input = parse(apiClientSchema, await readBody(request));
  const key = generateApiKey();
  const result = await manage("api_client", "create", { name: input.name, client_type: input.clientType,
    institution_id: input.institutionId ?? null, scopes: [...new Set(input.scopes)], expires_at: input.expiresAt ?? null,
    key_prefix: key.prefix, key_hash: key.hash });
  return json({ ...(result as object), apiKey: key.apiKey }, 201);
});
export const GET = route(async (request: Request) => {
  admin(request); const paging = pagination(request);
  const input = parse(z.object({ institutionId: uuid.optional(), status: z.enum(["ACTIVE","SUSPENDED","REVOKED"]).optional() }), queryParams(request));
  let query = supabase.from("api_clients").select(apiClientProjection, { count: "exact" })
    .order("created_at", { ascending: false }).order("id").range(paging.from, paging.to);
  if (input.institutionId) query = query.eq("institution_id", input.institutionId);
  if (input.status) query = query.eq("status", input.status);
  const { data, error, count } = await query; dbError(error); return collection(data, count, paging);
});
