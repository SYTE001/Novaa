# Novaa Affiliate Folder Directory (Cloudflare Pages)

Modern, lightweight affiliate product directory with folder-based browsing and a secure `/admin` dashboard.

## Features

- Dark premium UI with serif headlines + sans-serif controls.
- Folder-based homepage with smooth expand/collapse product cards.
- Instant search filter for folders and products.
- Product cards include: image, name, price, label, description, **Buy Now**, and **Copy Link**.
- Password-protected admin at `/admin` with CRUD + hide/unhide for folders and products.
- Cloudflare Pages Functions API for auth and data access.
- KV-backed persistence for high-speed reads/writes.

## Cloudflare Setup

1. Deploy this repo to Cloudflare Pages.
2. Add a KV Namespace binding named `AFFILIATE_DB`.
3. Add environment variables:
   - `ADMIN_PASSWORD`
   - `ADMIN_SESSION_SECRET` (long random string)
4. Build command is not required (static + functions).

## Data model

Data is stored as JSON:

```json
{
  "folders": [
    {
      "id": "folder-id",
      "title": "Folder Name",
      "description": "Optional",
      "hidden": false,
      "products": [
        {
          "id": "product-id",
          "name": "Product Name",
          "image": "https://...",
          "price": "$39",
          "label": "Best Seller",
          "description": "Short pitch",
          "affiliateUrl": "https://...",
          "hidden": false
        }
      ]
    }
  ]
}
```

If KV is empty, the site falls back to `folders.json`.
