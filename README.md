# Landing_Page

Landing page nay da duoc noi voi Trevo theo huong frontend-only.

## Cach hoat dong

- `products.html` lay catalog tu `GET /api/public/:orgSlug/products`
- nut `Dat ngay` chuyen sang `checkout.html`
- `checkout.html` redirect sang Trevo public order:
  - `https://app.trevo.studio/{orgSlug}/order?products=productId:qty`

## File env cho phase 1

Project nay da ho tro `.env` cho cac bien public cua storefront.

1. copy `.env.example` thanh `.env`
2. sua gia tri:
   - `TREVO_ORG_SLUG`
   - `TREVO_API_BASE_URL`
   - `TREVO_FRONTEND_BASE_URL`
   - `TREVO_DEBUG`
3. chay `npm run build` hoac `npm run dev`

Script build se tu sinh `runtime-config.js`.

Luu y:

- day la config public cho frontend, khong duoc de API key hay secret vao `.env` nay
- neu khong co `.env`, project van fallback ve gia tri mac dinh

## File can sua neu doi moi truong

Sua [js/trevo-config.js](./js/trevo-config.js):

- `orgSlug`
- `apiBaseUrl`
- `frontendBaseUrl`
- `merchandising.homepageFeatured`
- `merchandising.bestSellerCarousel`

## Chon san pham noi bat

- phase 1 dang uu tien chon san pham qua `preferredSkus` hoac `preferredIds`
- neu chua dien SKU/ID, he thong se fallback theo `nameIncludes` va `category`
- cach nhanh nhat:
  - vao Trevo lay SKU that cua san pham
  - dien vao `preferredSkus` trong `js/trevo-config.js`
  - reload landing page la homepage va best-seller se dung dung san pham do

## Override nhanh khi test

Ban co the truyen tham so vao URL:

- `?trevo-debug=1` bat catalog inspector
- `?trevo-org=tea-station` doi org slug tam thoi
- `?trevo-api=http://127.0.0.1:15000` tro sang API local
- `?trevo-front=http://127.0.0.1:17617` tro sang frontend Trevo local
- `?trevo-reset=1` xoa override da luu trong localStorage

## Yeu cau ben Trevo

Trong org `tea-station`, can dam bao:

- co `slug` dung
- co san pham public
- `Origin storefront cong khai` co domain cua landing page

Neu thieu origin nay, browser se bi chan CORS khi goi public API.
