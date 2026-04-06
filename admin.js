/* ==========================================================
 * PENTING: ISI SCRIPT_URL DI BAWAH INI DENGAN URL DEPLOY ANDA
 * (Contoh: https://script.google.com/macros/s/AKfycby.../exec)
 * ========================================================== */
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycby4Z0HvMZbqOsRFI1NFJPCYZxWfGwABPZfCzlaIrk5Vb-5DIxAMCT8ddwPNEB0zYN370A/exec";

// URL CSV Publik
const SPREADSHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vT_bJRwlJa2CUp2v_qpDLl-aeVre8-LxnXJ5U6kxLyo2UuZEUrpYNqyBX7Z5wcEj9IIDhE4tm4tyfFl/pub?output=csv";

const REQUIRED_PASSWORD = "admin";
let foldersData = [];
let viewMode = 'folders'; // 'folders', 'products'
let activeFolderId = null; 

// Initial Auth Check
const loginScreen = document.getElementById('loginScreen');
const dashboard = document.getElementById('dashboard');
const passwordInput = document.getElementById('passwordInput');
const loginBtn = document.getElementById('loginBtn');
const loginError = document.getElementById('loginError');

// Loading Overlay
const loadingOverlay = document.getElementById('loadingOverlay');

// Login logic
if (sessionStorage.getItem('adminLoggedIn') === 'true') {
    loginScreen.style.display = 'none';
    dashboard.style.display = 'flex';
    initAdmin();
}

loginBtn.addEventListener('click', () => {
    if (passwordInput.value === REQUIRED_PASSWORD) {
        sessionStorage.setItem('adminLoggedIn', 'true');
        loginScreen.style.display = 'none';
        dashboard.style.display = 'flex';
        initAdmin();
    } else {
        loginError.style.display = 'block';
    }
});

passwordInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') loginBtn.click();
});

// UI Elements
const contentArea = document.getElementById('contentArea');
const exportArea = document.getElementById('exportArea'); 
const btnContent = document.getElementById('btnContent');
const btnExport = document.getElementById('btnExport');
const pageTitle = document.getElementById('pageTitle');
const btnAddFolder = document.getElementById('btnAddFolder');

const formModal = document.getElementById('formModal');
const closeFormBtn = document.getElementById('closeFormBtn');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');
const saveFormBtn = document.getElementById('saveFormBtn');

let currentEditType = '';
let currentEditId = null; 
let currentOldName = null; 

// Load Data From Public CSV
async function initAdmin() {
    exportArea.style.display = 'none'; // Sembunyikan panduan export karna kita auto-sync
    btnExport.style.display = 'none';
    
    Papa.parse(SPREADSHEET_CSV_URL, {
        download: true,
        header: true,
        skipEmptyLines: true,
        beforeFirstChunk: function(chunk) {
            let lines = chunk.split('\n');
            let headerIndex = lines.findIndex(line => line.toLowerCase().includes('nama produk'));
            if (headerIndex !== -1) {
                return lines.slice(headerIndex).join('\n');
            }
            return chunk;
        },
        complete: function(results) {
            processSpreadsheetData(results.data);
            renderView();
        },
        error: function(err) {
            alert('Gagal mengambil data Spreadsheet.');
        }
    });
}

function processSpreadsheetData(rows) {
    const foldersMap = {};
    let folderCount = 1;

    rows.forEach((row, index) => {
        if (!row['Nama Produk'] || row['Nama Produk'].trim() === '') return;

        const kategori = row['Kategori'] ? row['Kategori'].trim() : 'Uncategorized';
        
        if (!foldersMap[kategori]) {
            let codeMatch = kategori.match(/^(\d+)/);
            let generatedCode = codeMatch ? codeMatch[1] : `KAT${folderCount.toString().padStart(3, '0')}`;
            
            foldersMap[kategori] = {
                code: generatedCode, // Hanya display
                title: kategori, // Ini identifikasi utama (Kolom I)
                products: []
            };
            folderCount++;
        }

        let fPrice = row['Harga Jual (Rp)'] ? row['Harga Jual (Rp)'].trim() : '';
        fPrice = fPrice ? (fPrice.toLowerCase().startsWith('rp') ? fPrice : `Rp ${fPrice}`) : '';

        let fOrig = row['Harga Coret (Rp)'] ? row['Harga Coret (Rp)'].trim() : '';
        fOrig = fOrig ? (fOrig.toLowerCase().startsWith('rp') ? fOrig : `Rp ${fOrig}`) : '';

        let fDiscount = row['Diskon (%)'] ? row['Diskon (%)'].trim() : '';
        if (fDiscount && !fDiscount.includes('%')) fDiscount += '%';

        let soldL = row['Label Terjual'] ? row['Label Terjual'].trim() : '';
        let ratingL = row['Rating'] ? row['Rating'].trim() : '';
        if(ratingL) ratingL = ratingL.replace(',', '.');

        const p = {
            id: row['Nama Produk'].trim(), // ID pakai nama biar unik di Spreadsheet
            name: row['Nama Produk'].trim(),
            image: row['URL Gambar'] ? row['URL Gambar'].trim() : '',
            price: row['Harga Jual (Rp)'] ? row['Harga Jual (Rp)'].trim() : '', // Clean price non-format utk edit
            originalPrice: row['Harga Coret (Rp)'] ? row['Harga Coret (Rp)'].trim() : '',
            discount: fDiscount,
            soldCount: soldL,
            rating: ratingL,
            description: row['Deskripsi'] ? row['Deskripsi'].trim() : '',
            shopeeLink: row['Link Shopee'] ? row['Link Shopee'].trim() : ''
        };

        foldersMap[kategori].products.push(p);
    });

    foldersData = Object.values(foldersMap);
}


