import { NextResponse } from "next/server";
import { z } from "zod";

import { supabase } from "@/lib/supabase";

const createInstitutionSchema = z.object({
  name: z.string().trim().min(3),
  nit: z.string().trim().min(5),
  verificationDigit: z.string().length(1).optional(),
  institutionType: z.string().trim().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const result = createInstitutionSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error: "INVALID_REQUEST",
          message: "Los datos enviados no son válidos",
          details: result.error.flatten(),
        },
        { status: 400 },
      );
    }

    const {
      name,
      nit,
      verificationDigit,
      institutionType,
    } = result.data;

    const { data, error } = await supabase
      .from("institutions")
      .insert({
        name,
        nit,
        verification_digit: verificationDigit,
        institution_type: institutionType,
      })
      .select()
      .single();

    if (error) {
  console.error("Error creating institution:", error);

  if (error.code === "23505") {
    return NextResponse.json(
      {
        error: "INSTITUTION_ALREADY_EXISTS",
        message: "Ya existe una institución registrada con este NIT",
      },
      { status: 409 },
    );
  }

  return NextResponse.json(
    {
      error: "DATABASE_ERROR",
      message: "No fue posible registrar la institución",
    },
    { status: 500 },
  );
}

    return NextResponse.json(
      {
        data,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Unexpected error:", error);

    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Ocurrió un error inesperado",
      },
      { status: 500 },
    );
  }
}