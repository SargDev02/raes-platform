import { NextResponse } from "next/server";
import { z } from "zod";

import { supabase } from "@/lib/supabase";

const idSchema = z.string().uuid();

const revokeSchema = z.object({
  reason: z.string().trim().min(5),

  actorType: z
    .string()
    .trim()
    .min(2)
    .default("ADMIN"),

  actorReference: z
    .string()
    .trim()
    .optional(),
});

export async function POST(
  request: Request,
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

    const body = await request.json();

    const validation = revokeSchema.safeParse(body);

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

    const rpcParams = {
      p_credential_id: id,
      p_reason: validation.data.reason,
      p_actor_type: validation.data.actorType,
      ...(validation.data.actorReference
        ? {
            p_actor_reference:
              validation.data.actorReference,
          }
        : {}),
    };

    const { data, error } = await supabase.rpc(
      "revoke_credential",
      rpcParams,
    );

    if (error) {
      console.error(error);

      if (
        error.message.includes(
          "CREDENTIAL_NOT_FOUND",
        )
      ) {
        return NextResponse.json(
          {
            error: "CREDENTIAL_NOT_FOUND",
            message:
              "La credencial no fue encontrada",
          },
          { status: 404 },
        );
      }

      if (
        error.message.includes(
          "CREDENTIAL_ALREADY_REVOKED",
        )
      ) {
        return NextResponse.json(
          {
            error: "CREDENTIAL_ALREADY_REVOKED",
            message:
              "La credencial ya está revocada",
          },
          { status: 409 },
        );
      }

      if (
        error.message.includes(
          "VOIDED_CREDENTIAL_CANNOT_BE_REVOKED",
        )
      ) {
        return NextResponse.json(
          {
            error:
              "VOIDED_CREDENTIAL_CANNOT_BE_REVOKED",
            message:
              "Una credencial anulada no puede ser revocada",
          },
          { status: 409 },
        );
      }

      return NextResponse.json(
        {
          error: "DATABASE_ERROR",
          message:
            "No fue posible revocar la credencial",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      data,
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