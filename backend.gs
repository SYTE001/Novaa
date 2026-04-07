// ==============================================================
// NOVAA — Google Apps Script Backend  v2.0
// Arsitektur 2-Sheet: "Folders" + "Products"
//
// SETUP (lakukan sekali):
//  1. Buka Spreadsheet → tambah 2 sheet dengan nama persis:
//       Sheet 1 →  Folders
//       Sheet 2 →  Products
//  2. Baris pertama SETIAP sheet akan otomatis diisi sebagai
//     header saat pertama kali data di-sync (tidak perlu manual).
//  3. Paste semua kode ini ke Apps Script (Extensions → Apps Script)
//  4. Deploy → New Deployment → Web App
//       Execute as : Me
//       Who has access : Anyone
//  5. Copy "Web App URL" dan paste ke admin.js pada variabel
//     APPS_SCRIPT_URL di baris paling atas.
// ==============================================================

var FOLDERS_SHEET  = "Folders";
var PRODUCTS_SHEET = "Products";

// Header definitions
var FOLDER_HEADERS  = ["folderID", "title", "description", "hidden"];
var PRODUCT_HEADERS = ["productID", "folderID", "name", "image", "price", "label", "description", "affiliateUrl", "hidden"];

// ── doGet: baca semua data & gabungkan jadi { folders: [...] } ─
function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var foldersSheet  = getOrCreateSheet(ss, FOLDERS_SHEET,  FOLDER_HEADERS);
    var productsSheet = getOrCreateSheet(ss, PRODUCTS_SHEET, PRODUCT_HEADERS);

    var folderRows  = getSheetData(foldersSheet);
    var productRows = getSheetData(productsSheet);

    // Build folders map
    var folderMap = {};
    var folderOrder = [];
    folderRows.forEach(function(row) {
      var id = String(row["folderID"] || "").trim();
      if (!id) return;
      var folder = {
        id:          id,
        title:       String(row["title"] || ""),
        description: String(row["description"] || ""),
        hidden:      row["hidden"] === true || String(row["hidden"]).toLowerCase() === "true",
        products:    []
      };
      folderMap[id] = folder;
      folderOrder.push(folder);
    });

    // Attach products
    productRows.forEach(function(row) {
      var fid = String(row["folderID"] || "").trim();
      var pid = String(row["productID"] || "").trim();
      if (!pid || !fid) return;
      var folder = folderMap[fid];
      if (!folder) return;
      folder.products.push({
        id:           pid,
        name:         String(row["name"] || ""),
        image:        String(row["image"] || ""),
        price:        String(row["price"] || ""),
        label:        String(row["label"] || ""),
        description:  String(row["description"] || ""),
        affiliateUrl: String(row["affiliateUrl"] || ""),
        hidden:       row["hidden"] === true || String(row["hidden"]).toLowerCase() === "true"
      });
    });

    var output = JSON.stringify({ folders: folderOrder });
    return ContentService
      .createTextOutput(output)
      .setMimeType(ContentService.MimeType.JSON);

  } catch(err) {
    return returnError("doGet Error: " + err.toString());
  }
}

