import { NextResponse } from "next/server";
import { z } from "zod";

import { supabase } from "@/lib/supabase";

const idSchema = z.string().uuid();

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
          error: "INVALID_PERSON_ID",
          message: "El ID de la persona no es válido",
        },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("persons")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("Error fetching person:", error);

      return NextResponse.json(
        {
          error: "DATABASE_ERROR",
          message: "No fue posible consultar la persona",
        },
        { status: 500 },
      );
    }

    if (!data) {
      return NextResponse.json(
        {
          error: "PERSON_NOT_FOUND",
          message: "La persona no fue encontrada",
        },
        { status: 404 },
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