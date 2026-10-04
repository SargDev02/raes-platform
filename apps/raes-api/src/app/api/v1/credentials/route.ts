import { NextResponse } from "next/server";
import { createCredentialSchema } from "@/lib/credential-input";
import { listCredentials } from "@/lib/credential-read";
import { ApiError, authorize, fail, readBody, route } from "@/lib/api";

import { supabase } from "@/lib/supabase";

import type {
  Database,
  Json,
} from "@/types/database";

export const runtime = "nodejs";

export const POST = route(async (request: Request) => {
  const client = await authorize(request, "credentials:write", true);
  try {
    /*
     * 4. Validamos los datos enviados.
     *
     * IMPORTANTE:
     *
     * El request NO contiene institutionId.
     *
     * La institución se determina automáticamente
     * a partir de la API Key autenticada.
     */
    const body =
      await readBody(request);

    const validation =
      createCredentialSchema.safeParse(
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

    const input =
      validation.data;

    /*
     * 5. Construimos los parámetros para
     * la función transaccional de PostgreSQL.
     */
    const rpcParams: Database[
      "public"
    ]["Functions"][
      "create_credential"
    ]["Args"] = {
      /*
       * NO viene del body.
       *
       * La institución sale directamente
       * de la API Key.
       */
      p_institution_id:
        client.institutionId!,

      p_person_id:
        input.personId,

      p_credential_type_id:
        input.credentialTypeId,

      p_title:
        input.title,

      p_issued_at:
        input.issuedAt,

      /*
       * Tampoco permitimos que el cliente
       * diga cuál fue la procedencia.
       *
       * RAES sabe que esta operación vino
       * desde una integración institucional.
       */
      p_source_type:
        "INSTITUTION_API",

      /*
       * La trazabilidad también la obtiene
       * RAES automáticamente.
       */
      p_registered_by_api_client_id:
        client.id,

      p_registered_by_reference:
        client.name,
    };

    /*
     * Campos opcionales.
     */

    if (input.programId) {
      rpcParams.p_program_id =
        input.programId;
    }

    if (
      input.credentialNumber
    ) {
      rpcParams.p_credential_number =
        input.credentialNumber;
    }

    if (
      input.externalReference
    ) {
      rpcParams.p_external_reference =
        input.externalReference;
    }

    if (input.description) {
      rpcParams.p_description =
        input.description;
    }

    if (input.validFrom) {
      rpcParams.p_valid_from =
        input.validFrom;
    }

    if (input.validUntil) {
      rpcParams.p_valid_until =
        input.validUntil;
    }

    if (
      input.documentHashSha256
    ) {
      rpcParams.p_document_hash_sha256 =
        input.documentHashSha256;
    }

    if (input.metadata) {
      rpcParams.p_metadata =
        input.metadata as Json;
    }

    /*
     * 6. create_credential() ejecuta
     * transaccionalmente:
     *
     * credentials INSERT
     *        +
     * credential_events INSERT
     *
     * Si cualquiera falla, toda la operación
     * se revierte.
     */
    const {
      data,
      error,
    } = await supabase.rpc(
      "create_credential",
      rpcParams,
    );

    if (error) {
      if (["INSUFFICIENT_SCOPE", "INVALID_ACTOR", "API_CLIENT_NOT_FOUND"].includes(error.message)) {
        fail(403, error.message, "La integración no está autorizada para esta operación");
      }

      console.error("Error creating credential:");

      /*
       * Relaciones inexistentes.
       */
      if (
        error.code === "23503"
      ) {
        return NextResponse.json(
          {
            error:
              "RELATED_RESOURCE_NOT_FOUND",

            message:
              "La persona, programa o tipo de credencial relacionado no existe",
          },
          { status: 404 },
        );
      }

      /*
       * credential_number o
       * external_reference duplicado
       * dentro de la misma institución.
       */
      if (
        error.code === "23505"
      ) {
        return NextResponse.json(
          {
            error:
              "CREDENTIAL_ALREADY_EXISTS",

            message:
              "Ya existe una credencial con este número o referencia externa para la institución",
          },
          { status: 409 },
        );
      }

      /*
       * Restricciones CHECK.
       */
      if (
        error.code === "23514"
      ) {
        return NextResponse.json(
          {
            error:
              "INVALID_CREDENTIAL_DATA",

            message:
              "La credencial incumple una regla de negocio",
          },
          { status: 400 },
        );
      }

      /*
       * Validaciones internas de nuestra
       * función PostgreSQL.
       */

      if (
        error.message.includes(
          "INSTITUTION_NOT_ACTIVE",
        )
      ) {
        return NextResponse.json(
          {
            error:
              "INSTITUTION_NOT_ACTIVE",

            message:
              "La institución no está activa",
          },
          { status: 409 },
        );
      }

      if (
        error.message.includes(
          "CREDENTIAL_TYPE_NOT_ACTIVE",
        )
      ) {
        return NextResponse.json(
          {
            error:
              "CREDENTIAL_TYPE_NOT_ACTIVE",

            message:
              "El tipo de credencial no está activo",
          },
          { status: 409 },
        );
      }

      if (
        error.message.includes(
          "PROGRAM_NOT_ACTIVE_OR_NOT_IN_INSTITUTION",
        )
      ) {
        return NextResponse.json(
          {
            error:
              "INVALID_PROGRAM",

            message:
              "El programa no está activo o no pertenece a la institución autenticada",
          },
          { status: 409 },
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
          "API_CLIENT_INSTITUTION_MISMATCH",
        )
      ) {
        return NextResponse.json(
          {
            error:
              "API_CLIENT_INSTITUTION_MISMATCH",

            message:
              "La integración no pertenece a la institución indicada",
          },
          { status: 403 },
        );
      }

      return NextResponse.json(
        {
          error:
            "DATABASE_ERROR",

          message:
            "No fue posible registrar la credencial",
        },
        { status: 500 },
      );
    }

    /*
     * 7. Credencial creada.
     */
    return NextResponse.json(
      {
        data,
      },
      {
        status: 201,
      },
    );
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

export const GET = route(listCredentials);
