import { json } from "../../_lib/auth.js";

export async function onRequestPost() {
  return json(
    { ok: true },
    200,
    { "set-cookie": "novaa_admin=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0" }
  );
}
