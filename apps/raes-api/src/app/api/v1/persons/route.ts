import { admin, collection, dbError, json, manage, pagination, parse, readBody, route } from "@/lib/api";
import { personSchema } from "@/lib/person-input";
import { supabase } from "@/lib/supabase";
export const POST = route(async (request: Request) => {
  admin(request); const input = parse(personSchema, await readBody(request));
  return json(await manage("person", "create", { document_type: input.documentType,
    document_number: input.documentNumber, first_names: input.firstNames,
    last_names: input.lastNames, birth_date: input.birthDate }), 201);
});
export const GET = route(async (request: Request) => {
  admin(request); const paging = pagination(request);
  const { data, error, count } = await supabase.from("persons").select("*", { count: "exact" })
    .order("created_at", { ascending: false }).order("id").range(paging.from, paging.to);
  dbError(error); return collection(data, count, paging);
});
