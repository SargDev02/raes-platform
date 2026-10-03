import { NextResponse } from "next/server";
import { z } from "zod";

import { supabase } from "@/lib/supabase";

import type {
  Database,
  Json,
} from "@/types/database";

const createCredentialSchema = z.object({
  institutionId: z.string().uuid(),

  personId: z.string().uuid(),

  credentialTypeId: z.string().uuid(),

  programId: z.string().uuid().optional(),

  credentialNumber: z
    .string()
    .trim()
    .min(1)
    .optional(),

  externalReference: z
    .string()
    .trim()
    .min(1)
    .optional(),

  title: z.string().trim().min(3),

  description: z
    .string()
    .trim()
    .optional(),

  issuedAt: z.string().date(),

  validFrom: z.string().date().optional(),

  validUntil: z.string().date().optional(),

  sourceType: z
    .enum([
      "INSTITUTION_API",
      "ADMIN",
      "MIGRATION",
      "SYSTEM",
    ])
    .default("ADMIN"),

  registeredByApiClientId: z
    .string()
    .uuid()
    .optional(),

  registeredByReference: z
    .string()
    .trim()
    .optional(),

  documentHashSha256: z
    .string()
    .regex(/^[a-fA-F0-9]{64}$/)
    .optional(),

  metadata: z
    .record(z.string(), z.unknown())
    .optional(),
});

const statusSchema = z.enum([
  "ACTIVE",
  "REVOKED",
  "VOIDED",
]);

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const validation = createCredentialSchema.safeParse(body);

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

    const input = validation.data;

    const rpcParams: Database["public"]["Functions"]["create_credential"]["Args"] =
      {
        p_institution_id: input.institutionId,
        p_person_id: input.personId,
        p_credential_type_id: input.credentialTypeId,
        p_title: input.title,
        p_issued_at: input.issuedAt,
      };

    if (input.programId) {
      rpcParams.p_program_id = input.programId;
    }

    if (input.credentialNumber) {
      rpcParams.p_credential_number =
        input.credentialNumber;
    }

    if (input.externalReference) {
      rpcParams.p_external_reference =
        input.externalReference;
    }

    if (input.description) {
      rpcParams.p_description = input.description;
    }

    if (input.validFrom) {
      rpcParams.p_valid_from = input.validFrom;
    }

    if (input.validUntil) {
      rpcParams.p_valid_until = input.validUntil;
    }

    rpcParams.p_source_type = input.sourceType;

    if (input.registeredByApiClientId) {
      rpcParams.p_registered_by_api_client_id =
        input.registeredByApiClientId;
    }

    if (input.registeredByReference) {
      rpcParams.p_registered_by_reference =
        input.registeredByReference;
    }

    if (input.documentHashSha256) {
      rpcParams.p_document_hash_sha256 =
        input.documentHashSha256;
    }

    if (input.metadata) {
      rpcParams.p_metadata = input.metadata as Json;
    }

    const { data, error } = await supabase.rpc(
      "create_credential",
      rpcParams,
    );

    if (error) {
      console.error("Error creating credential:", error);

      if (error.code === "23503") {
        return NextResponse.json(
          {
            error: "RELATED_RESOURCE_NOT_FOUND",
            message:
              "La institución, persona, programa o tipo de credencial no existe",
          },
          { status: 404 },
        );
      }

      if (error.code === "23505") {
        return NextResponse.json(
          {
            error: "CREDENTIAL_ALREADY_EXISTS",
            message:
              "Ya existe una credencial con este número o referencia externa para la institución",
          },
          { status: 409 },
        );
      }

      if (error.code === "23514") {
        return NextResponse.json(
          {
            error: "INVALID_CREDENTIAL_DATA",
            message:
              "La credencial incumple una regla de negocio",
          },
          { status: 400 },
        );
      }

      return NextResponse.json(
        {
          error: "DATABASE_ERROR",
          message: "No fue posible registrar la credencial",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { data },
      { status: 201 },
    );
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

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);

    const personId = url.searchParams.get("personId");
    const institutionId =
      url.searchParams.get("institutionId");
    const status = url.searchParams.get("status");

    const page = Math.max(
      Number(url.searchParams.get("page") ?? "1"),
      1,
    );

    const limit = Math.min(
      Math.max(
        Number(url.searchParams.get("limit") ?? "20"),
        1,
      ),
      100,
    );

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("credentials")
      .select(
        `
          id,
          credential_number,
          external_reference,
          title,
          description,
          issued_at,
          valid_from,
          valid_until,
          status,
          source_type,
          registered_at_raes,
          revoked_at,
          revocation_reason,
          voided_at,
          void_reason,
          created_at,
          updated_at,

          institution:institutions (
            id,
            name,
            nit,
            status
          ),

          person:persons (
            id,
            document_type,
            document_number,
            first_names,
            last_names
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
            name
          )
        `,
        { count: "exact" },
      )
      .order("issued_at", { ascending: false })
      .range(from, to);

    if (personId) {
      if (!z.string().uuid().safeParse(personId).success) {
        return NextResponse.json(
          {
            error: "INVALID_PERSON_ID",
            message: "El ID de la persona no es válido",
          },
          { status: 400 },
        );
      }

      query = query.eq("person_id", personId);
    }

    if (institutionId) {
      if (
        !z.string().uuid().safeParse(institutionId).success
      ) {
        return NextResponse.json(
          {
            error: "INVALID_INSTITUTION_ID",
            message:
              "El ID de la institución no es válido",
          },
          { status: 400 },
        );
      }

      query = query.eq(
        "institution_id",
        institutionId,
      );
    }

    if (status) {
      const validation = statusSchema.safeParse(status);

      if (!validation.success) {
        return NextResponse.json(
          {
            error: "INVALID_CREDENTIAL_STATUS",
            message:
              "El estado de la credencial no es válido",
          },
          { status: 400 },
        );
      }

      query = query.eq("status", validation.data);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error(error);

      return NextResponse.json(
        {
          error: "DATABASE_ERROR",
          message:
            "No fue posible consultar las credenciales",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total: count ?? 0,
        totalPages: Math.ceil(
          (count ?? 0) / limit,
        ),
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