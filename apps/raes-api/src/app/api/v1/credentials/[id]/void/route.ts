import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiError, authorize, fail, readBody, route } from "@/lib/api";

import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

const idSchema =
  z.string().uuid();

const voidCredentialSchema =
  z.object({
    reason: z
      .string()
      .trim()
      .max(2000)
      .min(
        5,
        "Debe indicar el motivo de la anulación",
      ),
  });

export const POST = route(async (
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  },
) => {
  const client = await authorize(request, "credentials:revoke", true);

  const { id } =
    await params;

  if (
    !idSchema.safeParse(id)
      .success
  ) {
    return NextResponse.json(
      {
        error:
          "INVALID_CREDENTIAL_ID",

        message:
          "El ID de la credencial no es válido",
      },
      { status: 400 },
    );
  }

  try {
    /*
     * 4. Validar body.
     */
    const body =
      await readBody(request);

    const validation =
      voidCredentialSchema.safeParse(
        body,
      );

    if (!validation.success) {
      return NextResponse.json(
        {
          error:
            "INVALID_REQUEST",

          message:
            "Los datos enviados no son válidos",

          details:
            validation.error.flatten(),
        },
        { status: 400 },
      );
    }

    // Check ownership here; the RPC rechecks it while holding the row lock.
    const { data: credential, error: lookupError } = await supabase
      .from("credentials")
      .select("id, institution_id")
      .eq("id", id)
      .maybeSingle();

    if (lookupError) {
      return NextResponse.json(
        { error: "DATABASE_ERROR", message: "No fue posible validar la credencial" },
        { status: 500 },
      );
    }

    if (!credential) {
      return NextResponse.json(
        { error: "CREDENTIAL_NOT_FOUND", message: "La credencial no fue encontrada" },
        { status: 404 },
      );
    }

    if (credential.institution_id !== client.institutionId) {
      return NextResponse.json(
        { error: "CREDENTIAL_ACCESS_DENIED", message: "La integración no puede modificar esta credencial" },
        { status: 403 },
      );
    }

    /*
     * 5. Ejecutar operación
     * transaccional.
     */
    const {
      data,
      error,
    } = await supabase.rpc(
      "void_credential",
      {
        p_credential_id: id,

        p_reason:
          validation.data.reason,

        p_actor_type:
          "API_CLIENT",

        p_actor_reference:
          client.name,

        p_api_client_id:
          client.id,
      },
    );

    if (error) {
      if (["INSUFFICIENT_SCOPE", "INVALID_ACTOR", "API_CLIENT_NOT_FOUND"].includes(error.message)) {
        fail(403, error.message, "La integración no está autorizada para esta operación");
      }

      console.error("Error voiding credential:");

      if (
        error.message.includes(
          "CREDENTIAL_NOT_FOUND",
        )
      ) {
        return NextResponse.json(
          {
            error:
              "CREDENTIAL_NOT_FOUND",

            message:
              "La credencial no fue encontrada",
          },
          { status: 404 },
        );
      }

      if (
        error.message.includes(
          "CREDENTIAL_ALREADY_VOIDED",
        )
      ) {
        return NextResponse.json(
          {
            error:
              "CREDENTIAL_ALREADY_VOIDED",

            message:
              "La credencial ya está anulada",
          },
          { status: 409 },
        );
      }

      if (
        error.message.includes(
          "REVOKED_CREDENTIAL_CANNOT_BE_VOIDED",
        )
      ) {
        return NextResponse.json(
          {
            error:
              "REVOKED_CREDENTIAL_CANNOT_BE_VOIDED",

            message:
              "Una credencial revocada no puede ser anulada",
          },
          { status: 409 },
        );
      }

      if (
        error.message.includes(
          "API_CLIENT_NOT_FOUND",
        )
      ) {
        return NextResponse.json(
          {
            error:
              "API_CLIENT_NOT_FOUND",

            message:
              "La integración no fue encontrada",
          },
          { status: 403 },
        );
      }

      if (
        error.message.includes(
          "API_CLIENT_NOT_ACTIVE",
        )
      ) {
        return NextResponse.json(
          {
            error:
              "API_CLIENT_NOT_ACTIVE",

            message:
              "La integración institucional no está activa",
          },
          { status: 403 },
        );
      }

      if (
        error.message.includes(
          "API_CLIENT_EXPIRED",
        )
      ) {
        return NextResponse.json(
          {
            error:
              "API_CLIENT_EXPIRED",

            message:
              "La integración institucional ha expirado",
          },
          { status: 403 },
        );
      }

      if (
        error.message.includes(
          "API_CLIENT_CREDENTIAL_MISMATCH",
        )
      ) {
        return NextResponse.json(
          {
            error:
              "CREDENTIAL_ACCESS_DENIED",

            message:
              "La integración no puede modificar esta credencial",
          },
          { status: 403 },
        );
      }

      return NextResponse.json(
        {
          error:
            "DATABASE_ERROR",

          message:
            "No fue posible anular la credencial",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      data,
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error("Unexpected error:");

    return NextResponse.json(
      {
        error:
          "INTERNAL_SERVER_ERROR",

        message:
          "Ocurrió un error inesperado",
      },
      { status: 500 },
    );
  }
});
