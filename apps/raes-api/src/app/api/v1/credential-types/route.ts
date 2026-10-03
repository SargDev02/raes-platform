import { NextResponse } from "next/server";

import { supabase } from "@/lib/supabase";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("credential_types")
      .select(`
        id,
        code,
        name,
        description,
        status
      `)
      .eq("status", "ACTIVE")
      .order("name");

    if (error) {
      console.error(error);

      return NextResponse.json(
        {
          error: "DATABASE_ERROR",
          message:
            "No fue posible consultar los tipos de credencial",
        },
        { status: 500 },
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