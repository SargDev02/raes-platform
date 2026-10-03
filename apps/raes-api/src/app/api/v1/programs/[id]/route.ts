import { NextResponse } from "next/server";
import { z } from "zod";

import { supabase } from "@/lib/supabase";

const idSchema = z.string().uuid();

const updateProgramSchema = z
  .object({
    name: z.string().trim().min(3).optional(),
    code: z.string().trim().min(1).nullable().optional(),
    sniesCode: z.string().trim().min(1).nullable().optional(),
    academicLevel: z.string().trim().min(2).nullable().optional(),
    status: z
      .enum(["ACTIVE", "INACTIVE", "SUSPENDED"])
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Debe enviar al menos un campo",
  });

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    if (!idSchema.safeParse(id).success) {
      return NextResponse.json(
        {
          error: "INVALID_PROGRAM_ID",
          message: "El ID del programa no es válido",
        },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("programs")
      .select(`
        *,
        institution:institutions (
          id,
          name,
          nit,
          status
        )
      `)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("Error fetching program:", error);

      return NextResponse.json(
        {
          error: "DATABASE_ERROR",
          message: "No fue posible consultar el programa",
        },
        { status: 500 },
      );
    }

    if (!data) {
      return NextResponse.json(
        {
          error: "PROGRAM_NOT_FOUND",
          message: "El programa no fue encontrado",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Ocurrió un error inesperado",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    if (!idSchema.safeParse(id).success) {
      return NextResponse.json(
        {
          error: "INVALID_PROGRAM_ID",
          message: "El ID del programa no es válido",
        },
        { status: 400 },
      );
    }

    const body = await request.json();

    const validation = updateProgramSchema.safeParse(body);

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
      name,
      code,
      sniesCode,
      academicLevel,
      status,
    } = validation.data;

    const updates: Record<string, string | null> = {};

    if (name !== undefined) updates.name = name;
    if (code !== undefined) updates.code = code;
    if (sniesCode !== undefined) updates.snies_code = sniesCode;

    if (academicLevel !== undefined) {
      updates.academic_level = academicLevel;
    }

    if (status !== undefined) {
      updates.status = status;
    }

    const { data, error } = await supabase
      .from("programs")
      .update(updates)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          {
            error: "PROGRAM_ALREADY_EXISTS",
            message:
              "Ya existe un programa con este código",
          },
          { status: 409 },
        );
      }

      return NextResponse.json(
        {
          error: "DATABASE_ERROR",
          message: "No fue posible actualizar el programa",
        },
        { status: 500 },
      );
    }

    if (!data) {
      return NextResponse.json(
        {
          error: "PROGRAM_NOT_FOUND",
          message: "El programa no fue encontrado",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Ocurrió un error inesperado",
      },
      { status: 500 },
    );
  }
}