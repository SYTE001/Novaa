const content = document.getElementById("adminContent");
const addFolderBtn = document.getElementById("addFolderBtn");
const addProductBtn = document.getElementById("addProductBtn");
const logoutBtn = document.getElementById("logoutBtn");
const dialog = document.getElementById("editDialog");
const dialogTitle = document.getElementById("dialogTitle");
const formFields = document.getElementById("formFields");
const editForm = document.getElementById("editForm");
const cancelBtn = document.getElementById("cancelBtn");

const state = { folders: [], editType: null, editRef: null };

addFolderBtn.addEventListener("click", () => openFolderDialog());
addProductBtn.addEventListener("click", () => openProductDialog());
cancelBtn.addEventListener("click", () => dialog.close());
logoutBtn.addEventListener("click", async () => {
  await fetch("/api/auth/logout", { method: "POST" });
  location.href = "/admin/login.html";
});

editForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await saveDialog();
});

init();

async function init() {
  const response = await fetch("/api/data", { cache: "no-store" });
  if (response.status === 401) {
    location.href = "/admin/login.html";
    return;
  }

  const payload = await response.json();
  state.folders = payload.folders || [];
  render();
}

function render() {
  content.replaceChildren();
  state.folders.forEach((folder) => {
    const el = document.createElement("section");
    el.className = "folder";

    const hiddenLabel = folder.hidden ? " (Hidden)" : "";
    el.innerHTML = `
      <div class="folder-head">
        <div>
          <h2>${escapeHtml(folder.title)}${hiddenLabel}</h2>
          <p class="folder-meta">Folder ID: ${escapeHtml(folder.id)} · ${folder.products.length} products</p>
        </div>
        <div class="row">
          <button class="ghost small" data-action="edit-folder" data-folder-id="${encodeURIComponent(folder.id)}">Edit</button>
          <button class="ghost small" data-action="toggle-folder" data-folder-id="${encodeURIComponent(folder.id)}">${folder.hidden ? "Unhide" : "Hide"}</button>
          <button class="danger small" data-action="delete-folder" data-folder-id="${encodeURIComponent(folder.id)}">Delete</button>
        </div>
      </div>
      <div class="products"></div>
    `;

    const productsRoot = el.querySelector(".products");
    folder.products.forEach((product) => {
      const row = document.createElement("article");
      row.className = "product";
      row.innerHTML = `
        <img src="${escapeAttr(product.image || "")}" alt="${escapeAttr(product.name)}" />
        <div>
          <strong>${escapeHtml(product.name)} ${product.hidden ? "(Hidden)" : ""}</strong>
          <p class="folder-meta">${escapeHtml(product.price)} · ${escapeHtml(product.label || "")}</p>
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

content.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const action = button.dataset.action;
  const folderId = decodeURIComponent(button.dataset.folderId || "");
  const productId = decodeURIComponent(button.dataset.productId || "");

  if (action === "edit-folder") {
    const folder = findFolder(folderId);
    if (folder) openFolderDialog(folder);
    return;
  }

  if (action === "toggle-folder") {
    const folder = findFolder(folderId);
    if (folder) {
      folder.hidden = !folder.hidden;
      persist();
    }
    return;
  }

  if (action === "delete-folder") {
    state.folders = state.folders.filter((folder) => folder.id !== folderId);
    persist();
    return;
  }

  const folder = findFolder(folderId);
  if (!folder) return;
  const product = folder.products.find((entry) => entry.id === productId);

  if (action === "edit-product") {
    if (product) openProductDialog(product, folder.id);
    return;
  }

  if (action === "toggle-product") {
    if (product) {
      product.hidden = !product.hidden;
      persist();
    }
    return;
  }

  if (action === "delete-product") {
    folder.products = folder.products.filter((entry) => entry.id !== productId);
    persist();
  }
});

function openFolderDialog(folder) {
  state.editType = "folder";
  state.editRef = folder?.id || null;
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
  state.editRef = product ? `${presetFolderId}::${product.id}` : null;
  dialogTitle.textContent = product ? "Edit Product" : "Add Product";
  formFields.innerHTML = `
    <label>Product Name<input name="name" required value="${escapeAttr(product?.name || "")}" /></label>
    <label>Folder ID<input name="folderId" required value="${escapeAttr(presetFolderId)}" /></label>
    <label>Image URL<input name="image" required value="${escapeAttr(product?.image || "")}" /></label>
    <label>Price<input name="price" required value="${escapeAttr(product?.price || "")}" /></label>
    <label>Label<input name="label" value="${escapeAttr(product?.label || "")}" placeholder="Best Seller" /></label>
    <label>Short Description<textarea name="description" required>${escapeHtml(product?.description || "")}</textarea></label>
    <label>Affiliate URL<input name="affiliateUrl" required value="${escapeAttr(product?.affiliateUrl || "")}" /></label>
  `;
  dialog.showModal();
}

async function saveDialog() {
  const fields = Object.fromEntries(new FormData(editForm).entries());

  if (state.editType === "folder") {
    const existing = state.folders.find((folder) => folder.id === state.editRef);
    if (existing) {
      existing.id = fields.id.trim();
      existing.title = fields.title.trim();
      existing.description = fields.description.trim();
    } else {
      state.folders.push({ id: fields.id.trim(), title: fields.title.trim(), description: fields.description.trim(), hidden: false, products: [] });
    }
  }

  if (state.editType === "product") {
    const folder = findFolder(fields.folderId.trim());
    if (!folder) {
      alert("Folder ID not found.");
      return;
    }

    const existing = state.editRef
      ? state.folders
          .flatMap((entry) => entry.products.map((product) => ({ folder: entry, product })))
          .find((entry) => `${entry.folder.id}::${entry.product.id}` === state.editRef)
      : null;

    if (existing && existing.folder.id !== folder.id) {
      existing.folder.products = existing.folder.products.filter((p) => p.id !== existing.product.id);
    }

    const target = existing?.product || { id: generateId("prd"), hidden: false };
    target.name = fields.name.trim();
    target.image = fields.image.trim();
    target.price = fields.price.trim();
    target.label = fields.label.trim();
    target.description = fields.description.trim();
    target.affiliateUrl = fields.affiliateUrl.trim();

    if (!existing || existing.folder.id !== folder.id) {
      folder.products.push(target);
    }
  }

  dialog.close();
  await persist();
}

async function persist() {
  await fetch("/api/data", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ folders: state.folders })
  });
  render();
}

function findFolder(folderId) {
  return state.folders.find((folder) => folder.id === folderId);
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
