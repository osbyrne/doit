import type { AuthEnv } from "./auth";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const contextLabel = "doit-passkey-signup-v1";
const contextTtlMs = 10 * 60 * 1000;

export type PasskeySignupDetails = {
  email: string;
  name: string;
};

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function getContextKey(secret: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(`${contextLabel}:${secret}`),
  );
  return crypto.subtle.importKey("raw", keyMaterial, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function validateSignupDetails(value: unknown): PasskeySignupDetails {
  if (typeof value !== "object" || value === null)
    throw new Error("Invalid passkey signup details.");
  const input = value as { email?: unknown; name?: unknown };
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const suppliedName = typeof input.name === "string" ? input.name.trim() : "";
  const name = (suppliedName || email.split("@")[0] || "Doit user").slice(0, 80);

  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid email address to create a passkey account.");
  }
  if (suppliedName.length > 120) throw new Error("Names must be 120 characters or fewer.");
  return { email, name };
}

export async function createPasskeySignupContext(
  details: PasskeySignupDetails,
  secret: string,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const payload = encoder.encode(
    JSON.stringify({
      ...validateSignupDetails(details),
      expiresAt: Date.now() + contextTtlMs,
    }),
  );
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(contextLabel) },
    await getContextKey(secret),
    payload,
  );
  return `v1.${toBase64Url(iv)}.${toBase64Url(new Uint8Array(encrypted))}`;
}

export async function readPasskeySignupContext(
  context: string | null | undefined,
  secret: string,
): Promise<PasskeySignupDetails> {
  if (!context || context.length > 4096)
    throw new Error("Passkey signup context is missing or invalid.");
  const [version, encodedIv, encodedCiphertext, ...extra] = context.split(".");
  if (version !== "v1" || !encodedIv || !encodedCiphertext || extra.length > 0) {
    throw new Error("Passkey signup context is missing or invalid.");
  }

  const iv = fromBase64Url(encodedIv);
  const ciphertext = fromBase64Url(encodedCiphertext);
  if (iv.length !== 12 || ciphertext.length > 2048)
    throw new Error("Passkey signup context is invalid.");

  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(contextLabel) },
    await getContextKey(secret),
    ciphertext,
  );
  const payload = JSON.parse(decoder.decode(plaintext)) as {
    email?: unknown;
    name?: unknown;
    expiresAt?: unknown;
  };
  if (typeof payload.expiresAt !== "number" || payload.expiresAt < Date.now()) {
    throw new Error("Passkey signup context expired. Start account creation again.");
  }
  const details = validateSignupDetails(payload);
  if (details.email !== payload.email || details.name !== payload.name) {
    throw new Error("Passkey signup context is invalid.");
  }
  return details;
}

export async function handlePasskeySignupContextRequest(
  request: Request,
  env: AuthEnv,
): Promise<Response> {
  if (request.method !== "POST") {
    return Response.json(
      { error: "Method not allowed." },
      { status: 405, headers: { Allow: "POST" } },
    );
  }
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return Response.json({ error: "Request origin was not accepted." }, { status: 403 });
  }
  if (!env.BETTER_AUTH_SECRET) {
    return Response.json({ error: "Authentication is not configured." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  try {
    const details = validateSignupDetails(body);
    const context = await createPasskeySignupContext(details, env.BETTER_AUTH_SECRET);
    return Response.json({ context }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Could not start passkey account creation.",
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
