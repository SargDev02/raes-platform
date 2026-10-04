import { authorize, dbError, fail, json, parse, route, uuid, type RouteContext } from "@/lib/api";
import { supabase } from "@/lib/supabase";
export const GET = route(async (request: Request, context: RouteContext) => {
  const client = await authorize(request, "imports:read", true); const id = parse(uuid, (await context.params).id);
  const { data, error } = await supabase.from("credential_import_batches").select("*").eq("id", id)
    .eq("institution_id", client.institutionId!).maybeSingle(); dbError(error);
  if (!data) fail(404, "IMPORT_BATCH_NOT_FOUND", "La importación no fue encontrada"); return json(data);
});
