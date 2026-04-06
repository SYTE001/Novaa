document.addEventListener('DOMContentLoaded', () => {
    const folderGrid      = document.getElementById('folderGrid');
    const searchInput     = document.getElementById('searchInput');
    const detailView      = document.getElementById('detailView');
    const backBtn         = document.getElementById('backBtn');
    const detailCode      = document.getElementById('detailCode');
    const detailTitle     = document.getElementById('detailTitle');
    const productList     = document.getElementById('productList');

    const productModalOverlay = document.getElementById('productModalOverlay');
    const closeProductBtn     = document.getElementById('closeProductBtn');
    const pmBody              = document.getElementById('pmBody');
    const pmFooter            = document.getElementById('pmFooter');

    let foldersData    = [];
    let currentFolder  = null;
    let currentProduct = null;

    const SPREADSHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRD34qgiaE5rXVFZRweqtjcJMOc4ZoiSp5Xt12jZI5n1_rFEeb6VMVb55VICP84TVXHLFBQaAHGSuJl/pub?output=csv";

    // ─── Image Fallback Helper ─────────────────────────────────────────────────
    const FALLBACK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 16.5V7.125A2.625 2.625 0 015.625 4.5h12.75A2.625 2.625 0 0121 7.125V16.5m-6-9h.008v.008H15V7.5z" />
    </svg>`;

    function makeImgWithFallback(src, alt, cssClass, fallbackClass) {
        if (!src) {
            return `<div class="${fallbackClass}">${FALLBACK_SVG}</div>`;
        }
        return `<img src="${src}" alt="${alt}" class="${cssClass}" loading="lazy" onerror="this.outerHTML='<div class=\\'${fallbackClass}\\'>${FALLBACK_SVG.replace(/"/g, '\\'')}</div>'">`;
    }

    // ─── Load Data ─────────────────────────────────────────────────────────────
    Papa.parse(SPREADSHEET_CSV_URL, {
        download: true,
        header: true,
        skipEmptyLines: true,
        beforeFirstChunk: function(chunk) {
            let lines = chunk.split('\n');
            let headerIndex = lines.findIndex(line => line.toLowerCase().includes('nama produk'));
            if (headerIndex !== -1) return lines.slice(headerIndex).join('\n');
            return chunk;
        },
        complete: function(results) {
            processSpreadsheetData(results.data);
        },
        error: function(err) {
            console.error('Error parsing CSV:', err);
            folderGrid.innerHTML = '<div class="empty-state">⚠️ Gagal memuat data.<p>Periksa koneksi internet Anda.</p></div>';
        }
    });

    function processSpreadsheetData(rows) {
        const foldersMap = {};
        let folderCount  = 1;

        rows.forEach((row, index) => {
            if (!row['Nama Produk'] || row['Nama Produk'].trim() === '') return;

            const status = row['Status'] ? row['Status'].toLowerCase().trim() : 'aktif';
            if (status !== 'aktif' && status !== '') return;

            const kategori = row['Kategori'] ? row['Kategori'].trim() : 'Uncategorized';

            if (!foldersMap[kategori]) {
                let codeMatch    = kategori.match(/^(\d+)/);
                let generatedCode = codeMatch ? codeMatch[1] : `KAT${folderCount.toString().padStart(3, '0')}`;
                foldersMap[kategori] = { code: generatedCode, title: kategori, products: [] };
                folderCount++;
            }

            let fPrice = row['Harga Jual (Rp)'] ? row['Harga Jual (Rp)'].trim() : '';
            fPrice = fPrice ? (fPrice.toLowerCase().startsWith('rp') ? fPrice : `Rp ${fPrice}`) : '';

            let fOrig = row['Harga Coret (Rp)'] ? row['Harga Coret (Rp)'].trim() : '';
            fOrig = fOrig ? (fOrig.toLowerCase().startsWith('rp') ? fOrig : `Rp ${fOrig}`) : '';

            let fDiscount = row['Diskon (%)'] ? row['Diskon (%)'].trim() : '';
            if (fDiscount && !fDiscount.includes('%')) fDiscount += '%';

            let soldL   = row['Label Terjual'] ? row['Label Terjual'].trim() : '';
            let ratingL = row['Rating'] ? row['Rating'].trim() : '';
            if (ratingL) ratingL = ratingL.replace(',', '.');

            foldersMap[kategori].products.push({
                id:            `scsv_${index}`,
                name:          row['Nama Produk'].trim(),
                image:         row['URL Gambar'] ? row['URL Gambar'].trim() : '',
                price:         fPrice,
                originalPrice: fOrig,
                discount:      fDiscount,
                soldCount:     soldL,
                rating:        ratingL,
                description:   row['Deskripsi'] ? row['Deskripsi'].trim() : '',
                shopeeLink:    row['Link Shopee'] ? row['Link Shopee'].trim() : '#'
            });
        });

        foldersData = Object.values(foldersMap);
        renderFolders(foldersData);
        handleHashOnLoad();
    }

    // ─── Render Folders ────────────────────────────────────────────────────────
    function renderFolders(folders) {
        folderGrid.innerHTML = '';
        folderGrid.className = 'folder-grid'; // Reset to grid mode

        if (folders.length === 0) {
            folderGrid.innerHTML = '<div class="empty-state">Tidak ada kategori ditemukan.</div>';
            return;
        }

        folders.forEach((folder, index) => {
            const card = document.createElement('div');
            card.className = 'folder-card animate-fade-in';
            card.style.animationDelay = `${index * 0.05}s`;

            const previewImages = folder.products.slice(0, 4).map(p => p.image);
            let gridHTML = '<div class="folder-preview-grid">';

            for (let i = 0; i < 4; i++) {
                if (previewImages[i]) {
                    gridHTML += `<img src="${previewImages[i]}" alt="Preview" class="folder-preview-item" loading="lazy" onerror="this.style.display='none'">`;
                } else {
                    gridHTML += `<div class="folder-empty-slot"></div>`;
                }
            }
            gridHTML += '</div>';

            card.innerHTML = `
                ${gridHTML}
                <div class="folder-code">#${folder.code}</div>
                <div class="folder-title">${folder.title}</div>
            `;

            card.addEventListener('click', () => openFolder(folder));
            folderGrid.appendChild(card);
        });
    }

    // ─── Search — folders + produk ─────────────────────────────────────────────
    searchInput.addEventListener('input', (e) => {
        const q = e.target.value.trim().toLowerCase();

        if (q === '') {
            renderFolders(foldersData);
            return;
        }

        // Cek apakah ada produk yang cocok
        const productMatches = [];
        foldersData.forEach(folder => {
            folder.products.forEach(p => {
                if (p.name.toLowerCase().includes(q) || folder.title.toLowerCase().includes(q) || folder.code.toLowerCase().includes(q)) {
                    productMatches.push({ product: p, folder });
                }
            });
        });

        // Jika query sangat pendek (1-2 huruf), cukup filter folder
        const folderMatches = foldersData.filter(f =>
            f.code.toLowerCase().includes(q) || f.title.toLowerCase().includes(q)
        );

        if (q.length <= 2) {
            renderFolders(folderMatches);
            return;
        }

        // Prioritas: folder exact match → product matches
        if (folderMatches.length > 0 && productMatches.length === 0) {
            renderFolders(folderMatches);
        } else {
            renderSearchResults(productMatches, q);
        }
    });

    function renderSearchResults(matches, q) {
        folderGrid.innerHTML = '';
        folderGrid.className = 'folder-grid'; // tetap di container yang sama

        if (matches.length === 0) {
            folderGrid.innerHTML = `<div class="empty-state">Tidak ada hasil untuk "<strong>${q}</strong>".<p>Coba kata kunci lain.</p></div>`;
            return;
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'search-results-list';
        wrapper.style.cssText = 'grid-column: 1/-1';

        matches.forEach(({ product, folder }, i) => {
            const item = document.createElement('div');
            item.className = 'search-result-item animate-fade-in';
            item.style.animationDelay = `${i * 0.04}s`;

            item.innerHTML = `
                ${makeImgWithFallback(product.image, product.name, 'search-result-img', 'product-img-fallback')}
                <div class="search-result-info">
                    <div class="search-result-name">${product.name}</div>
                    <div class="search-result-cat">${folder.title}</div>
                </div>
                <div class="search-result-price">${product.price}</div>
            `;

            item.addEventListener('click', () => {
                openFolder(folder);
                setTimeout(() => openProductModal(product), 350);
            });

            wrapper.appendChild(item);
        });

        folderGrid.appendChild(wrapper);
    }

    // ─── Open Folder Detail ────────────────────────────────────────────────────
    function openFolder(folder) {
        currentFolder = folder;
        detailCode.textContent  = `#${folder.code}`;
        detailTitle.textContent = folder.title;
        productList.innerHTML   = '';

        folder.products.forEach((product, index) => {
            const pCard = document.createElement('div');
            pCard.className = 'product-card animate-fade-in';
            pCard.style.animationDelay = `${index * 0.05}s`;

            pCard.innerHTML = `
                ${makeImgWithFallback(product.image, product.name, 'product-image', 'product-img-fallback')}
                <div class="product-info">
                    <div class="product-name">${product.name}</div>
                    <div class="product-price">${product.price}</div>
                </div>
            `;

            pCard.addEventListener('click', () => openProductModal(product));
            productList.appendChild(pCard);
        });

        detailView.classList.add('active');
        document.body.style.overflow = 'hidden';
        window.history.pushState({ view: 'folder', code: folder.code }, '', `#${folder.code}`);
    }

    function closeFolder() {
        detailView.classList.remove('active');
        document.body.style.overflow = '';
        currentFolder = null;
        if (window.location.hash) {
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
    }

    backBtn.addEventListener('click', () => {
        if (window.history.state?.view === 'folder') window.history.back();
        else closeFolder();
    });

    // ─── Product Modal ─────────────────────────────────────────────────────────
    function openProductModal(product) {
        currentProduct = product;

        let badgesHTML = '';
        if (product.discount)  badgesHTML += `<span class="pm-badge pm-badge-discount">${product.discount}</span>`;
        if (product.soldCount) badgesHTML += `<span class="pm-badge pm-badge-sold">${product.soldCount}</span>`;
        if (product.rating && product.rating !== 'NaN') {
            badgesHTML += `<span class="pm-badge pm-badge-rating">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width:12px;height:12px;">
                    <path fill-rule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clip-rule="evenodd"/>
                </svg>
                ${product.rating}
            </span>`;
        }

        pmBody.innerHTML = `
            ${makeImgWithFallback(product.image, product.name, 'pm-img', 'pm-img-fallback')}
            <div class="pm-details-container">
                <div class="pm-badges">${badgesHTML}</div>
                <h3 class="pm-name">${product.name}</h3>
                <div class="pm-price-row">
                    <span class="pm-price">${product.price}</span>
                    ${product.originalPrice ? `<span class="pm-original-price">${product.originalPrice}</span>` : ''}
                </div>
                ${product.description ? `
                    <div class="pm-desc-title">Deskripsi Produk</div>
                    <div class="pm-description">${product.description}</div>
                ` : ''}
            </div>
        `;

        pmFooter.innerHTML = `
            <a href="${product.shopeeLink}" target="_blank" rel="noopener noreferrer" class="pm-btn-buy">Beli Sekarang di Shopee</a>
        `;

        productModalOverlay.classList.add('active');
        window.history.pushState(
            { view: 'product', productId: product.id },
            '',
            `#${currentFolder?.code || ''}/p_${product.id}`
        );
    }

    function closeProductModal() {
        productModalOverlay.classList.remove('active');
        currentProduct = null;
    }

    closeProductBtn.addEventListener('click', () => {
        if (window.history.state?.view === 'product') window.history.back();
        else closeProductModal();
    });

    productModalOverlay.addEventListener('click', (e) => {
        if (e.target === productModalOverlay) {
            if (window.history.state?.view === 'product') window.history.back();
            else closeProductModal();
        }
    });

    // ─── Swipe Down to Close Product Modal ────────────────────────────────────
    let touchStartY = 0;
    const modalContent = document.getElementById('productModalContent');

    modalContent.addEventListener('touchstart', (e) => {
        touchStartY = e.touches[0].clientY;
    }, { passive: true });

    modalContent.addEventListener('touchend', (e) => {
        const delta = e.changedTouches[0].clientY - touchStartY;
        if (delta > 80) {
            if (window.history.state?.view === 'product') window.history.back();
            else closeProductModal();
        }
    }, { passive: true });

    // ─── Pop State ─────────────────────────────────────────────────────────────
    window.addEventListener('popstate', (e) => {
        const state = e.state;
        if (!state) {
            closeProductModal();
            closeFolder();
        } else if (state.view === 'folder') {
            closeProductModal();
            if (currentFolder) {
                detailView.classList.add('active');
                document.body.style.overflow = 'hidden';
            }
        }
    });

    // ─── Deep Link on Load ─────────────────────────────────────────────────────
    function handleHashOnLoad() {
        if (!window.location.hash || foldersData.length === 0) return;
        const hashParts = window.location.hash.substring(1).split('/');
        const code      = hashParts[0];
        const folder    = foldersData.find(f => f.code === code);

        if (!folder) return;
        openFolder(folder);

        if (hashParts[1]?.startsWith('p_')) {
            const pid  = hashParts[1].substring(2);
            const prod = folder.products.find(p => p.id === pid);
            if (prod) setTimeout(() => openProductModal(prod), 300);
        }
    }
});
