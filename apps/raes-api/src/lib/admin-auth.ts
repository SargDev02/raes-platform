import {
  createHash,
  timingSafeEqual,
} from "node:crypto";

function secureCompare(
  valueA: string,
  valueB: string,
): boolean {
  const hashA = createHash("sha256")
    .update(valueA)
    .digest();

  const hashB = createHash("sha256")
    .update(valueB)
    .digest();

  return timingSafeEqual(hashA, hashB);
}

export function isAdminRequest(
  request: Request,
): boolean {
  const configuredKey =
    process.env.RAES_ADMIN_API_KEY;

  if (!configuredKey) {
    console.error(
      "RAES_ADMIN_API_KEY is not configured",
    );

    return false;
  }

  const authorization =
    request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return false;
  }

  const providedKey = authorization
    .slice("Bearer ".length)
    .trim();

  if (!providedKey) {
    return false;
  }

  return secureCompare(
    providedKey,
    configuredKey,
  );
}