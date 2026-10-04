import { route } from "@/lib/api";
import { getCredential } from "@/lib/credential-read";

export const runtime = "nodejs";
export const GET = route(getCredential);
