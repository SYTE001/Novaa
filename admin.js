/* ==========================================================
 * PENTING: ISI SCRIPT_URL DI BAWAH INI DENGAN URL DEPLOY ANDA
 * ========================================================== */
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycby4Z0HvMZbqOsRFI1NFJPCYZxWfGwABPZfCzlaIrk5Vb-5DIxAMCT8ddwPNEB0zYN370A/exec";

// URL CSV Publik — SUDAH DIUPDATE ke sheet aktif
const SPREADSHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRD34qgiaE5rXVFZRweqtjcJMOc4ZoiSp5Xt12jZI5n1_rFEeb6VMVb55VICP84TVXHLFBQaAHGSuJl/pub?output=csv";

const REQUIRED_PASSWORD = "admin";
let foldersData = [];
let viewMode = 'folders'; // 'folders', 'products'
let activeFolderId = null; 

// Initial Auth Check
const loginScreen   = document.getElementById('loginScreen');
const dashboard     = document.getElementById('dashboard');
const passwordInput = document.getElementById('passwordInput');
const loginBtn      = document.getElementById('loginBtn');
const loginError    = document.getElementById('loginError');

// Loading Overlay
const loadingOverlay = document.getElementById('loadingOverlay');

// Login logic
if (sessionStorage.getItem('adminLoggedIn') === 'true') {
    loginScreen.style.display = 'none';
    dashboard.style.display   = 'flex';
    initAdmin();
}

loginBtn.addEventListener('click', () => {
    if (passwordInput.value === REQUIRED_PASSWORD) {
        sessionStorage.setItem('adminLoggedIn', 'true');
        loginScreen.style.display = 'none';
        dashboard.style.display   = 'flex';
        initAdmin();
    } else {
        loginError.style.display = 'block';
    }
});

passwordInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') loginBtn.click();
});

// UI Elements
const contentArea  = document.getElementById('contentArea');
const exportArea   = document.getElementById('exportArea'); 
const btnContent   = document.getElementById('btnContent');
const btnExport    = document.getElementById('btnExport');
const pageTitle    = document.getElementById('pageTitle');
const btnAddFolder = document.getElementById('btnAddFolder');

const formModal    = document.getElementById('formModal');
const closeFormBtn = document.getElementById('closeFormBtn');
const modalTitle   = document.getElementById('modalTitle');
const modalBody    = document.getElementById('modalBody');
const saveFormBtn  = document.getElementById('saveFormBtn');

let currentEditType = '';
let currentEditId   = null; 
let currentOldName  = null; 

// Load Data From Public CSV
async function initAdmin() {
    exportArea.style.display = 'none';
    btnExport.style.display  = 'none';

    contentArea.innerHTML = '<p style="color:var(--text-muted); padding: 8px 0;">Memuat data dari Spreadsheet...</p>';
    
    Papa.parse(SPREADSHEET_CSV_URL, {
        download: true,
        header: true,
        skipEmptyLines: true,
        beforeFirstChunk: function(chunk) {
            let lines       = chunk.split('\n');
            let headerIndex = lines.findIndex(line => line.toLowerCase().includes('nama produk'));
            if (headerIndex !== -1) return lines.slice(headerIndex).join('\n');
            return chunk;
        },
        complete: function(results) {
            processSpreadsheetData(results.data);
            renderView();
        },
        error: function(err) {
            contentArea.innerHTML = '<p style="color:#ef4444;">Gagal mengambil data Spreadsheet. Periksa URL CSV dan koneksi internet.</p>';
        }
    });
}

function processSpreadsheetData(rows) {
    const foldersMap = {};
    let folderCount  = 1;

    rows.forEach((row) => {
        if (!row['Nama Produk'] || row['Nama Produk'].trim() === '') return;

        const kategori = row['Kategori'] ? row['Kategori'].trim() : 'Uncategorized';
        
        if (!foldersMap[kategori]) {
            let codeMatch     = kategori.match(/^(\d+)/);
            let generatedCode = codeMatch ? codeMatch[1] : `KAT${folderCount.toString().padStart(3, '0')}`;
            foldersMap[kategori] = { code: generatedCode, title: kategori, products: [] };
            folderCount++;
        }

        let fDiscount = row['Diskon (%)'] ? row['Diskon (%)'].trim() : '';
        if (fDiscount && !fDiscount.includes('%')) fDiscount += '%';

        let ratingL = row['Rating'] ? row['Rating'].trim() : '';
        if (ratingL) ratingL = ratingL.replace(',', '.');

        foldersMap[kategori].products.push({
            id:            row['Nama Produk'].trim(),
            name:          row['Nama Produk'].trim(),
            image:         row['URL Gambar'] ? row['URL Gambar'].trim() : '',
            price:         row['Harga Jual (Rp)'] ? row['Harga Jual (Rp)'].trim() : '',
            originalPrice: row['Harga Coret (Rp)'] ? row['Harga Coret (Rp)'].trim() : '',
            discount:      fDiscount,
            soldCount:     row['Label Terjual'] ? row['Label Terjual'].trim() : '',
            rating:        ratingL,
            description:   row['Deskripsi'] ? row['Deskripsi'].trim() : '',
            shopeeLink:    row['Link Shopee'] ? row['Link Shopee'].trim() : ''
        });
    });

    foldersData = Object.values(foldersMap);
}