// ── doPost: terima action dan proses ──────────────────────────
function doPost(e) {
  try {
    var params = JSON.parse(e.postData.contents);
    var action = params.action;
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // ── SAVE_ALL: tulis ulang KEDUA sheet sekaligus ──────────
    if (action === "SAVE_ALL") {
      var folders = params.folders || [];
      var foldersSheet  = getOrCreateSheet(ss, FOLDERS_SHEET,  FOLDER_HEADERS);
      var productsSheet = getOrCreateSheet(ss, PRODUCTS_SHEET, PRODUCT_HEADERS);

      // Clear data rows (keep header)
      clearDataRows(foldersSheet);
      clearDataRows(productsSheet);

      var folderRows  = [];
      var productRows = [];

      folders.forEach(function(folder) {
        var fid = String(folder.id || "").trim();
        if (!fid) return;

        folderRows.push([
          fid,
          folder.title || "",
          folder.description || "",
          folder.hidden ? "TRUE" : "FALSE"
        ]);

        (folder.products || []).forEach(function(p) {
          var pid = String(p.id || "").trim();
          if (!pid) return;
          productRows.push([
            pid,
            fid,
            p.name || "",
            p.image || "",
            p.price || "",
            p.label || "",
            p.description || "",
            p.affiliateUrl || "",
            p.hidden ? "TRUE" : "FALSE"
          ]);
        });
      });

      if (folderRows.length > 0) {
        foldersSheet.getRange(2, 1, folderRows.length, FOLDER_HEADERS.length).setValues(folderRows);
      }
      if (productRows.length > 0) {
        productsSheet.getRange(2, 1, productRows.length, PRODUCT_HEADERS.length).setValues(productRows);
      }

      return returnSuccess(
        "Sync berhasil. " + folderRows.length + " folder, " + productRows.length + " produk disimpan."
      );
    }

    // ── ADD_FOLDER ───────────────────────────────────────────
    if (action === "ADD_FOLDER") {
      var f = params.folder;
      var foldersSheet = getOrCreateSheet(ss, FOLDERS_SHEET, FOLDER_HEADERS);
      foldersSheet.appendRow([f.id, f.title, f.description || "", f.hidden ? "TRUE" : "FALSE"]);
      return returnSuccess("Folder berhasil ditambahkan.");
    }

    // ── EDIT_FOLDER ──────────────────────────────────────────
    if (action === "EDIT_FOLDER") {
      var f = params.folder;
      var foldersSheet = getOrCreateSheet(ss, FOLDERS_SHEET, FOLDER_HEADERS);
      var rowIdx = findRowById(foldersSheet, 1, f.id); // col A = folderID
      if (rowIdx === -1) return returnError("Folder ID tidak ditemukan: " + f.id);
      foldersSheet.getRange(rowIdx, 1, 1, 4).setValues([[
        f.id, f.title, f.description || "", f.hidden ? "TRUE" : "FALSE"
      ]]);
      return returnSuccess("Folder berhasil diupdate.");
    }

    // ── DELETE_FOLDER ─────────────────────────────────────────
    if (action === "DELETE_FOLDER") {
      var fid = params.folderID;
      var foldersSheet  = getOrCreateSheet(ss, FOLDERS_SHEET,  FOLDER_HEADERS);
      var productsSheet = getOrCreateSheet(ss, PRODUCTS_SHEET, PRODUCT_HEADERS);

      // Delete folder row
      var rowIdx = findRowById(foldersSheet, 1, fid);
      if (rowIdx !== -1) foldersSheet.deleteRow(rowIdx);

      // Delete all products in this folder (col B = folderID, index 2)
      deleteRowsByColValue(productsSheet, 2, fid);
      return returnSuccess("Folder dan semua produknya berhasil dihapus.");
    }

    // ── ADD_PRODUCT ──────────────────────────────────────────
    if (action === "ADD_PRODUCT") {
      var p = params.product;
      var productsSheet = getOrCreateSheet(ss, PRODUCTS_SHEET, PRODUCT_HEADERS);
      productsSheet.appendRow([
        p.id, p.folderID, p.name, p.image || "", p.price || "",
        p.label || "", p.description || "", p.affiliateUrl || "",
        p.hidden ? "TRUE" : "FALSE"
      ]);
      return returnSuccess("Produk berhasil ditambahkan.");
    }

    // ── EDIT_PRODUCT ─────────────────────────────────────────
    if (action === "EDIT_PRODUCT") {
      var p = params.product;
      var productsSheet = getOrCreateSheet(ss, PRODUCTS_SHEET, PRODUCT_HEADERS);
      var rowIdx = findRowById(productsSheet, 1, p.id); // col A = productID
      if (rowIdx === -1) return returnError("Product ID tidak ditemukan: " + p.id);
      productsSheet.getRange(rowIdx, 1, 1, 9).setValues([[
        p.id, p.folderID, p.name, p.image || "", p.price || "",
        p.label || "", p.description || "", p.affiliateUrl || "",
        p.hidden ? "TRUE" : "FALSE"
      ]]);
      return returnSuccess("Produk berhasil diupdate.");
    }

    // ── DELETE_PRODUCT ────────────────────────────────────────
    if (action === "DELETE_PRODUCT") {
      var pid = params.productID;
      var productsSheet = getOrCreateSheet(ss, PRODUCTS_SHEET, PRODUCT_HEADERS);
      var rowIdx = findRowById(productsSheet, 1, pid);
      if (rowIdx === -1) return returnError("Product ID tidak ditemukan: " + pid);
      productsSheet.deleteRow(rowIdx);
      return returnSuccess("Produk berhasil dihapus.");
    }

    return returnError("Action tidak dikenal: " + action);

  } catch(err) {
    return returnError("doPost Error: " + err.toString());
  }
}

// ── Helpers ───────────────────────────────────────────────────

function getOrCreateSheet(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getSheetData(sheet) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];

  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var data    = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  return data.map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) { obj[h] = row[i]; });
    return obj;
  });
}

function clearDataRows(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.deleteRows(2, lastRow - 1);
  }
}

// Find a row where column `colIndex` (1-based) matches `value`.
// Returns the row number (1-based) or -1 if not found.
function findRowById(sheet, colIndex, value) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  var col = sheet.getRange(2, colIndex, lastRow - 1, 1).getValues();
  for (var i = 0; i < col.length; i++) {
    if (String(col[i][0]).trim() === String(value).trim()) return i + 2;
  }
  return -1;
}

// Delete all rows where column `colIndex` (1-based) matches `value`.
function deleteRowsByColValue(sheet, colIndex, value) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  var col = sheet.getRange(2, colIndex, lastRow - 1, 1).getValues();
  // Loop backwards so row indices stay valid
  for (var i = col.length - 1; i >= 0; i--) {
    if (String(col[i][0]).trim() === String(value).trim()) {
      sheet.deleteRow(i + 2);
    }
  }
}

function returnSuccess(msg) {
  var output = JSON.stringify({ status: "success", message: msg });
  return ContentService.createTextOutput(output).setMimeType(ContentService.MimeType.JSON);
}

function returnError(msg) {
  var output = JSON.stringify({ status: "error", message: msg });
  return ContentService.createTextOutput(output).setMimeType(ContentService.MimeType.JSON);
}
