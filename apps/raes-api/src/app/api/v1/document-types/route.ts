import { authorize, collection, dbError, pagination, route } from "@/lib/api";
import { supabase } from "@/lib/supabase";
export const GET = route(async (request: Request) => {
  await authorize(request); const paging = pagination(request);
  const { data, error, count } = await supabase.from("document_types").select("code,name,description,status", { count: "exact" })
    .eq("status", "ACTIVE").order("code").range(paging.from, paging.to);
  dbError(error); return collection(data, count, paging);
});
