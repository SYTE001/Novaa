const APPS_SCRIPT_URL = localStorage.getItem("novaa_script_url") || "";

const params = new URLSearchParams(location.search);
const PREFER_LOCAL_DRAFT =
  params.get("draft") === "1" || localStorage.getItem("novaa_prefer_draft") === "1";

const THEME_KEY = "novaa_theme";
const FAVORITES_KEY = "novaa_favorites";

const state = {
  folders: [],
  query: "",
  openFolderIds: new Set(),
  favorites: new Set(JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]")),
  showFavorites: false,
};

const folderGrid = document.getElementById("folderGrid");
const searchInput = document.getElementById("searchInput");
const folderTpl = document.getElementById("folderTemplate");
const productTpl = document.getElementById("productTemplate");
const favToggle = document.getElementById("favToggle");
const favCount = document.getElementById("favCount");
const tabAll = document.getElementById("tabAll");
const tabFav = document.getElementById("tabFav");
const toast = document.getElementById("toast");
const backToTop = document.getElementById("backToTop");
const topbar = document.getElementById("topbar");
const themeToggle = document.getElementById("themeToggle");

let revealObserver;
let imageObserver;
let toastTimeout;
let lastY = 0;
let ticking = false;

initTheme();
bindEvents();
init();

function bindEvents() {
  searchInput.addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    renderWithTransition();
  });

  favToggle.addEventListener("click", () => setFavoritesMode(!state.showFavorites));
  tabAll.addEventListener("click", () => setFavoritesMode(false));
  tabFav.addEventListener("click", () => setFavoritesMode(true));

  backToTop.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  window.addEventListener("scroll", onScroll, { passive: true });

  themeToggle.addEventListener("click", () => {
    const isDark = document.body.classList.toggle("dark");
    localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
    updateThemeToggle(isDark);
  });

  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", (event) => {
    if (localStorage.getItem(THEME_KEY)) return;
    document.body.classList.toggle("dark", event.matches);
    updateThemeToggle(event.matches);
  });
}

function setFavoritesMode(enabled) {
  state.showFavorites = enabled;
  favToggle.classList.toggle("active", enabled);
  tabFav.classList.toggle("active", enabled);
  tabAll.classList.toggle("active", !enabled);
  tabFav.setAttribute("aria-selected", String(enabled));
  tabAll.setAttribute("aria-selected", String(!enabled));
  renderWithTransition();
}

async function init() {
  renderSkeleton();

  try {
    const payload = await loadData();
    state.folders = payload.folders || [];
    updateFavoriteCounter();
    render();
    hydrateFromHash();
  } catch (error) {
    folderGrid.innerHTML = `<div class="empty-state">Gagal memuat produk. Coba refresh halaman.</div>`;
    console.error(error);
  }
}

async function loadData() {
  try {
    if (!APPS_SCRIPT_URL) throw new Error("missing-url");
    const response = await fetch(APPS_SCRIPT_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`Failed: ${response.status}`);
    return await response.json();
  } catch {
    const localData = localStorage.getItem("novaa_folders");
    if (PREFER_LOCAL_DRAFT && localData) {
      return { folders: JSON.parse(localData) };
    }

    try {
      const fallback = await fetch("/folders.json", { cache: "no-store" });
      if (!fallback.ok) throw new Error("fallback failed");
      return await fallback.json();
    } catch {
      if (localData) return { folders: JSON.parse(localData) };
      throw new Error("Semua sumber data gagal dimuat.");
    }
  }
}

function renderSkeleton() {
  folderGrid.innerHTML = `
    <div class="skeleton-grid">
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
    </div>
  `;
}

function renderWithTransition() {
  folderGrid.classList.add("fade-out");
  requestAnimationFrame(() => {
    render();
    folderGrid.classList.remove("fade-out");
    folderGrid.classList.add("fade-in");
    setTimeout(() => folderGrid.classList.remove("fade-in"), 180);
  });
}