function renderView() {
    if (viewMode === 'folders') {
        pageTitle.textContent = 'Manajemen Kategori / Folder Google Sheet';
        btnAddFolder.textContent = '+ Tambah Produk Baru';
        renderFoldersUI();
    } else if (viewMode === 'products') {
        const folder = foldersData.find(f => f.title === activeFolderId);
        pageTitle.textContent = `Produk di Kategori: ${folder.title}`;
        btnAddFolder.textContent = '+ Tambah Produk di Sini';
        renderProductsUI(folder);
    }
}

// override btnAdd folder hanya utk refresh, folder baru otomatis tercipta jika ada produk dari kategori baru
btnAddFolder.addEventListener('click', () => {
    openForm('product', null);
});

function renderFoldersUI() {
    let html = '<div class="folder-list">';
    if(foldersData.length === 0){
        html += '<p style="color:var(--text-muted)">Tidak ada data kategori.</p>';
    }
    
    foldersData.forEach(folder => {
        html += `
            <div class="folder-item">
                <div class="folder-info">
                    <h4>📂: ${folder.title}</h4>
                    <p>${folder.products.length} Produk tersimpan di kategori ini</p>
                </div>
                <div class="actions">
                    <button class="btn-sm btn-view" onclick="openFolderView('${folder.title}')">Kelola Produk</button>
                    <button class="btn-sm btn-edit" onclick="openForm('folder', '${folder.title}')">Ubah Text Kategori</button>
                    <button class="btn-sm btn-delete" onclick="deleteFolder('${folder.title}')">Hapus Isi Kategori</button>
                </div>
            </div>
        `;
    });
    html += '</div>';
    contentArea.innerHTML = html;
}

window.openFolderView = (title) => {
    activeFolderId = title;
    viewMode = 'products';
    renderView();
}

window.deleteFolder = async (title) => {
    if(confirm(`Yakin MENGHAPUS SELURUH PRODUK di Kategori "${title}"?`)){
        await sendDataToAppsScript('DELETE_FOLDER', { folderName: title });
        location.reload();
    }
}

function renderProductsUI(folder) {
    let html = `
        <div class="breadcrumb" onclick="goBackToFolders()">← Kembali ke Semua Kategori</div>
        <div class="product-grid">
    `;
    
    if(folder.products.length === 0){
        html += '<p style="grid-column: 1/-1; color: var(--text-muted);">Tidak ada produk.</p>';
    }

    folder.products.forEach(p => {
        
        let fPrice = p.price;
        fPrice = fPrice ? (fPrice.toLowerCase().startsWith('rp') ? fPrice : `Rp ${fPrice}`) : '';

        html += `
            <div class="prod-card">
                <img src="${p.image}" class="prod-img">
                <div class="prod-details">
                    <div class="prod-title">${p.name}</div>
                    <div class="prod-price">${fPrice}</div>
                </div>
                <div class="prod-actions">
                    <button onclick="openForm('product', '${p.name}')">Edit Row</button>
                    <button onclick="deleteProduct('${p.name}')">Hapus Row</button>
                </div>
            </div>
        `;
    });

    html += '</div>';
    contentArea.innerHTML = html;
}

window.goBackToFolders = () => {
    viewMode = 'folders';
    activeFolderId = null;
    renderView();
}

window.deleteProduct = async (prodName) => {
    if(confirm('Hapus produk ini permanen dari Spreadsheet?')){
        await sendDataToAppsScript('DELETE', { name: prodName });
        location.reload();
    }
}

