import { z } from "zod";
import { text, uuid } from "@/lib/api";
export const scopeSchema = z.enum(["credentials:read","credentials:write","credentials:revoke",
  "persons:resolve","programs:read","programs:write","imports:read","imports:write"]);
export const apiClientSchema = z.object({ name: text(3,200), clientType: z.enum(["INSTITUTION","PLATFORM"]),
  institutionId: uuid.optional(), scopes: z.array(scopeSchema).min(1).max(8),
  expiresAt: z.string().datetime({ offset: true }).optional(),
}).superRefine((value, ctx) => {
  if ((value.clientType === "INSTITUTION") !== Boolean(value.institutionId))
    ctx.addIssue({ code: "custom", path: ["institutionId"], message: "La asociación institucional no es válida" });
  if (value.clientType === "PLATFORM" && value.scopes.some(scope => scope !== "credentials:read"))
    ctx.addIssue({ code: "custom", path: ["scopes"], message: "PLATFORM solo permite credentials:read" });
  if (value.expiresAt && new Date(value.expiresAt) <= new Date())
    ctx.addIssue({ code: "custom", path: ["expiresAt"], message: "La expiración debe estar en el futuro" });
});
export const apiClientProjection = "id,name,client_type,institution_id,key_prefix,scopes,status,last_used_at,expires_at,revoked_at,revocation_reason,created_at,updated_at";
