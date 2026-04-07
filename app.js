const APPS_SCRIPT_URL = localStorage.getItem("novaa_script_url") || ""; 
// 👆 Isi string "" di atas dengan URL Apps Script Anda jika admin & halaman depan beda domain

const params = new URLSearchParams(location.search);
// Default: prefer `folders.json` so preview is consistent across devices (HP/laptop).
// Opt-in to local draft data (saved by /admin) via `?draft=1` or `localStorage.novaa_prefer_draft=1`.
const PREFER_LOCAL_DRAFT =
  params.get("draft") === "1" || localStorage.getItem("novaa_prefer_draft") === "1";

const state = {
  folders: [],
  query: "",
  openFolderIds: new Set(),
  favorites: new Set(JSON.parse(localStorage.getItem("novaa_favorites") || "[]")),
  showFavorites: false
};

const favToggle = document.getElementById("favToggle");
favToggle.addEventListener("click", () => {
  state.showFavorites = !state.showFavorites;
  if (state.showFavorites) favToggle.classList.add("active");
  else favToggle.classList.remove("active");
  render();
});

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
  renderSkeleton();
  
  try {
    let payload;
    try {
      const url = APPS_SCRIPT_URL;
      if (!url) throw new Error("no-url");
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error(`Failed: ${response.status}`);
      payload = await response.json();
    } catch (apiError) {
      // Fallback for local development
      const localData = localStorage.getItem("novaa_folders");

      if (PREFER_LOCAL_DRAFT && localData) {
        payload = { folders: JSON.parse(localData) };
      } else {
        try {
          const res = await fetch("/folders.json", { cache: "no-store" });
          if (!res.ok) throw new Error("Unable to load fallback JSON");
          payload = await res.json();
        } catch (jsonErr) {
          if (localData) payload = { folders: JSON.parse(localData) };
          else throw jsonErr;
        }
      }
    }

    state.folders = payload.folders || [];
    
    // Hilangkan skeleton dengan transisi halus
    folderGrid.style.opacity = '0';
    setTimeout(() => {
      render();
      folderGrid.style.transition = 'opacity 0.4s ease';
      folderGrid.style.opacity = '1';
      hydrateFromHash();
    }, 150);

  } catch (error) {
    folderGrid.innerHTML = `<div class="empty-state">Gagal memuat produk. Silakan refresh.</div>`;
    console.error(error);
  }
}

function renderSkeleton() {
  folderGrid.innerHTML = `
    <div class="skeleton-wrap">
      <div class="skeleton-card"></div>
      <div class="skeleton-card" style="animation-delay: 0.15s; opacity: 0.8;"></div>
      <div class="skeleton-card" style="animation-delay: 0.3s; opacity: 0.5;"></div>
    </div>
  `;
}

function render() {
  folderGrid.replaceChildren();
  const filtered = getFilteredFolders();

  if (filtered.length === 0) {
    folderGrid.innerHTML = `<div class="empty-state">Pencarian tidak ditemukan.</div>`;
    return;
  }

  filtered.forEach((folder) => {
    const card = folderTpl.content.firstElementChild.cloneNode(true);
    const head = card.querySelector(".folder-head");
    card.querySelector(".folder-id").textContent = `FOLDER ${folder.id}`;
    card.querySelector(".folder-meta").textContent = `${folder.products.length} produk`;

    const collage = card.querySelector(".folder-collage");
    const previewImages = folder.products.filter(p => Boolean(p.image)).slice(0, 3);
    if (previewImages.length > 0) {
      previewImages.forEach(p => {
        const img = document.createElement("img");
        img.src = p.image;
        img.className = "collage-img";
        collage.appendChild(img);
      });
    } else {
      collage.style.display = "none";
    }

    const productGrid = card.querySelector(".product-grid");
    folder.products.forEach((product) => {
      const item = productTpl.content.firstElementChild.cloneNode(true);
      item.id = `product-${product.id}`;
      const image = item.querySelector(".product-image");
      image.src = product.image || "";
      image.alt = product.name;

      item.querySelector(".product-name").textContent = product.name;

      const labelEl = item.querySelector(".product-label");
      const labelText = product.label || "Featured";
      labelEl.textContent = labelText;
      labelEl.className = "product-label " + getLabelVariant(labelText);

      item.querySelector(".product-price").textContent = product.price;
      item.querySelector(".product-description").textContent = product.description;

      const buy = item.querySelector(".buy-btn");
      buy.href = product.affiliateUrl;

      const favBtn = item.querySelector(".fav-btn");
      const goFolderBtn = item.querySelector(".go-folder-btn");
      
      const productId = product.id || product.originalId; 
      // Using productId from original folder if we injected it, or its own id
      const targetId = product.originalId || product.id; 

      if (state.favorites.has(targetId)) {
        favBtn.classList.add("active");
      } else {
        favBtn.classList.remove("active");
      }

      favBtn.addEventListener("click", () => {
        if (state.favorites.has(targetId)) {
          state.favorites.delete(targetId);
          favBtn.classList.remove("active");
        } else {
          state.favorites.add(targetId);
          favBtn.classList.add("active");
        }
        localStorage.setItem("novaa_favorites", JSON.stringify([...state.favorites]));
        // Re-render if we are in showFavorites mode so removed items disappear? 
        // Better UX to just leave it until they close, but for now we just change icon.
      });

      if (product.originalFolderId) {
        goFolderBtn.style.display = "";
        goFolderBtn.addEventListener("click", () => {
          // Go back to normal mode, open folder, scroll
          state.showFavorites = false;
          favToggle.classList.remove("active");
          state.openFolderIds.add(product.originalFolderId);
          
          // Clear query
          if (state.query) {
             state.query = "";
             searchInput.value = "";
          }

          render();

          // Scroll to product
          setTimeout(() => {
            const target = document.getElementById(`product-${targetId}`);
            if (target) {
              target.scrollIntoView({ behavior: "smooth", block: "center" });
              target.style.outline = "2px solid rgba(255,255,255,.5)";
              setTimeout(() => (target.style.outline = "none"), 2000);
            }
          }, 150);
        });
      }

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
  if (state.showFavorites) {
    const favProducts = [];
    state.folders.forEach((folder) => {
      folder.products.forEach((p) => {
        if (state.favorites.has(p.id)) {
          favProducts.push({ ...p, originalFolderId: folder.id, originalId: p.id });
        }
      });
    });

    if (favProducts.length === 0) {
      return [{
        id: "FAV",
        title: "Belum Ada Favorit",
        description: "Produk yang Anda simpan akan muncul di sini.",
        products: []
      }];
    }

    return [{
      id: "FAVORITES",
      title: "Produk Tersimpan",
      description: "Daftar semua produk favorit Anda.",
      products: favProducts
    }];
  }

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

function getLabelVariant(label) {
  const t = label.toLowerCase();
  if (t.includes("best") || t.includes("terlaris") || t.includes("populer")) return "bestseller";
  if (t.includes("sale") || t.includes("diskon") || t.includes("promo") || t.includes("flash")) return "sale";
  if (t.includes("new") || t.includes("baru") || t.includes("latest")) return "new";
  if (t.includes("hot") || t.includes("trending") || t.includes("viral")) return "hot";
  return "";
}
