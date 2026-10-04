import { z } from "zod";
import { authorize, collection, dbError, json, metadata, pagination, parse, queryParams, readBody, route, text } from "@/lib/api";
import { supabase } from "@/lib/supabase";
export const POST = route(async (request: Request) => {
  const client = await authorize(request, "imports:write", true);
  const input = parse(z.object({ externalBatchId: text(1,200).optional(), metadata: metadata.optional() }), await readBody(request));
  const { data, error } = await supabase.from("credential_import_batches").insert({ institution_id: client.institutionId!,
    api_client_id: client.id, external_batch_id: input.externalBatchId, metadata: input.metadata as import("@/types/database").Json })
    .select().single(); dbError(error); return json(data, 201);
});
export const GET = route(async (request: Request) => {
  const client = await authorize(request, "imports:read", true); const paging = pagination(request);
  const input = parse(z.object({ status: z.enum(["PENDING","PROCESSING","COMPLETED","PARTIAL","FAILED"]).optional() }), queryParams(request));
  let query = supabase.from("credential_import_batches").select("*", { count: "exact" }).eq("institution_id", client.institutionId!)
    .order("created_at", { ascending: false }).order("id").range(paging.from, paging.to);
  if (input.status) query = query.eq("status", input.status);
  const { data, error, count } = await query; dbError(error); return collection(data, count, paging);
});
