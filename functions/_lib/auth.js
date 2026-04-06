const textEncoder = new TextEncoder();

export async function sign(payload, secret) {
  const body = btoa(JSON.stringify(payload));
  const signature = await hmac(body, secret);
  return `${body}.${signature}`;
}

export async function verify(token, secret) {
  if (!token || !token.includes(".")) return null;
  const [body, signature] = token.split(".");
  const expected = await hmac(body, secret);
  if (!timingSafeEqual(signature, expected)) return null;

  const payload = JSON.parse(atob(body));
  if (!payload.exp || Date.now() > payload.exp) return null;
  return payload;
}

export function readCookie(request, key) {
  const raw = request.headers.get("cookie") || "";
  return raw
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${key}=`))
    ?.split("=")[1];
}

export function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers
    }
  });
}

async function hmac(input, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(input));
  return bytesToHex(new Uint8Array(signature));
}

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a = "", b = "") {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