window.openForm = (type, idName) => {
    currentEditType = type;
    currentOldName = idName; // reference old name to find row in sheet
    
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
            if(folder) {
                const found = folder.products.find(p => p.id === idName);
                if(found) pData = { ...found, kategori: activeFolderId };
            }
        }
        
        modalBody.innerHTML = `
            <div class="form-group"><label>Nama Produk (Wajib, Harus Unik)</label><input type="text" id="pName" value="${pData.name}"></div>
            <div class="form-group"><label>Kategori (Wajib, ex: Kemeja Pria)</label><input type="text" id="pCat" value="${pData.kategori}" placeholder="Wajib diisi!"></div>
            <div class="form-group"><label>Harga Jual (ex: 99.000)</label><input type="text" id="pPrice" value="${pData.price}"></div>
            <div class="form-group"><label>URL Gambar</label><input type="text" id="pImage" value="${pData.image}"></div>
            <div class="form-group"><label>Harga Asli Coret (Optional)</label><input type="text" id="pOriginal" value="${pData.originalPrice || ''}"></div>
            <div class="form-group"><label>Diskon Label (Optional)</label><input type="text" id="pDiscount" value="${pData.discount || ''}"></div>
            <div class="form-group"><label>Label Terjual (Optional)</label><input type="text" id="pSold" value="${pData.soldCount || ''}"></div>
            <div class="form-group"><label>Rating (Optional)</label><input type="text" id="pRating" value="${pData.rating || ''}"></div>
            <div class="form-group"><label>Deskripsi Lebih Lengkap</label><textarea id="pDesc" rows="3">${pData.description || ''}</textarea></div>
            <div class="form-group"><label>Link Tujuan Shopee</label><input type="text" id="pLink" value="${pData.shopeeLink || ''}"></div>
        `;
    }
    
    formModal.classList.add('active');
}

closeFormBtn.addEventListener('click', () => {
    formModal.classList.remove('active');
});

saveFormBtn.addEventListener('click', async () => {
    if (currentEditType === 'folder') {
        const title = document.getElementById('fTitle').value.trim();
        if (!title) return alert('Mohon isi judul folder/kategori!');
        
        await sendDataToAppsScript('EDIT_FOLDER', { oldTitle: currentOldName, newTitle: title });
        location.reload();
    } 
    else if (currentEditType === 'product') {
        const newName = document.getElementById('pName').value.trim();
        if (!newName || !document.getElementById('pPrice').value.trim()) {
            return alert('Harap isi minimal Nama Produk dan Harga!');
        }

        const payload = {
            oldName: currentOldName, // Untuk target update
            name: newName,
            image: document.getElementById('pImage').value.trim(),
            price: document.getElementById('pPrice').value.trim(),
            originalPrice: document.getElementById('pOriginal').value.trim(),
            kategori: document.getElementById('pCat').value.trim(),
            discount: document.getElementById('pDiscount').value.trim(),
            soldCount: document.getElementById('pSold').value.trim(),
            rating: document.getElementById('pRating').value.trim(),
            description: document.getElementById('pDesc').value.trim(),
            shopeeLink: document.getElementById('pLink').value.trim()
        };
        
        const action = currentOldName ? 'EDIT' : 'ADD';
        await sendDataToAppsScript(action, payload);
        location.reload(); // Reload form Public CSV update (might be delayed by google sheet 30s)
    }
});

// CORE BACKEND SENDER API
async function sendDataToAppsScript(action, payloadData) {
    if(SCRIPT_URL === "MASUKKAN_URL_GOOGLE_SCRIPT_ANDA_DISINI") {
        alert('TOLONG GANTI CONST SCRIPT_URL DI admin.js DENGAN URL DEPLOY GOOGLE APPS SCRIPT ANDA DULU!');
        return;
    }

    formModal.classList.remove('active');
    loadingOverlay.style.display = 'flex';

    try {
        // Menggunakan mode 'no-cors' adalah trik wajib agar Browser lokal tidak mencurigai redirect Google
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors', 
            headers: {
                'Content-Type': 'text/plain'
            },
            body: JSON.stringify({
                action: action,
                data: payloadData
            })
        });
        
        // Dalam mode no-cors, response akan berstatus "opaque" (buta) sehingga tidak bisa di-parse JSON nya. 
        // Selama tidak mental ke block catch, berarti Sinyal berhasil terkirim ke Google!
        loadingOverlay.style.display = 'none';

    } catch (err) {
        alert('Terjadi kesalahan gagal kirim internet: ' + err);
        loadingOverlay.style.display = 'none';
    }
}

// Session logout
document.getElementById('btnLogout').addEventListener('click', () => {
    window.location.reload();
});
