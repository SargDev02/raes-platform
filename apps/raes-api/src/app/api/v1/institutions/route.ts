import { admin, adminOrInstitution, collection, dbError, json, manage, pagination, parse, readBody, route } from "@/lib/api";
import { institutionData, institutionSchema } from "@/lib/institution-input";
import { supabase } from "@/lib/supabase";
export const POST = route(async (request: Request) => {
  admin(request); const input = parse(institutionSchema, await readBody(request));
  return json(await manage("institution", "create", institutionData(input)), 201);
});
export const GET = route(async (request: Request) => {
  const client = await adminOrInstitution(request); const paging = pagination(request);
  let query = supabase.from("institutions").select("id,name,nit,verification_digit,institution_type,status,created_at,updated_at", { count: "exact" })
    .order("created_at", { ascending: false }).order("id").range(paging.from, paging.to);
  if (client) query = query.eq("id", client.institutionId!);
  const { data, error, count } = await query; dbError(error); return collection(data, count, paging);
});
