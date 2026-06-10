# Deploy Tea Station With Trevo On The Same Azure VM

Mo hinh production sau khi nang cap:

- `app.trevo.studio` -> Trevo frontend
- `api.trevo.studio` -> Trevo backend
- `tea.trevo.studio` -> Tea Station backend + static storefront

Khac voi phase cu:

- khong con phuc vu Tea Station bang static mount trong Caddy
- Caddy se reverse proxy `tea.trevo.studio` vao container `tea-station`

## 1. Chuan bi repo Tea Station

Trong repo Tea Station:

```bash
npm install
```

Copy env:

```bash
cp .env.example .env
cp .env.server.example .env.server
```

### `.env`

Day la env public cho frontend.

Vi du:

```env
TREVO_ORG_SLUG=tea-store
TEA_STATION_API_BASE_URL=
TREVO_API_BASE_URL=https://api.trevo.studio
TREVO_FRONTEND_BASE_URL=https://app.trevo.studio
TREVO_DEBUG=false
```

`TEA_STATION_API_BASE_URL` de trong production cung duoc, vi frontend se goi same-origin.

### `.env.server`

Day la env private cua backend Tea Station.

Vi du:

```env
PORT=3200
SITE_DIR=.
STOREFRONT_NAME=Tea Station
TREVO_ORG_SLUG=tea-store
TREVO_API_BASE_URL=https://api.trevo.studio
TREVO_FRONTEND_BASE_URL=https://app.trevo.studio
TREVO_API_ORIGIN=https://tea.trevo.studio
TREVO_API_KEY=trv_xxx
TREVO_PUBLIC_PAYMENT_PROVIDER=sepay
```

`TREVO_API_KEY` la khoa sinh trong Trevo -> API Keys.

## 2. Push Tea Station len GitHub

```bash
git add .
git commit -m "Upgrade Tea Station to fullstack storefront"
git push origin main
```

## 3. Pull Tea Station tren Azure VM

SSH vao VM:

```bash
cd ~/tea-station
git pull origin main
```

Khong can chay app tay bang PM2/systemd neu deploy bang compose chung voi Trevo.

## 4. Cap nhat Trevo production config

Trong `~/Trevo/.env.production`, them hoac sua:

```env
LANDING_DOMAIN=tea.trevo.studio
LANDING_APP_DIR=/home/azureuser/tea-station
LANDING_ORG_SLUG=tea-store
LANDING_STOREFRONT_NAME=Tea Station
LANDING_TREVO_API_KEY=trv_xxx
LANDING_PAYMENT_PROVIDER=sepay
```

Giai thich:

- `LANDING_APP_DIR`: duong dan repo Tea Station tren VM
- `LANDING_TREVO_API_KEY`: API key cua org Tea Station trong Trevo
- `LANDING_ORG_SLUG`: slug org storefront

## 5. Pull Trevo va rebuild compose

Trong repo Trevo:

```bash
cd ~/Trevo
git pull origin main
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

Sau lenh nay:

- `backend` = Trevo API
- `frontend` = Trevo app
- `tea-station` = Tea Station backend
- `caddy` = reverse proxy cho ca 3 subdomain

## 6. DNS

Tai Name.com:

- `A app.trevo.studio -> IP Azure`
- `A api.trevo.studio -> IP Azure`
- `A tea.trevo.studio -> IP Azure`

Ca 3 cung co the tro ve cung 1 IP, Caddy se tach theo hostname.

## 7. Kiem tra sau deploy

- `https://tea.trevo.studio`
- `https://tea.trevo.studio/products.html`
- `https://tea.trevo.studio/checkout.html`
- `https://tea.trevo.studio/api/storefront/health`
- `https://api.trevo.studio/api/public/tea-store/products`

## 8. Khi nao can Trevo API key

Neu chi muon browser xem catalog public, API key khong bat buoc.

Nhung neu muon di theo huong Nexis/fullstack:

- backend Tea Station giu secret
- backend Tea Station doc protected ERP endpoints
- co dat nen cho customer/order sync sau nay

thi nen co `LANDING_TREVO_API_KEY`.
