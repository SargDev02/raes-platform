import { z } from "zod";
import { lifecycle, text } from "@/lib/api";
export const institutionSchema = z.object({ name: text(3,200), nit: text(5,30),
  verificationDigit: z.string().regex(/^\d$/).optional(), institutionType: text(1,100).optional() });
export const institutionPatch = institutionSchema.partial().extend({ status: lifecycle.optional() })
  .refine(input => Object.keys(input).length > 0, "Debe enviar al menos un campo");
export function institutionData(input: z.infer<typeof institutionPatch>) {
  return { name: input.name, nit: input.nit, verification_digit: input.verificationDigit,
    institution_type: input.institutionType, status: input.status };
}
