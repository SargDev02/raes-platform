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

    if (!idSchema.safeParse(id).success) {
      return NextResponse.json(
        {
          error: "INVALID_CREDENTIAL_ID",
          message: "El ID de la credencial no es válido",
        },
        { status: 400 },
      );
    }

    const { data: credential, error } =
      await supabase
        .from("credentials")
        .select(`
          *,

          institution:institutions (
            id,
            name,
            nit,
            verification_digit,
            institution_type,
            status
          ),

          person:persons (
            id,
            document_type,
            document_number,
            first_names,
            last_names,
            birth_date
          ),

          program:programs (
            id,
            code,
            snies_code,
            name,
            academic_level,
            status
          ),

          credential_type:credential_types (
            id,
            code,
            name,
            description
          )
        `)
        .eq("id", id)
        .maybeSingle();

    if (error) {
      console.error(error);

      return NextResponse.json(
        {
          error: "DATABASE_ERROR",
          message:
            "No fue posible consultar la credencial",
        },
        { status: 500 },
      );
    }

    if (!credential) {
      return NextResponse.json(
        {
          error: "CREDENTIAL_NOT_FOUND",
          message: "La credencial no fue encontrada",
        },
        { status: 404 },
      );
    }

    const { data: events, error: eventsError } =
      await supabase
        .from("credential_events")
        .select("*")
        .eq("credential_id", id)
        .order("created_at", {
          ascending: false,
        });

    if (eventsError) {
      console.error(eventsError);

      return NextResponse.json(
        {
          error: "DATABASE_ERROR",
          message:
            "No fue posible consultar el historial de la credencial",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      data: {
        ...credential,
        events,
      },
    });
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