document.addEventListener('DOMContentLoaded', () => {
    const folderGrid = document.getElementById('folderGrid');
    const searchInput = document.getElementById('searchInput');
    const detailView = document.getElementById('detailView');
    const backBtn = document.getElementById('backBtn');
    const detailCode = document.getElementById('detailCode');
    const detailTitle = document.getElementById('detailTitle');
    const productList = document.getElementById('productList');

    // Product Modal Elements
    const productModalOverlay = document.getElementById('productModalOverlay');
    const closeProductBtn = document.getElementById('closeProductBtn');
    const pmBody = document.getElementById('pmBody');
    const pmFooter = document.getElementById('pmFooter');

    let foldersData = [];
    let currentFolder = null;
    let currentProduct = null;

    const SPREADSHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vT_bJRwlJa2CUp2v_qpDLl-aeVre8-LxnXJ5U6kxLyo2UuZEUrpYNqyBX7Z5wcEj9IIDhE4tm4tyfFl/pub?output=csv";

    // Load Data using PapaParse
    Papa.parse(SPREADSHEET_CSV_URL, {
        download: true,
        header: true,
        skipEmptyLines: true,
        beforeFirstChunk: function(chunk) {
            // Memotong baris judul excel (seperti DATA PRODUK AFFILIATE) agar Header tabel aslinya terbaca
            let lines = chunk.split('\n');
            let headerIndex = lines.findIndex(line => line.toLowerCase().includes('nama produk'));
            if (headerIndex !== -1) {
                return lines.slice(headerIndex).join('\n');
            }
            return chunk;
        },
        complete: function(results) {
            processSpreadsheetData(results.data);
        },
        error: function(err) {
            console.error('Error parsing CSV:', err);
            folderGrid.innerHTML = '<div class="empty-state">Gagal memuat data dari Spreadsheet. Periksa koneksi internet Anda.</div>';
        }
    });

    function processSpreadsheetData(rows) {
        const foldersMap = {};
        let folderCount = 1;

        rows.forEach((row, index) => {
            // Ignore empty products
            if (!row['Nama Produk'] || row['Nama Produk'].trim() === '') return;
            // Only process active items (assuming you might set Status to 'Aktif' or empty)
            const status = row['Status'] ? row['Status'].toLowerCase().trim() : 'aktif';
            if (status !== 'aktif' && status !== '') return;

            const kategori = row['Kategori'] ? row['Kategori'].trim() : 'Uncategorized';
            
            if (!foldersMap[kategori]) {
                // Determine a code if the admin typed "0675 Fashion Pria"
                let codeMatch = kategori.match(/^(\d+)/);
                let generatedCode = codeMatch ? codeMatch[1] : `KAT${folderCount.toString().padStart(3, '0')}`;
                
                foldersMap[kategori] = {
                    code: generatedCode,
                    title: kategori,
                    products: []
                };
                folderCount++;
            }

            // Convert string price "150.000" or empty to proper format
            let fPrice = row['Harga Jual (Rp)'] ? row['Harga Jual (Rp)'].trim() : '';
            fPrice = fPrice ? (fPrice.toLowerCase().startsWith('rp') ? fPrice : `Rp ${fPrice}`) : '';

            let fOrig = row['Harga Coret (Rp)'] ? row['Harga Coret (Rp)'].trim() : '';
            fOrig = fOrig ? (fOrig.toLowerCase().startsWith('rp') ? fOrig : `Rp ${fOrig}`) : '';

            let fDiscount = row['Diskon (%)'] ? row['Diskon (%)'].trim() : '';
            if (fDiscount && !fDiscount.includes('%')) fDiscount += '%';

            let soldL = row['Label Terjual'] ? row['Label Terjual'].trim() : '';
            let ratingL = row['Rating'] ? row['Rating'].trim() : '';
            // Some spreadsheets might use comma for decimals
            if(ratingL) ratingL = ratingL.replace(',', '.');

            const p = {
                id: `scsv_${index}`,
                name: row['Nama Produk'].trim(),
                image: row['URL Gambar'] ? row['URL Gambar'].trim() : '',
                price: fPrice,
                originalPrice: fOrig,
                discount: fDiscount,
                soldCount: soldL,
                rating: ratingL,
                description: row['Deskripsi'] ? row['Deskripsi'].trim() : '',
                shopeeLink: row['Link Shopee'] ? row['Link Shopee'].trim() : '#'
            };

            foldersMap[kategori].products.push(p);
        });

        foldersData = Object.values(foldersMap);
        renderFolders(foldersData);
    }

    // Render Folders
    function renderFolders(folders) {
        folderGrid.innerHTML = '';

        if (folders.length === 0) {
            folderGrid.innerHTML = '<div class="empty-state">Tidak ada folder yang ditemukan.</div>';
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
                    gridHTML += `<img src="${previewImages[i]}" alt="Preview" class="folder-preview-item" loading="lazy">`;
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

    // Search Functionality
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.trim().toLowerCase();

        if (searchTerm === '') {
            renderFolders(foldersData);
            return;
        }

        const filtered = foldersData.filter(folder =>
            folder.code.toLowerCase().includes(searchTerm) || 
            folder.title.toLowerCase().includes(searchTerm)
        );

        renderFolders(filtered);
    });

    // Open Folder Detail
    function openFolder(folder) {
        currentFolder = folder;
        detailCode.textContent = `#${folder.code}`;
        detailTitle.textContent = folder.title;
        productList.innerHTML = '';

        folder.products.forEach((product, index) => {
            const pCard = document.createElement('div');
            pCard.className = 'product-card animate-fade-in';
            pCard.style.animationDelay = `${index * 0.05}s`;

            pCard.innerHTML = `
                <img src="${product.image}" alt="${product.name}" class="product-image" loading="lazy">
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
        if (window.history.state && window.history.state.view === 'folder') {
            window.history.back();
        } else {
            closeFolder();
        }
    });

    // Open Product Modal
    function openProductModal(product) {
        currentProduct = product;
        
        let badgesHTML = '';
        if (product.discount) {
            badgesHTML += `<span class="pm-badge pm-badge-discount">${product.discount}</span>`;
        }
        if (product.soldCount) {
            badgesHTML += `<span class="pm-badge pm-badge-sold">${product.soldCount}</span>`;
        }
        if (product.rating && product.rating != "NaN") {
            badgesHTML += `
                <span class="pm-badge pm-badge-rating">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width:12px;height:12px;">
                      <path fill-rule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clip-rule="evenodd" />
                    </svg>
                    ${product.rating}
                </span>`;
        }

        pmBody.innerHTML = `
            <img src="${product.image}" alt="${product.name}" class="pm-img">
            <div class="pm-details-container">
                <div class="pm-badges">
                    ${badgesHTML}
                </div>
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
        
        window.history.pushState({ view: 'product', productId: product.id }, '', `#${currentFolder?.code || ''}/p_${product.id}`);
    }

    function closeProductModal() {
        productModalOverlay.classList.remove('active');
        currentProduct = null;
    }

    closeProductBtn.addEventListener('click', () => {
        if (window.history.state && window.history.state.view === 'product') {
            window.history.back();
        } else {
            closeProductModal();
        }
    });

    productModalOverlay.addEventListener('click', (e) => {
        if (e.target === productModalOverlay) {
            if (window.history.state && window.history.state.view === 'product') {
                window.history.back();
            } else {
                closeProductModal();
            }
        }
    });

    window.addEventListener('popstate', (e) => {
        const state = e.state;
        
        if (!state) {
            closeProductModal();
            closeFolder();
        } else if (state.view === 'folder') {
            closeProductModal();
            if(currentFolder) {
                 detailView.classList.add('active');
                 document.body.style.overflow = 'hidden';
            }
        }
    });

    setTimeout(() => {
        if (window.location.hash && foldersData.length > 0) {
            const hashParts = window.location.hash.substring(1).split('/');
            const code = hashParts[0];
            const folder = foldersData.find(f => f.code === code);
            
            if (folder) {
                openFolder(folder);
                
                if (hashParts[1] && hashParts[1].startsWith('p_')) {
                    const pid = hashParts[1].substring(2);
                    const prod = folder.products.find(p => p.id === pid);
                    if(prod) {
                        setTimeout(() => openProductModal(prod), 300);
                    }
                }
            }
        }
    }, 1500);
});
