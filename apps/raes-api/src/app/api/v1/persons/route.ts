import { NextResponse } from "next/server";
import { z } from "zod";

import { supabase } from "@/lib/supabase";

const createPersonSchema = z.object({
  documentType: z.string().trim().min(2).max(20),
  documentNumber: z.string().trim().min(4).max(30),
  firstNames: z.string().trim().min(2),
  lastNames: z.string().trim().min(2),
  birthDate: z.string().date().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const validation = createPersonSchema.safeParse(body);

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
      documentType,
      documentNumber,
      firstNames,
      lastNames,
      birthDate,
    } = validation.data;

    const { data, error } = await supabase
      .from("persons")
      .insert({
        document_type: documentType.toUpperCase(),
        document_number: documentNumber,
        first_names: firstNames,
        last_names: lastNames,
        birth_date: birthDate,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating person:", error);

      if (error.code === "23505") {
        return NextResponse.json(
          {
            error: "PERSON_ALREADY_EXISTS",
            message:
              "Ya existe una persona registrada con este tipo y número de documento",
          },
          { status: 409 },
        );
      }

      return NextResponse.json(
        {
          error: "DATABASE_ERROR",
          message: "No fue posible registrar la persona",
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

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("persons")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching persons:", error);

      return NextResponse.json(
        {
          error: "DATABASE_ERROR",
          message: "No fue posible consultar las personas",
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