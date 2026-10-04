import { adminOrInstitution, dbError, fail, json, manage, parse, readBody, route, uuid, type RouteContext } from "@/lib/api";
import { programData, programPatch } from "@/lib/program-input";
import { supabase } from "@/lib/supabase";
export const GET = route(async (request: Request, context: RouteContext) => {
  const client = await adminOrInstitution(request, "programs:read"); const id = parse(uuid, (await context.params).id);
  let query = supabase.from("programs").select("id,institution_id,name,code,snies_code,academic_level,status,created_at,updated_at").eq("id", id);
  if (client) query = query.eq("institution_id", client.institutionId!);
  const { data, error } = await query.maybeSingle(); dbError(error);
  if (!data) fail(404, "PROGRAM_NOT_FOUND", "El programa no fue encontrado"); return json(data);
});
export const PATCH = route(async (request: Request, context: RouteContext) => {
  const client = await adminOrInstitution(request, "programs:write"); const id = parse(uuid, (await context.params).id);
  const input = parse(programPatch, await readBody(request)); const values = programData(input);
  if (!client) return json(await manage("program", "update", values, id));
  const { data, error } = await supabase.from("programs").update(values).eq("id", id)
    .eq("institution_id", client.institutionId!).select().maybeSingle();
  dbError(error); if (!data) fail(404, "PROGRAM_NOT_FOUND", "El programa no fue encontrado"); return json(data);
});
