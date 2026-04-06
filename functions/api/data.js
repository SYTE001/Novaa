import { json, readCookie, verify } from "../_lib/auth.js";
import { getData, putData } from "../_lib/store.js";

export async function onRequestGet({ request, env }) {
  const data = await getData(request, env);
  const token = readCookie(request, "novaa_admin");
  const admin = await verify(token, env.ADMIN_SESSION_SECRET || "");

  if (admin) {
    return json(data);
  }

  const publicFolders = (data.folders || [])
    .filter((folder) => !folder.hidden)
    .map((folder) => ({
      ...folder,
      products: (folder.products || []).filter((product) => !product.hidden)
    }));

  return json({ folders: publicFolders });
}

export async function onRequestPut({ request, env }) {
  const token = readCookie(request, "novaa_admin");
  const admin = await verify(token, env.ADMIN_SESSION_SECRET || "");
  if (!admin) {
    return json({ ok: false }, 401);
  }

  const payload = await request.json().catch(() => null);
  if (!payload) {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  try {
    await putData(env, payload);
    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, error: error.message }, 500);
  }
}
