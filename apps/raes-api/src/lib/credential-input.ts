import { z } from "zod";
import { uuid, text, metadata } from "@/lib/api";

export const createCredentialSchema = z.object({
  personId: uuid, credentialTypeId: uuid, programId: uuid.optional(),
  credentialNumber: text(1, 200).optional(), externalReference: text(1, 200).optional(),
  title: text(3, 500), description: text(0, 4000).optional(), issuedAt: z.string().date(),
  validFrom: z.string().date().optional(), validUntil: z.string().date().optional(),
  documentHashSha256: z.string().regex(/^[a-fA-F0-9]{64}$/).optional(), metadata: metadata.optional(),
}).refine(input => !input.validFrom || !input.validUntil || input.validUntil >= input.validFrom,
  { message: "El rango de validez no es válido", path: ["validUntil"] });
