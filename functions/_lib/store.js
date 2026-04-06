export async function getData(request, env) {
  if (env.AFFILIATE_DB) {
    const stored = await env.AFFILIATE_DB.get("folders", { type: "json" });
    if (stored?.folders) {
      return stored;
    }
  }

  const fallback = await env.ASSETS.fetch(new Request(new URL("/folders.json", request.url)));
  if (!fallback.ok) {
    return { folders: [] };
  }

  return await fallback.json();
}

export async function putData(env, value) {
  if (!env.AFFILIATE_DB) {
    throw new Error("KV binding AFFILIATE_DB is missing");
  }

  if (!value || !Array.isArray(value.folders)) {
    throw new Error("Invalid payload");
  }

  await env.AFFILIATE_DB.put("folders", JSON.stringify(value));
}
