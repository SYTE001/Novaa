// ==============================================================
// 1. COPY SEMUA KODE INI KE DALAM GOOGLE APPS SCRIPT ANDA
// 2. KLIK TOMBOL "Terapkan (Deploy)" -> Deployment Baru
// 3. Pilih "Aplikasi Web" (Web App)
// 4. Akses: "Siapa saja" (Anyone)
// 5. COPY "URL Aplikasi Web" yang diberikan saat selesai.
// ==============================================================

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  
  try {
    var rawData = e.postData.contents;
    var params = JSON.parse(rawData);
    var action = params.action; // 'ADD', 'EDIT', 'DELETE', 'EDIT_FOLDER', 'DELETE_FOLDER'
    var data = params.data;     
    
    var lastRow = sheet.getLastRow();
    
    // Asumsi Urutan Kolom (Index G-Sheets = 1-based, Array = 0-based):
    // Col 1: No, Col 2: Nama Produk, Col 3: URL Gambar, Col 4: Harga Jual
    // Col 5: Harga Coret, Col 6: Diskon, Col 7: Label Terjual, Col 8: Rating
    // Col 9: Kategori, Col 10: Deskripsi, Col 11: Link Shopee, Col 12: Status
    
    var dataRange = sheet.getRange(1, 1, lastRow, 12);
    var values = dataRange.getValues();
    
    if (action === 'ADD') {
      // Mencari baris asli terakhir yang memiliki data (Bukan baris kosong yg cuma ada warnanya)
      var trueLastRow = 4; // Minimal baris Header
      for (var i = values.length - 1; i >= 0; i--) {
         if (values[i][1] && String(values[i][1]).trim() !== '') {
             trueLastRow = i + 1;
             break;
         }
      }
      
      var nextNo = parseInt(values[trueLastRow - 1][0]) + 1 || 1;
      
      var newRow = [
        nextNo,
        data.name || '',
        data.image || '',
        data.price || '',
        data.originalPrice || '',
        data.discount || '',
        data.soldCount || '',
        data.rating || '',
        data.kategori || 'Uncategorized',
        data.description || '',
        data.shopeeLink || '',
        'Aktif'
      ];
      
      // Menulis langsung ke baris bawah yang kosong (menghindari appendRow loncat ke baris 1000)
      sheet.getRange(trueLastRow + 1, 1, 1, 12).setValues([newRow]);
      return returnSuccess("Berhasil menambah produk.");
    }  
    else if (action === 'EDIT') {
      var targetRow = -1;
      var targetName = data.oldName || data.name;
      
      for (var i = 1; i < values.length; i++) {
        if (values[i][1] === targetName) { 
          targetRow = i + 1; 
          break;
        }
      }
      
      if (targetRow !== -1) {
        sheet.getRange(targetRow, 2).setValue(data.name || '');
        sheet.getRange(targetRow, 3).setValue(data.image || '');
        sheet.getRange(targetRow, 4).setValue(data.price || '');
        sheet.getRange(targetRow, 5).setValue(data.originalPrice || '');
        sheet.getRange(targetRow, 6).setValue(data.discount || '');
        sheet.getRange(targetRow, 7).setValue(data.soldCount || '');
        sheet.getRange(targetRow, 8).setValue(data.rating || '');
        if(data.kategori) sheet.getRange(targetRow, 9).setValue(data.kategori);
        sheet.getRange(targetRow, 10).setValue(data.description || '');
        sheet.getRange(targetRow, 11).setValue(data.shopeeLink || '');
        return returnSuccess("Berhasil mengedit produk.");
      } else {
        return returnError("Gagal edit: Produk list tidak ditemukan pada baris manapun.");
      }
    } 
    else if (action === 'DELETE') {
      var targetRow = -1;
      for (var i = 1; i < values.length; i++) {
        if (values[i][1] === data.name) {
          targetRow = i + 1;
          break;
        }
      }
      if (targetRow !== -1) {
        sheet.deleteRow(targetRow);
        return returnSuccess("Berhasil menghapus produk.");
      } else {
        return returnError("Gagal hapus: Produk tidak terdeteksi.");
      }
    }
    else if (action === 'EDIT_FOLDER') {
      var oldTitle = data.oldTitle;
      var newTitle = data.newTitle;
      var editedCount = 0;
      
      // Loop ke semua baris untuk mencari kategori yang identik lalu di ganti
      for (var i = 1; i < values.length; i++) {
        if (values[i][8] === oldTitle) { 
          sheet.getRange(i + 1, 9).setValue(newTitle);
          editedCount++;
        }
      }
      return returnSuccess("Berhasil ubah nama folder untuk " + editedCount + " produk.");
    }
    else if (action === 'DELETE_FOLDER') {
      var folderName = data.folderName;
      var deletedCount = 0;
      
      // Hapusnya harus mundur dari bawah agar index baris yang berputar tidak berantakan
      for (var i = values.length - 1; i >= 1; i--) {
        if (values[i][8] === folderName) { 
          sheet.deleteRow(i + 1);
          deletedCount++;
        }
      }
      return returnSuccess("Berhasil menghapus folder berserta isi " + deletedCount + " buah produk di dalamnya.");
    }
    else {
      return returnError("Aksi perintah API tidak diketahui sistem Backend.");
    }
  } catch(err) {
    return returnError("Kirim Error Server: " + err.toString());
  }
}

// Handler Opsional, merespon status aman agar Browser tidak memblokir sinyal.
function returnSuccess(msg) {
  var output = JSON.stringify({ "status": "success", "message": msg });
  return ContentService.createTextOutput(output).setMimeType(ContentService.MimeType.JSON);
}

function returnError(msg) {
  var output = JSON.stringify({ "status": "error", "message": msg });
  return ContentService.createTextOutput(output).setMimeType(ContentService.MimeType.JSON);
}