function renderView() {
    if (viewMode === 'folders') {
        pageTitle.textContent    = 'Manajemen Kategori / Folder Google Sheet';
        btnAddFolder.textContent = '+ Tambah Produk Baru';
        renderFoldersUI();
    } else if (viewMode === 'products') {
        const folder             = foldersData.find(f => f.title === activeFolderId);
        pageTitle.textContent    = `Produk di Kategori: ${folder.title}`;
        btnAddFolder.textContent = '+ Tambah Produk di Sini';
        renderProductsUI(folder);
    }
}

btnAddFolder.addEventListener('click', () => {
    openForm('product', null);
});

function renderFoldersUI() {
    if (foldersData.length === 0) {
        contentArea.innerHTML = '<p style="color:var(--text-muted)">Tidak ada data kategori. Pastikan sheet sudah punya kolom "Nama Produk" dan "Kategori".</p>';
        return;
    }

    let html = '<div class="folder-list">';
    foldersData.forEach(folder => {
        html += `
            <div class="folder-item">
                <div class="folder-info">
                    <h4>📂 ${folder.title}</h4>
                    <p>${folder.products.length} produk di kategori ini</p>
                </div>
                <div class="actions">
                    <button class="btn-sm btn-view"   onclick="openFolderView('${escAttr(folder.title)}')">Kelola Produk</button>
                    <button class="btn-sm btn-edit"   onclick="openForm('folder', '${escAttr(folder.title)}')">Ubah Kategori</button>
                    <button class="btn-sm btn-delete" onclick="deleteFolder('${escAttr(folder.title)}')">Hapus Semua</button>
                </div>
            </div>
        `;
    });
    html += '</div>';
    contentArea.innerHTML = html;
}

