import { readCookie, verify } from "../_lib/auth.js";

export async function onRequest({ request, env, next }) {
  const url = new URL(request.url);
  if (url.pathname.endsWith("/login.html") || url.pathname === "/admin/login") {
    return next();
  }

  const token = readCookie(request, "novaa_admin");
  const payload = await verify(token, env.ADMIN_SESSION_SECRET || "");

  if (!payload) {
    return Response.redirect(`${url.origin}/admin/login.html`, 302);
  }

  return next();
}
