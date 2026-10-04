import { z } from "zod";
import { authorize, dbError, fail, json, parse, readBody, route, uuid, type RouteContext } from "@/lib/api";
import { createCredentialSchema } from "@/lib/credential-input";
import { supabase } from "@/lib/supabase";
import type { Json } from "@/types/database";
export const POST = route(async (request: Request, context: RouteContext) => {
  const client = await authorize(request, "imports:write", true);
  // Processing creates credentials, so both permissions are necessary.
  if (!client.scopes.includes("credentials:write")) {
    fail(403, "INSUFFICIENT_SCOPE", "Se requiere credentials:write");
  }
  const id = parse(uuid, (await context.params).id);
  const input = parse(z.object({ records: z.array(z.unknown()).min(1).max(50) }), await readBody(request));
  const records = input.records.map(record => {
    const validation = createCredentialSchema.safeParse(record);
    return validation.success ? validation.data : { _validation_error: true };
  });
  const { data, error } = await supabase.rpc("process_credential_import", { p_batch_id: id, p_api_client_id: client.id,
    p_records: records as Json }); dbError(error); return json(data);
});
