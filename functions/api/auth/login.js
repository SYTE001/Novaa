import { json, sign } from "../../_lib/auth.js";

export async function onRequestPost({ request, env }) {
  const { password } = await request.json().catch(() => ({}));

  if (!password || !env.ADMIN_PASSWORD || !env.ADMIN_SESSION_SECRET) {
    return json({ ok: false }, 401);
  }

  if (password !== env.ADMIN_PASSWORD) {
    return json({ ok: false }, 401);
  }

  const token = await sign(
    {
      role: "admin",
      exp: Date.now() + 1000 * 60 * 60 * 8
    },
    env.ADMIN_SESSION_SECRET
  );

  return json(
    { ok: true },
    200,
    {
      "set-cookie": `novaa_admin=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`
    }
  );
}
