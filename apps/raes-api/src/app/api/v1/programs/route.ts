import { z } from "zod";
import { adminOrInstitution, collection, dbError, fail, json, lifecycle, manage, pagination, parse, queryParams, readBody, route, uuid } from "@/lib/api";
import { programData, programSchema } from "@/lib/program-input";
import { supabase } from "@/lib/supabase";
export const POST = route(async (request: Request) => {
  const client = await adminOrInstitution(request, "programs:write");
  const input = parse(programSchema, await readBody(request));
  const institutionId = client ? client.institutionId! : input.institutionId;
  if (!institutionId) fail(400, "INVALID_REQUEST", "La administración debe indicar institutionId");
  const values = { ...programData(input), institution_id: institutionId };
  if (!client) return json(await manage("program", "create", values), 201);
  const { data, error } = await supabase.from("programs").insert({ ...values, name: input.name }).select().single();
  dbError(error); return json(data, 201);
});
export const GET = route(async (request: Request) => {
  const client = await adminOrInstitution(request, "programs:read"); const paging = pagination(request);
  const input = parse(z.object({ institutionId: uuid.optional(), status: lifecycle.optional() }), queryParams(request));
  let query = supabase.from("programs").select("id,institution_id,name,code,snies_code,academic_level,status,created_at,updated_at", { count: "exact" })
    .order("name").order("id").range(paging.from, paging.to);
  if (client) query = query.eq("institution_id", client.institutionId!);
  else if (input.institutionId) query = query.eq("institution_id", input.institutionId);
  if (input.status) query = query.eq("status", input.status);
  const { data, error, count } = await query; dbError(error); return collection(data, count, paging);
});