// Escape helper to avoid inline JS attribute injection issues
function escAttr(str) {
    return str.replace(/'/g, "\\'");
}

window.openFolderView = (title) => {
    activeFolderId = title;
    viewMode       = 'products';
    renderView();
};

window.deleteFolder = async (title) => {
    if (confirm(`Yakin MENGHAPUS SELURUH PRODUK di Kategori "${title}"?`)) {
        await sendDataToAppsScript('DELETE_FOLDER', { folderName: title });
        location.reload();
    }
};

function renderProductsUI(folder) {
    let html = `
        <div class="breadcrumb" onclick="goBackToFolders()">← Kembali ke Semua Kategori</div>
        <div class="product-grid">
    `;
    
    if (folder.products.length === 0) {
        html += '<p style="grid-column: 1/-1; color: var(--text-muted);">Tidak ada produk.</p>';
    }

    folder.products.forEach(p => {
        let fPrice = p.price ? (p.price.toLowerCase().startsWith('rp') ? p.price : `Rp ${p.price}`) : '';
        const imgHTML = p.image
            ? `<img src="${p.image}" class="prod-img" onerror="this.outerHTML='<div class=\\'prod-img-fallback\\'><svg xmlns=\\'http://www.w3.org/2000/svg\\' fill=\\'none\\' viewBox=\\'0 0 24 24\\' stroke-width=\\'1.5\\' stroke=\\'currentColor\\'><path stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\' d=\\'M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 16.5V7.125A2.625 2.625 0 015.625 4.5h12.75A2.625 2.625 0 0121 7.125V16.5m-6-9h.008v.008H15V7.5z\\'/></svg></div>'">`
            : `<div class="prod-img-fallback"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 16.5V7.125A2.625 2.625 0 015.625 4.5h12.75A2.625 2.625 0 0121 7.125V16.5m-6-9h.008v.008H15V7.5z"/></svg></div>`;

        html += `
            <div class="prod-card">
                ${imgHTML}
                <div class="prod-details">
                    <div class="prod-title">${p.name}</div>
                    <div class="prod-price">${fPrice}</div>
                </div>
                <div class="prod-actions">
                    <button onclick="openForm('product', '${escAttr(p.name)}')">Edit</button>
                    <button onclick="deleteProduct('${escAttr(p.name)}')">Hapus</button>
                </div>
            </div>
        `;
    });

    html += '</div>';
    contentArea.innerHTML = html;
}

window.goBackToFolders = () => {
    viewMode       = 'folders';
    activeFolderId = null;
    renderView();
};

window.deleteProduct = async (prodName) => {
    if (confirm('Hapus produk ini permanen dari Spreadsheet?')) {
        await sendDataToAppsScript('DELETE', { name: prodName });
        location.reload();
    }
};

window.openForm = (type, idName) => {
    currentEditType = type;
    currentOldName  = idName;
    
    if (type === 'folder') {
        modalTitle.textContent = 'Ubah Nama Kategori';
        modalBody.innerHTML = `
            <div class="form-group">
                <label>Nama Kategori Baru</label>
                <input type="text" id="fTitle" value="${idName}">
            </div>
            <p style="font-size:0.8rem; color:var(--text-muted)">Semua produk di label ini akan otomatis berganti namanya.</p>
        `;
    } else if (type === 'product') {
        modalTitle.textContent = idName ? 'Edit Produk' : 'Tambah Produk Baru';
        
        let pData = { name:'', image:'', price:'', originalPrice:'', discount:'', soldCount:'', rating:'', description:'', shopeeLink:'', kategori: activeFolderId || '' };
        
        if (idName && activeFolderId) {
            const folder = foldersData.find(f => f.title === activeFolderId);
            if (folder) {
                const found = folder.products.find(p => p.id === idName);
                if (found) pData = { ...found, kategori: activeFolderId };
            }
        }
        
        modalBody.innerHTML = `
            <div class="form-group"><label>Nama Produk (Wajib, Harus Unik)</label><input type="text" id="pName" value="${pData.name}"></div>
            <div class="form-group"><label>Kategori (Wajib)</label><input type="text" id="pCat" value="${pData.kategori}" placeholder="Wajib diisi!"></div>
            <div class="form-group"><label>Harga Jual (ex: 99.000)</label><input type="text" id="pPrice" value="${pData.price}"></div>
            <div class="form-group"><label>URL Gambar</label><input type="text" id="pImage" value="${pData.image}"></div>
            <div class="form-group"><label>Harga Asli Coret (Optional)</label><input type="text" id="pOriginal" value="${pData.originalPrice || ''}"></div>
            <div class="form-group"><label>Diskon Label (Optional)</label><input type="text" id="pDiscount" value="${pData.discount || ''}"></div>
            <div class="form-group"><label>Label Terjual (Optional)</label><input type="text" id="pSold" value="${pData.soldCount || ''}"></div>
            <div class="form-group"><label>Rating (Optional)</label><input type="text" id="pRating" value="${pData.rating || ''}"></div>
            <div class="form-group"><label>Deskripsi</label><textarea id="pDesc" rows="3">${pData.description || ''}</textarea></div>
            <div class="form-group"><label>Link Shopee</label><input type="text" id="pLink" value="${pData.shopeeLink || ''}"></div>
        `;
    }
    
    formModal.classList.add('active');
};

closeFormBtn.addEventListener('click', () => {
    formModal.classList.remove('active');
});

saveFormBtn.addEventListener('click', async () => {
    if (currentEditType === 'folder') {
        const title = document.getElementById('fTitle').value.trim();
        if (!title) return alert('Mohon isi judul kategori!');
        await sendDataToAppsScript('EDIT_FOLDER', { oldTitle: currentOldName, newTitle: title });
        location.reload();
    } 
    else if (currentEditType === 'product') {
        const newName = document.getElementById('pName').value.trim();
        if (!newName || !document.getElementById('pPrice').value.trim()) {
            return alert('Harap isi minimal Nama Produk dan Harga!');
        }

        const payload = {
            oldName:       currentOldName,
            name:          newName,
            image:         document.getElementById('pImage').value.trim(),
            price:         document.getElementById('pPrice').value.trim(),
            originalPrice: document.getElementById('pOriginal').value.trim(),
            kategori:      document.getElementById('pCat').value.trim(),
            discount:      document.getElementById('pDiscount').value.trim(),
            soldCount:     document.getElementById('pSold').value.trim(),
            rating:        document.getElementById('pRating').value.trim(),
            description:   document.getElementById('pDesc').value.trim(),
            shopeeLink:    document.getElementById('pLink').value.trim()
        };
        
        const action = currentOldName ? 'EDIT' : 'ADD';
        await sendDataToAppsScript(action, payload);
        location.reload();
    }
});

async function sendDataToAppsScript(action, payloadData) {
    formModal.classList.remove('active');
    loadingOverlay.style.display = 'flex';

    try {
        await fetch(SCRIPT_URL, {
            method:  'POST',
            mode:    'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body:    JSON.stringify({ action, data: payloadData })
        });
        loadingOverlay.style.display = 'none';
    } catch (err) {
        alert('Gagal kirim ke server: ' + err);
        loadingOverlay.style.display = 'none';
    }
}

document.getElementById('btnLogout').addEventListener('click', () => {
    sessionStorage.removeItem('adminLoggedIn');
    window.location.reload();
});
