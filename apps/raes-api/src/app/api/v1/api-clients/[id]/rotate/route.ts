import { z } from "zod";
import { admin, json, manage, parse, readBody, route, uuid, type RouteContext } from "@/lib/api";
import { generateApiKey } from "@/lib/api-client-auth";
export const runtime = "nodejs";
export const POST = route(async (request: Request, context: RouteContext) => {
  admin(request); const id = parse(uuid, (await context.params).id); const key = generateApiKey();
  parse(z.object({}).strict(), await readBody(request, true));
  const result = await manage("api_client", "rotate", { key_prefix: key.prefix, key_hash: key.hash }, id);
  return json({ ...(result as object), apiKey: key.apiKey });
});
