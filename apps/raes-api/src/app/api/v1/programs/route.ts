import { NextResponse } from "next/server";
import { z } from "zod";

import { supabase } from "@/lib/supabase";

const createProgramSchema = z.object({
  institutionId: z.string().uuid(),
  name: z.string().trim().min(3),
  code: z.string().trim().min(1).optional(),
  sniesCode: z.string().trim().min(1).optional(),
  academicLevel: z.string().trim().min(2).optional(),
});

const programStatusSchema = z.enum([
  "ACTIVE",
  "INACTIVE",
  "SUSPENDED",
]);

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const validation = createProgramSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "INVALID_REQUEST",
          message: "Los datos enviados no son válidos",
          details: validation.error.flatten(),
        },
        { status: 400 },
      );
    }

    const {
      institutionId,
      name,
      code,
      sniesCode,
      academicLevel,
    } = validation.data;

    const { data, error } = await supabase
      .from("programs")
      .insert({
        institution_id: institutionId,
        name,
        code,
        snies_code: sniesCode,
        academic_level: academicLevel,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating program:", error);

      if (error.code === "23503") {
        return NextResponse.json(
          {
            error: "INSTITUTION_NOT_FOUND",
            message: "La institución asociada no existe",
          },
          { status: 404 },
        );
      }

      if (error.code === "23505") {
        return NextResponse.json(
          {
            error: "PROGRAM_ALREADY_EXISTS",
            message:
              "Ya existe un programa con este código o código SNIES",
          },
          { status: 409 },
        );
      }

      return NextResponse.json(
        {
          error: "DATABASE_ERROR",
          message: "No fue posible registrar el programa",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { data },
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

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);

    const institutionId = url.searchParams.get("institutionId");
    const status = url.searchParams.get("status");

    let query = supabase
      .from("programs")
      .select(`
        id,
        code,
        snies_code,
        name,
        academic_level,
        status,
        created_at,
        updated_at,
        institution:institutions (
          id,
          name,
          nit
        )
      `)
      .order("name", { ascending: true });

    if (institutionId) {
      const validation = z.string().uuid().safeParse(institutionId);

      if (!validation.success) {
        return NextResponse.json(
          {
            error: "INVALID_INSTITUTION_ID",
            message: "El ID de la institución no es válido",
          },
          { status: 400 },
        );
      }

      query = query.eq("institution_id", institutionId);
    }

    if (status) {
      const validation = programStatusSchema.safeParse(status);

      if (!validation.success) {
        return NextResponse.json(
          {
            error: "INVALID_PROGRAM_STATUS",
            message: "El estado del programa no es válido",
          },
          { status: 400 },
        );
      }

      query = query.eq("status", validation.data);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching programs:", error);

      return NextResponse.json(
        {
          error: "DATABASE_ERROR",
          message: "No fue posible consultar los programas",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ data });
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