import { admin, dbError, fail, json, parse, route, uuid, type RouteContext } from "@/lib/api";
import { supabase } from "@/lib/supabase";
export const GET = route(async (request: Request, context: RouteContext) => {
  admin(request); const id = parse(uuid, (await context.params).id);
  const { data, error } = await supabase.from("persons").select("*").eq("id", id).maybeSingle();
  dbError(error); if (!data) fail(404, "PERSON_NOT_FOUND", "La persona no fue encontrada");
  return json(data);
});
