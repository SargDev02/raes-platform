import { authorize, dbError, json, parse, readBody, route } from "@/lib/api";
import { personSchema } from "@/lib/person-input";
import { supabase } from "@/lib/supabase";
export const POST = route(async (request: Request) => {
  await authorize(request, "persons:resolve", true);
  const input = parse(personSchema, await readBody(request));
  const { data, error } = await supabase.rpc("resolve_person", {
    p_document_type: input.documentType, p_document_number: input.documentNumber,
    p_first_names: input.firstNames, p_last_names: input.lastNames,
    ...(input.birthDate ? { p_birth_date: input.birthDate } : {}),
  });
  dbError(error);
  // Do not return master identity data from a different institution's existing record.
  return json({ id: data!.id });
});
