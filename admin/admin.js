// ─────────────────────────────────────────────────────────────
//  ⚙️ KONFIGURASI — Isi URL Apps Script Anda di sini
// ─────────────────────────────────────────────────────────────
const APPS_SCRIPT_URL = localStorage.getItem("novaa_script_url") || "";

// ─────────────────────────────────────────────────────────────

const content     = document.getElementById("adminContent");
const addFolderBtn= document.getElementById("addFolderBtn");
const addProductBtn=document.getElementById("addProductBtn");
const syncBtn     = document.getElementById("syncBtn");
const syncStatus  = document.getElementById("syncStatus");
const scriptUrlBtn= document.getElementById("scriptUrlBtn");
const dialog      = document.getElementById("editDialog");
const dialogTitle = document.getElementById("dialogTitle");
const formFields  = document.getElementById("formFields");
const editForm    = document.getElementById("editForm");
const cancelBtn   = document.getElementById("cancelBtn");

const state = { folders: [], editType: null, editRef: null, syncing: false };

addFolderBtn .addEventListener("click", () => openFolderDialog());
addProductBtn.addEventListener("click", () => openProductDialog());
cancelBtn    .addEventListener("click", () => dialog.close());
syncBtn      .addEventListener("click", () => syncAllToSheet());
scriptUrlBtn .addEventListener("click", () => promptScriptUrl());

editForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  await saveDialog();
});

init();

// ─── Init ────────────────────────────────────────────────────
async function init() {
  updateSyncBadge();

  // Error jika URL belum diset
  if (!getScriptUrl()) {
    showBanner("⚠️ Apps Script URL belum diset. Klik tombol ⚙️ URL Script untuk mengisi.", "warn");
  }

  let payload;
  try {
    const url = getScriptUrl();
    if (!url) throw new Error("no-url");
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("Fetch failed: " + res.status);
    payload = await res.json();
  } catch (err) {
    // Fallback ke localStorage
    const local = localStorage.getItem("novaa_folders");
    payload = local ? { folders: JSON.parse(local) } : { folders: [] };
    if (err.message !== "no-url") {
      showBanner("Tidak dapat terhubung ke Spreadsheet. Menampilkan data lokal.", "warn");
    }
  }

  state.folders = payload.folders || [];
  render();
}

// ─── Render ──────────────────────────────────────────────────
function render() {
  content.replaceChildren();

  if (state.folders.length === 0) {
    content.innerHTML = `<div class="empty-admin">Belum ada folder. Klik <strong>Add Folder</strong> untuk mulai.</div>`;
    return;
  }

  state.folders.forEach((folder) => {
    const el = document.createElement("section");
    el.className = "folder" + (folder.hidden ? " folder--hidden" : "");

    const hiddenBadge = folder.hidden ? `<span class="badge badge--muted">Hidden</span>` : "";
    el.innerHTML = `
      <div class="folder-head">
        <div class="folder-head-info">
          <h2>${escapeHtml(folder.title)} ${hiddenBadge}</h2>
          <p class="folder-meta">ID: <code>${escapeHtml(folder.id)}</code> · ${folder.products.length} produk</p>
        </div>
        <div class="row">
          <button class="ghost small" data-action="add-product-in-folder" data-folder-id="${encodeURIComponent(folder.id)}">+ Produk</button>
          <button class="ghost small" data-action="edit-folder" data-folder-id="${encodeURIComponent(folder.id)}">Edit</button>
          <button class="ghost small" data-action="toggle-folder" data-folder-id="${encodeURIComponent(folder.id)}">${folder.hidden ? "Unhide" : "Hide"}</button>
          <button class="danger small" data-action="delete-folder" data-folder-id="${encodeURIComponent(folder.id)}">Delete</button>
        </div>
      </div>
      <div class="products"></div>
    `;

    const productsRoot = el.querySelector(".products");
    if (folder.products.length === 0) {
      productsRoot.innerHTML = `<p class="folder-meta" style="padding:.6rem 1rem;">Belum ada produk di folder ini.</p>`;
    }

    folder.products.forEach((product) => {
      const row = document.createElement("article");
      row.className = "product" + (product.hidden ? " product--hidden" : "");
      row.innerHTML = `
        <img src="${escapeAttr(product.image || "")}" alt="${escapeAttr(product.name)}" />
        <div class="product-info">
          <strong>${escapeHtml(product.name)} ${product.hidden ? `<span class="badge badge--muted">Hidden</span>` : ""}</strong>
          <p class="folder-meta">${escapeHtml(product.price)} · <span class="badge">${escapeHtml(product.label || "")}</span></p>
          <p class="folder-meta muted">${escapeHtml(product.id)}</p>
        </div>
        <div class="row">
          <button class="ghost small" data-action="edit-product" data-folder-id="${encodeURIComponent(folder.id)}" data-product-id="${encodeURIComponent(product.id)}">Edit</button>
          <button class="ghost small" data-action="toggle-product" data-folder-id="${encodeURIComponent(folder.id)}" data-product-id="${encodeURIComponent(product.id)}">${product.hidden ? "Unhide" : "Hide"}</button>
          <button class="danger small" data-action="delete-product" data-folder-id="${encodeURIComponent(folder.id)}" data-product-id="${encodeURIComponent(product.id)}">Delete</button>
        </div>
      `;
      productsRoot.appendChild(row);
    });

    content.appendChild(el);
  });
}

