import { z } from "zod";
import { admin, collection, dbError, pagination, parse, queryParams, route, text, uuid } from "@/lib/api";
import { supabase } from "@/lib/supabase";
export const GET = route(async (request: Request) => {
  admin(request); const paging = pagination(request);
  const input = parse(z.object({ actor: text(1,200).optional(), action: text(1,100).optional(),
    resource_type: text(1,100).optional(), resource_id: uuid.optional(),
    from: z.string().datetime({ offset: true }).optional(), to: z.string().datetime({ offset: true }).optional(),
  }).refine(value => !value.from || !value.to || Date.parse(value.to) >= Date.parse(value.from), "Rango inválido"), queryParams(request));
  let query = supabase.from("audit_logs").select("id,actor_type,actor_reference,action,resource_type,resource_id,metadata,created_at", { count: "exact" })
    .order("created_at", { ascending: false }).order("id").range(paging.from, paging.to);
  if (input.actor) query = query.eq("actor_reference", input.actor);
  if (input.action) query = query.eq("action", input.action);
  if (input.resource_type) query = query.eq("resource_type", input.resource_type);
  if (input.resource_id) query = query.eq("resource_id", input.resource_id);
  if (input.from) query = query.gte("created_at", input.from);
  if (input.to) query = query.lte("created_at", input.to);
  const { data, error, count } = await query; dbError(error); return collection(data, count, paging);
});
