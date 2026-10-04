import { admin, adminOrInstitution, dbError, fail, json, manage, parse, readBody, route, uuid, type RouteContext } from "@/lib/api";
import { institutionData, institutionPatch } from "@/lib/institution-input";
import { supabase } from "@/lib/supabase";
export const GET = route(async (request: Request, context: RouteContext) => {
  const client = await adminOrInstitution(request); const id = parse(uuid, (await context.params).id);
  if (client && client.institutionId !== id) fail(404, "INSTITUTION_NOT_FOUND", "La institución no fue encontrada");
  const { data, error } = await supabase.from("institutions")
    .select("id,name,nit,verification_digit,institution_type,status,created_at,updated_at").eq("id", id).maybeSingle();
  dbError(error); if (!data) fail(404, "INSTITUTION_NOT_FOUND", "La institución no fue encontrada");
  return json(data);
});
export const PATCH = route(async (request: Request, context: RouteContext) => {
  admin(request); const id = parse(uuid, (await context.params).id);
  const input = parse(institutionPatch, await readBody(request));
  return json(await manage("institution", "update", institutionData(input), id));
});
