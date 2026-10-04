import { z } from "zod";
import { authorize, collection, dbError, fail, json, pagination, parse, queryParams, uuid, type RouteContext } from "@/lib/api";
import { supabase } from "@/lib/supabase";

// Names identify the credential holder; identity documents and birth dates are unnecessary here.
export const credentialProjection = `id, institution_id, person_id, program_id, credential_type_id,
  credential_number, external_reference, title, description, issued_at, valid_from, valid_until,
  status, source_type, registered_at_raes, revoked_at, revocation_reason, voided_at, void_reason,
  created_at, updated_at, institution:institutions(id,name,status),
  person:persons(id,first_names,last_names), program:programs(id,code,snies_code,name,academic_level,status),
  credential_type:credential_types(id,code,name)`;
const filters = z.object({ personId: uuid.optional(), institutionId: uuid.optional(),
  programId: uuid.optional(), credentialTypeId: uuid.optional(),
  status: z.enum(["ACTIVE","REVOKED","VOIDED"]).optional(),
  issuedFrom: z.string().date().optional(), issuedUntil: z.string().date().optional(),
}).refine(value => !value.issuedFrom || !value.issuedUntil || value.issuedUntil >= value.issuedFrom,
  { message: "El rango de fechas no es válido" });
export async function listCredentials(request: Request) {
  const client = await authorize(request, "credentials:read");
  const paging = pagination(request);
  const input = parse(filters, queryParams(request));
  if (client.clientType === "PLATFORM" && !input.personId)
    fail(400, "PLATFORM_PERSON_FILTER_REQUIRED", "PLATFORM debe proporcionar personId");
  let query = supabase.from("credentials").select(credentialProjection, { count: "exact" })
    .order("issued_at", { ascending: false }).order("id").range(paging.from, paging.to);
  if (client.clientType === "INSTITUTION") query = query.eq("institution_id", client.institutionId!);
  else if (input.institutionId) query = query.eq("institution_id", input.institutionId);
  if (input.personId) query = query.eq("person_id", input.personId);
  if (input.programId) query = query.eq("program_id", input.programId);
  if (input.credentialTypeId) query = query.eq("credential_type_id", input.credentialTypeId);
  if (input.status) query = query.eq("status", input.status);
  if (input.issuedFrom) query = query.gte("issued_at", input.issuedFrom);
  if (input.issuedUntil) query = query.lte("issued_at", input.issuedUntil);
  const { data, error, count } = await query; dbError(error);
  return collection(data, count, paging);
}
export async function getCredential(request: Request, context: RouteContext) {
  const client = await authorize(request, "credentials:read");
  const id = parse(uuid, (await context.params).id);
  let query = supabase.from("credentials").select(credentialProjection).eq("id", id);
  if (client.clientType === "INSTITUTION") query = query.eq("institution_id", client.institutionId!);
  const { data, error } = await query.maybeSingle(); dbError(error);
  if (!data) fail(404, "CREDENTIAL_NOT_FOUND", "La credencial no fue encontrada");
  return json(data);
}
