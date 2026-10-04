import { z } from "zod";
import { text } from "@/lib/api";
export const personSchema = z.object({ documentType: text(2,20).transform(value => value.toUpperCase()),
  documentNumber: text(4,30), firstNames: text(2,200), lastNames: text(2,200), birthDate: z.string().date().optional() });