function render() {
  folderGrid.replaceChildren();
  const filtered = getFilteredFolders();

  if (filtered.length === 0) {
    folderGrid.innerHTML = `<div class="empty-state">Produk tidak ditemukan. Coba kata kunci lain ya 👀</div>`;
    return;
  }

  filtered.forEach((folder, folderIndex) => {
    const card = folderTpl.content.firstElementChild.cloneNode(true);
    card.style.transitionDelay = `${folderIndex * 60}ms`;
    const head = card.querySelector(".folder-head");

    card.querySelector(".folder-id").textContent = folder.title || `Folder ${folder.id}`;
    card.querySelector(".folder-meta").textContent = `${folder.products.length} produk`;

    const collage = card.querySelector(".folder-collage");
    const previewImages = folder.products.filter((p) => Boolean(p.image)).slice(0, 3);
    if (previewImages.length) {
      previewImages.forEach((product) => {
        const img = document.createElement("img");
        img.src = product.image;
        img.className = "collage-img";
        img.alt = "";
        collage.appendChild(img);
      });
    }

    const productGrid = card.querySelector(".product-grid");
    folder.products.forEach((product, productIndex) => {
      const productId = product.originalId || product.id;
      const item = productTpl.content.firstElementChild.cloneNode(true);
      item.id = `product-${productId}`;
      item.style.transitionDelay = `${productIndex * 70}ms`;

      const image = item.querySelector(".product-image");
      image.dataset.src = product.image || "";
      image.alt = product.name || "Produk";

      item.querySelector(".product-name").textContent = product.name || "Tanpa Nama";
      const labelEl = item.querySelector(".product-label");
      const labelText = product.label || "Featured";
      labelEl.textContent = labelText;
      labelEl.className = `product-label ${getLabelVariant(labelText)}`;

      item.querySelector(".product-price").textContent = product.price || "Lihat detail";
      item.querySelector(".product-description").textContent = product.description || "Produk rekomendasi pilihan Novaa.";

      const buy = item.querySelector(".buy-btn");
      buy.href = product.affiliateUrl || "#";

      const favBtn = item.querySelector(".fav-btn");
      const goFolderBtn = item.querySelector(".go-folder-btn");
      syncFavoriteButtonState(favBtn, productId);

      favBtn.addEventListener("click", () => {
        toggleFavorite(productId, favBtn);
      });

      if (product.originalFolderId) {
        goFolderBtn.hidden = false;
        goFolderBtn.addEventListener("click", () => {
          state.showFavorites = false;
          state.openFolderIds.add(product.originalFolderId);
          searchInput.value = "";
          state.query = "";
          syncModeUI();
          renderWithTransition();
          setTimeout(() => {
            document.getElementById(`product-${productId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 220);
        });
      }

      productGrid.appendChild(item);
    });

    head.addEventListener("click", () => {
      if (state.openFolderIds.has(folder.id)) state.openFolderIds.delete(folder.id);
      else state.openFolderIds.add(folder.id);
      renderWithTransition();
    });

    if (state.openFolderIds.has(folder.id) || state.showFavorites) {
      card.classList.add("open");
    }

    folderGrid.appendChild(card);
  });

  setupObservers();
  updateFavoriteCounter();
  syncModeUI();
}

function getFilteredFolders() {
  if (state.showFavorites) {
    const favProducts = [];
    state.folders.forEach((folder) => {
      folder.products.forEach((product) => {
        if (state.favorites.has(product.id)) {
          favProducts.push({ ...product, originalFolderId: folder.id, originalId: product.id });
        }
      });
    });

    if (!favProducts.length) {
      return [{ id: "favorites-empty", title: "Favorit Saya", products: [] }];
    }

    return [{ id: "favorites", title: "Favorit Saya", products: favProducts }];
  }

  if (!state.query) return state.folders;

  return state.folders
    .map((folder) => {
      const folderText = [folder.title, folder.id, folder.description].filter(Boolean).join(" ").toLowerCase();
      const folderMatch = folderText.includes(state.query);

      const products = folder.products.filter((product) =>
        [product.name, product.description, product.label, product.price].filter(Boolean).join(" ").toLowerCase().includes(state.query)
      );

      if (folderMatch) return folder;
      if (products.length) return { ...folder, products };
      return null;
    })
    .filter(Boolean);
}

function syncFavoriteButtonState(button, productId) {
  const active = state.favorites.has(productId);
  button.classList.toggle("active", active);
  button.textContent = active ? "❤️" : "♡";
}

function toggleFavorite(productId, triggerButton) {
  const currentlyActive = state.favorites.has(productId);
  if (currentlyActive) {
    state.favorites.delete(productId);
  } else {
    state.favorites.add(productId);
    showToast("❤️ Ditambahkan ke favorit!");
  }

  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...state.favorites]));
  syncFavoriteButtonState(triggerButton, productId);
  updateFavoriteCounter();

  if (state.showFavorites && currentlyActive) {
    renderWithTransition();
  }
}

function updateFavoriteCounter() {
  favCount.textContent = String(state.favorites.size);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove("show"), 1600);
}

function setupObservers() {
  revealObserver?.disconnect();
  imageObserver?.disconnect();

  revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("visible");
        revealObserver.unobserve(entry.target);
      });
    },
    { threshold: 0.12 }
  );

  imageObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const img = entry.target;
        const src = img.dataset.src;
        if (src) {
          img.src = src;
          img.onload = () => img.classList.add("loaded");
        }
        imageObserver.unobserve(img);
      });
    },
    { rootMargin: "160px 0px" }
  );

  document.querySelectorAll(".reveal-item").forEach((el) => revealObserver.observe(el));
  document.querySelectorAll(".product-image").forEach((img) => imageObserver.observe(img));
}

function onScroll() {
  if (ticking) return;
  ticking = true;

  requestAnimationFrame(() => {
    const currentY = window.scrollY || 0;
    const isScrollingDown = currentY > lastY;

    topbar.classList.toggle("hide", isScrollingDown && currentY > 120);
    backToTop.classList.toggle("show", currentY > 300);

    lastY = currentY;
    ticking = false;
  });
}

function syncModeUI() {
  favToggle.classList.toggle("active", state.showFavorites);
  tabFav.classList.toggle("active", state.showFavorites);
  tabAll.classList.toggle("active", !state.showFavorites);
}

function hydrateFromHash() {
  if (!location.hash) return;
  const [folderId, productId] = location.hash.replace("#", "").split("/");
  if (!folderId) return;

  state.openFolderIds.add(folderId);
  renderWithTransition();

  if (!productId) return;
  setTimeout(() => {
    document.getElementById(`product-${productId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 260);
}

function initTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = stored ? stored === "dark" : systemPrefersDark;
  document.body.classList.toggle("dark", isDark);
  updateThemeToggle(isDark);
}

function updateThemeToggle(isDark) {
  themeToggle.textContent = isDark ? "☀️" : "🌙";
}

function getLabelVariant(label) {
  const t = label.toLowerCase();
  if (t.includes("best") || t.includes("terlaris") || t.includes("populer")) return "bestseller";
  if (t.includes("sale") || t.includes("diskon") || t.includes("promo") || t.includes("flash")) return "sale";
  if (t.includes("new") || t.includes("baru") || t.includes("latest")) return "new";
  if (t.includes("hot") || t.includes("trending") || t.includes("viral")) return "hot";
  return "";
}
