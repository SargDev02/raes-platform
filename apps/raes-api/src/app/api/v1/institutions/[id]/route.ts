import { NextResponse } from "next/server";
import { z } from "zod";

import { supabase } from "@/lib/supabase";

const idSchema = z.string().uuid();

const updateInstitutionSchema = z
  .object({
    name: z.string().trim().min(3).optional(),
    nit: z.string().trim().min(5).optional(),
    verificationDigit: z.string().length(1).optional(),
    institutionType: z.string().trim().optional(),
    status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Debe enviar al menos un campo para actualizar",
  });

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const validation = idSchema.safeParse(id);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "INVALID_INSTITUTION_ID",
          message: "El ID de la institución no es válido",
        },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("institutions")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("Error fetching institution:", error);

      return NextResponse.json(
        {
          error: "DATABASE_ERROR",
          message: "No fue posible consultar la institución",
        },
        { status: 500 },
      );
    }

    if (!data) {
      return NextResponse.json(
        {
          error: "INSTITUTION_NOT_FOUND",
          message: "La institución no fue encontrada",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      data,
    });
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const idValidation = idSchema.safeParse(id);

    if (!idValidation.success) {
      return NextResponse.json(
        {
          error: "INVALID_INSTITUTION_ID",
          message: "El ID de la institución no es válido",
        },
        { status: 400 },
      );
    }

    const body = await request.json();

    const validation = updateInstitutionSchema.safeParse(body);

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
      nit,
      verificationDigit,
      institutionType,
      status,
    } = validation.data;

    const updates: Record<string, string> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updates.name = name;
    if (nit !== undefined) updates.nit = nit;
    if (verificationDigit !== undefined) {
      updates.verification_digit = verificationDigit;
    }
    if (institutionType !== undefined) {
      updates.institution_type = institutionType;
    }
    if (status !== undefined) updates.status = status;

    const { data, error } = await supabase
      .from("institutions")
      .update(updates)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) {
      console.error("Error updating institution:", error);

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
          message: "No fue posible actualizar la institución",
        },
        { status: 500 },
      );
    }

    if (!data) {
      return NextResponse.json(
        {
          error: "INSTITUTION_NOT_FOUND",
          message: "La institución no fue encontrada",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      data,
    });
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