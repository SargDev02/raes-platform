import {
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

import { supabase } from "@/lib/supabase";

export type AuthenticatedApiClient = {
  id: string;
  name: string;
  clientType: "INSTITUTION" | "PLATFORM";
  institutionId: string | null;
  scopes: string[];
};

type AuthenticationResult =
  | {
      ok: true;
      client: AuthenticatedApiClient;
    }
  | {
      ok: false;
      status: number;
      error: string;
      message: string;
    };

export function generateApiKey() {
  const prefix = randomBytes(6)
    .toString("hex");

  const secret = randomBytes(32)
    .toString("base64url");

  const apiKey =
    `raes_${prefix}_${secret}`;

  const hash = hashApiKey(apiKey);

  return {
    apiKey,
    prefix,
    hash,
  };
}

export function hashApiKey(
  apiKey: string,
): string {
  return createHash("sha256")
    .update(apiKey)
    .digest("hex");
}

function extractPrefix(
  apiKey: string,
): string | null {
  const match = apiKey.match(
    /^raes_([a-f0-9]{12})_[A-Za-z0-9_-]+$/,
  );

  return match?.[1] ?? null;
}

function compareHashes(
  storedHash: string,
  receivedHash: string,
): boolean {
  try {
    const storedBuffer = Buffer.from(
      storedHash,
      "hex",
    );

    const receivedBuffer = Buffer.from(
      receivedHash,
      "hex",
    );

    if (
      storedBuffer.length !==
      receivedBuffer.length
    ) {
      return false;
    }

    return timingSafeEqual(
      storedBuffer,
      receivedBuffer,
    );
  } catch {
    return false;
  }
}

export function hasScope(
  client: AuthenticatedApiClient,
  scope: string,
): boolean {
  return client.scopes.includes(scope);
}

export async function authenticateApiClient(
  request: Request,
): Promise<AuthenticationResult> {
  const authorization =
    request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return {
      ok: false,
      status: 401,
      error: "MISSING_API_KEY",
      message:
        "Debe enviar una API key válida",
    };
  }

  const apiKey = authorization
    .slice("Bearer ".length)
    .trim();

  const prefix = extractPrefix(apiKey);

  if (!prefix) {
    return {
      ok: false,
      status: 401,
      error: "INVALID_API_KEY",
      message:
        "La API key no es válida",
    };
  }

  const { data: client, error } =
    await supabase
      .from("api_clients")
      .select(`
        id,
        institution_id,
        name,
        client_type,
        key_hash,
        scopes,
        status,
        expires_at
      `)
      .eq("key_prefix", prefix)
      .maybeSingle();

  if (error) {
    console.error("API client lookup error:");

    return {
      ok: false,
      status: 500,
      error: "AUTHENTICATION_ERROR",
      message:
        "No fue posible validar la integración",
    };
  }

  if (!client) {
    return {
      ok: false,
      status: 401,
      error: "INVALID_API_KEY",
      message:
        "La API key no es válida",
    };
  }

  const receivedHash =
    hashApiKey(apiKey);

  if (
    !compareHashes(
      client.key_hash,
      receivedHash,
    )
  ) {
    return {
      ok: false,
      status: 401,
      error: "INVALID_API_KEY",
      message:
        "La API key no es válida",
    };
  }

  if (client.status !== "ACTIVE") {
    return {
      ok: false,
      status: 403,
      error: "API_CLIENT_NOT_ACTIVE",
      message:
        "La integración no está activa",
    };
  }

  if (
    client.expires_at &&
    new Date(client.expires_at) <= new Date()
  ) {
    return {
      ok: false,
      status: 403,
      error: "API_KEY_EXPIRED",
      message:
        "La API key ha expirado",
    };
  }

  const { error: updateError } =
    await supabase
      .from("api_clients")
      .update({
        last_used_at:
          new Date().toISOString(),
      })
      .eq("id", client.id);

  if (updateError) {
    console.error("Could not update last_used_at:");
  }

  return {
    ok: true,
    client: {
      id: client.id,
      name: client.name,
      clientType: client.client_type,
      institutionId:
        client.institution_id,
      scopes: client.scopes,
    },
  };
}