// ─── Action dispatcher ───────────────────────────────────────
content.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;

  const action    = btn.dataset.action;
  const folderId  = decodeURIComponent(btn.dataset.folderId || "");
  const productId = decodeURIComponent(btn.dataset.productId || "");

  if (action === "add-product-in-folder") {
    openProductDialog(null, folderId);
    return;
  }
  if (action === "edit-folder") {
    const folder = findFolder(folderId);
    if (folder) openFolderDialog(folder);
    return;
  }
  if (action === "toggle-folder") {
    const folder = findFolder(folderId);
    if (folder) { folder.hidden = !folder.hidden; await persist(); }
    return;
  }
  if (action === "delete-folder") {
    if (!confirm(`Hapus folder "${folderId}" dan semua produknya?`)) return;
    state.folders = state.folders.filter(f => f.id !== folderId);
    await persist("DELETE_FOLDER", { folderID: folderId });
    return;
  }

  const folder  = findFolder(folderId);
  if (!folder) return;
  const product = folder.products.find(p => p.id === productId);

  if (action === "edit-product") {
    if (product) openProductDialog(product, folder.id);
    return;
  }
  if (action === "toggle-product") {
    if (product) { product.hidden = !product.hidden; await persist(); }
    return;
  }
  if (action === "delete-product") {
    if (!confirm(`Hapus produk "${product?.name}"?`)) return;
    folder.products = folder.products.filter(p => p.id !== productId);
    await persist("DELETE_PRODUCT", { productID: productId });
  }
});

// ─── Dialogs ─────────────────────────────────────────────────
function openFolderDialog(folder) {
  state.editType = "folder";
  state.editRef  = folder?.id || null;
  dialogTitle.textContent = folder ? "Edit Folder" : "Add Folder";
  formFields.innerHTML = `
    <label>Folder ID<input name="id" required value="${escapeAttr(folder?.id || generateId("fld"))}" /></label>
    <label>Title<input name="title" required value="${escapeAttr(folder?.title || "")}" /></label>
    <label>Description<textarea name="description">${escapeHtml(folder?.description || "")}</textarea></label>
  `;
  dialog.showModal();
}

function openProductDialog(product, presetFolderId = "") {
  state.editType = "product";
  state.editRef  = product ? `${presetFolderId}::${product.id}` : null;
  dialogTitle.textContent = product ? "Edit Produk" : "Tambah Produk";

  const folderOptions = state.folders
    .map(f => `<option value="${escapeAttr(f.id)}" ${f.id === presetFolderId ? "selected" : ""}>${escapeHtml(f.title)} (${escapeHtml(f.id)})</option>`)
    .join("");

  formFields.innerHTML = `
    <label>Folder
      <select name="folderId" required>
        <option value="">— Pilih Folder —</option>
        ${folderOptions}
      </select>
    </label>
    <label>Nama Produk<input name="name" required value="${escapeAttr(product?.name || "")}" /></label>
    <label>Image URL<input name="image" type="url" value="${escapeAttr(product?.image || "")}" placeholder="https://..." /></label>
    <label>Harga<input name="price" required value="${escapeAttr(product?.price || "")}" placeholder="Rp149.000" /></label>
    <label>Label<input name="label" value="${escapeAttr(product?.label || "")}" placeholder="Best Seller / Flash Sale / dll" /></label>
    <label>Deskripsi<textarea name="description">${escapeHtml(product?.description || "")}</textarea></label>
    <label>Affiliate URL<input name="affiliateUrl" type="url" required value="${escapeAttr(product?.affiliateUrl || "")}" /></label>
  `;
  dialog.showModal();
}

