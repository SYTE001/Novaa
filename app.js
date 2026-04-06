const state = {
  folders: [],
  query: "",
  openFolderIds: new Set()
};

const folderGrid = document.getElementById("folderGrid");
const searchInput = document.getElementById("searchInput");
const folderTpl = document.getElementById("folderTemplate");
const productTpl = document.getElementById("productTemplate");

searchInput.addEventListener("input", (event) => {
  state.query = event.target.value.trim().toLowerCase();
  render();
});

init();

async function init() {
  try {
    const response = await fetch("/api/data", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed: ${response.status}`);
    }

    const payload = await response.json();
    state.folders = payload.folders || [];
    hydrateFromHash();
    render();
  } catch (error) {
    folderGrid.innerHTML = `<div class="empty-state">Unable to load products. Please refresh.</div>`;
    console.error(error);
  }
}

function render() {
  folderGrid.replaceChildren();
  const filtered = getFilteredFolders();

  if (filtered.length === 0) {
    folderGrid.innerHTML = `<div class="empty-state">No results found.</div>`;
    return;
  }

  filtered.forEach((folder) => {
    const card = folderTpl.content.firstElementChild.cloneNode(true);
    const head = card.querySelector(".folder-head");
    card.querySelector(".folder-id").textContent = `Folder ${folder.id}`;
    card.querySelector(".folder-title").textContent = folder.title;
    card.querySelector(".folder-desc").textContent = folder.description || "";
    card.querySelector(".folder-meta").textContent = `${folder.products.length} items`;

    const productGrid = card.querySelector(".product-grid");
    folder.products.forEach((product) => {
      const item = productTpl.content.firstElementChild.cloneNode(true);
      item.id = `product-${product.id}`;
      const image = item.querySelector(".product-image");
      image.src = product.image || "";
      image.alt = product.name;

      item.querySelector(".product-name").textContent = product.name;
      item.querySelector(".product-label").textContent = product.label || "Featured";
      item.querySelector(".product-price").textContent = product.price;
      item.querySelector(".product-description").textContent = product.description;

      const buy = item.querySelector(".buy-btn");
      buy.href = product.affiliateUrl;

      const copy = item.querySelector(".copy-btn");
      copy.addEventListener("click", async () => {
        const deepLink = `${location.origin}${location.pathname}#${folder.id}/${product.id}`;
        await navigator.clipboard.writeText(deepLink);
        copy.textContent = "Copied!";
        setTimeout(() => (copy.textContent = "Copy Link"), 1400);
      });

      productGrid.appendChild(item);
    });

    head.addEventListener("click", () => {
      if (state.openFolderIds.has(folder.id)) {
        state.openFolderIds.delete(folder.id);
      } else {
        state.openFolderIds.add(folder.id);
      }
      render();
    });

    if (state.openFolderIds.has(folder.id)) {
      card.classList.add("open");
    }

    folderGrid.appendChild(card);
  });
}

function getFilteredFolders() {
  if (!state.query) {
    return state.folders;
  }

  return state.folders
    .map((folder) => {
      const folderMatch = [folder.title, folder.id, folder.description]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(state.query);

      const products = folder.products.filter((product) => {
        const productText = [product.name, product.description, product.label, product.price]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return productText.includes(state.query);
      });

      if (folderMatch) {
        return folder;
      }

      if (products.length > 0) {
        return { ...folder, products };
      }

      return null;
    })
    .filter(Boolean);
}

function hydrateFromHash() {
  if (!location.hash) return;
  const [folderId, productId] = location.hash.replace("#", "").split("/");
  if (!folderId) return;

  state.openFolderIds.add(folderId);

  window.requestAnimationFrame(() => {
    if (!productId) return;
    const target = document.getElementById(`product-${productId}`);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.style.outline = "2px solid rgba(255,255,255,.5)";
      setTimeout(() => (target.style.outline = "none"), 2000);
    }
  });
}
