import { z } from "zod";
import { admin, json, manage, parse, readBody, route, text, uuid, type RouteContext } from "@/lib/api";
export const runtime = "nodejs";
export const POST = route(async (request: Request, context: RouteContext) => {
  admin(request); const id = parse(uuid, (await context.params).id);
  const input = parse(z.object({ reason: text(5,2000) }), await readBody(request));
  return json(await manage("api_client", "revoke", input, id));
});