async function saveDialog() {
  const fields = Object.fromEntries(new FormData(editForm).entries());

  if (state.editType === "folder") {
    const existing = state.folders.find(f => f.id === state.editRef);
    if (existing) {
      existing.id          = fields.id.trim();
      existing.title       = fields.title.trim();
      existing.description = fields.description.trim();
    } else {
      const newFolder = { id: fields.id.trim(), title: fields.title.trim(), description: fields.description.trim(), hidden: false, products: [] };
      state.folders.push(newFolder);
    }
  }

  if (state.editType === "product") {
    const targetFolderId = fields.folderId.trim();
    const folder = findFolder(targetFolderId);
    if (!folder) { alert("Folder ID tidak ditemukan."); return; }

    // Find existing product across all folders
    const existing = state.editRef
      ? state.folders
          .flatMap(f => f.products.map(p => ({ folder: f, product: p })))
          .find(e => `${e.folder.id}::${e.product.id}` === state.editRef)
      : null;

    // Move product if folder changed
    if (existing && existing.folder.id !== targetFolderId) {
      existing.folder.products = existing.folder.products.filter(p => p.id !== existing.product.id);
    }

    const target = existing?.product || { id: generateId("prd"), hidden: false };
    target.name         = fields.name.trim();
    target.image        = fields.image.trim();
    target.price        = fields.price.trim();
    target.label        = fields.label.trim();
    target.description  = fields.description.trim();
    target.affiliateUrl = fields.affiliateUrl.trim();

    if (!existing || existing.folder.id !== targetFolderId) {
      folder.products.push(target);
    }
  }

  dialog.close();
  await persist();
}

// ─── Persist: save locally + optionally ping Sheet ───────────
async function persist(directAction, directPayload) {
  // Always save to localStorage as backup
  localStorage.setItem("novaa_folders", JSON.stringify(state.folders));
  render();

  // If direct action provided, send specific request
  if (directAction && getScriptUrl()) {
    await callSheet({ action: directAction, ...directPayload });
  }

  updateSyncBadge();
}

// ─── Sync All to Sheet ───────────────────────────────────────
async function syncAllToSheet() {
  if (state.syncing) return;
  const url = getScriptUrl();
  if (!url) {
    promptScriptUrl();
    return;
  }

  state.syncing = true;
  setSyncLoading(true);

  const result = await callSheet({ action: "SAVE_ALL", folders: state.folders });

  state.syncing = false;
  setSyncLoading(false);

  if (result?.status === "success") {
    localStorage.setItem("novaa_last_sync", new Date().toISOString());
    updateSyncBadge();
    showBanner("✅ " + (result.message || "Sync berhasil ke Spreadsheet!"), "success");
  } else {
    showBanner("❌ Sync gagal: " + (result?.message || "Periksa URL Apps Script."), "error");
  }
}

async function callSheet(payload) {
  const url = getScriptUrl();
  if (!url) return null;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain" }, // GAS requires text/plain for CORS
      body: JSON.stringify(payload)
    });
    return await res.json();
  } catch (err) {
    console.error("callSheet error:", err);
    return { status: "error", message: err.message };
  }
}

// ─── Script URL management ───────────────────────────────────
function getScriptUrl() {
  return localStorage.getItem("novaa_script_url") || "";
}

function promptScriptUrl() {
  const current = getScriptUrl();
  const url = prompt(
    "Masukkan Apps Script Web App URL:\n(Dapatkan dari Apps Script → Deploy → Manage Deployments)",
    current
  );
  if (url && url.trim().startsWith("https://")) {
    localStorage.setItem("novaa_script_url", url.trim());
    showBanner("✅ URL tersimpan. Memuat data dari Spreadsheet...", "success");
    setTimeout(() => init(), 800);
  } else if (url !== null) {
    showBanner("URL tidak valid. Harus diawali dengan https://", "error");
  }
}

// ─── UI helpers ──────────────────────────────────────────────
function setSyncLoading(loading) {
  syncBtn.disabled = loading;
  syncBtn.textContent = loading ? "Menyimpan…" : "🔄 Sync ke Sheet";
}

function updateSyncBadge() {
  const url      = getScriptUrl();
  const lastSync = localStorage.getItem("novaa_last_sync");
  const hasUrl   = Boolean(url);

  if (!hasUrl) {
    syncStatus.textContent = "⚠️ URL belum diset";
    syncStatus.className = "sync-status sync-status--warn";
  } else if (lastSync) {
    const d = new Date(lastSync);
    syncStatus.textContent = `✓ Sync: ${d.toLocaleDateString("id-ID")} ${d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`;
    syncStatus.className = "sync-status sync-status--ok";
  } else {
    syncStatus.textContent = "Belum pernah sync";
    syncStatus.className = "sync-status";
  }
}

let bannerTimer;
function showBanner(msg, type = "info") {
  let banner = document.getElementById("adminBanner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "adminBanner";
    document.querySelector(".admin-top").after(banner);
  }
  banner.textContent = msg;
  banner.className = `admin-banner admin-banner--${type}`;
  clearTimeout(bannerTimer);
  if (type !== "warn") {
    bannerTimer = setTimeout(() => { banner.className = "admin-banner"; }, 4000);
  }
}

// ─── Utils ───────────────────────────────────────────────────
function findFolder(folderId) {
  return state.folders.find(f => f.id === folderId);
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#96;");
}

function generateId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}
