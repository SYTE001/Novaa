import { json, readCookie, verify } from "../../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  const token = readCookie(request, "novaa_admin");
  const payload = await verify(token, env.ADMIN_SESSION_SECRET || "");
  return json({ authenticated: !!payload });
}
