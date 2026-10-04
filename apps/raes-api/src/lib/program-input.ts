import { z } from "zod";
import { lifecycle, text, uuid } from "@/lib/api";
export const programSchema = z.object({ institutionId: uuid.optional(), name: text(3,200),
  code: text(1,100).optional(), sniesCode: text(1,100).optional(), academicLevel: text(2,100).optional() });
export const programPatch = z.object({ name: text(3,200).optional(), code: text(1,100).nullable().optional(),
  sniesCode: text(1,100).nullable().optional(), academicLevel: text(2,100).nullable().optional(), status: lifecycle.optional() })
  .refine(input => Object.keys(input).length > 0, "Debe enviar al menos un campo");
export function programData(input: z.infer<typeof programPatch>) {
  return { name: input.name, code: input.code, snies_code: input.sniesCode,
    academic_level: input.academicLevel, status: input.status };
}
