# Deploy Tea Station With Trevo

Tea Station is a separate storefront app. It connects to Trevo through
org-scoped API keys, but it is not part of the Trevo Docker Compose stack.

Production shape:

- `app.trevo.studio` -> Trevo frontend
- `api.trevo.studio` -> Trevo backend
- `tea.trevo.studio` -> Tea Station backend + static storefront

## 1. Prepare Trevo

In Trevo:

1. Create or select the Tea Station organization.
2. Set public slug, for example `tea-store`.
3. Create an API key for Tea Station.
4. Set allowed origin to `https://tea.trevo.studio`.
5. Copy the raw API key once.

The API key belongs to Tea Station backend env, not Trevo `.env.production`.

## 2. Prepare Tea Station Env

In the Tea Station repo:

```bash
cp .env.example .env
cp .env.server.example .env.server
```

`.env` is public runtime config for browser-side code:

```env
TREVO_ORG_SLUG=tea-store
TEA_STATION_API_BASE_URL=
TREVO_API_BASE_URL=https://api.trevo.studio
TREVO_FRONTEND_BASE_URL=https://app.trevo.studio
TREVO_DEBUG=false
```

`.env.server` is private backend config:

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

Do not commit `.env` or `.env.server`.

## 3. Deploy On The Same Azure VM

Clone/pull Tea Station on the VM:

```bash
cd ~
git clone git@github.com:<your-user>/<tea-station-repo>.git tea-station
cd ~/tea-station
cp .env.example .env
cp .env.server.example .env.server
nano .env.server
```

Start Tea Station:

```bash
docker compose --env-file .env.server -f docker-compose.prod.yml up -d --build
```

This exposes Tea Station only on the VM loopback interface:

```txt
127.0.0.1:3200 -> tea-station container
```

That keeps the app private until an edge proxy routes `tea.trevo.studio` to it.

## 4. Reverse Proxy

Only one process can bind host ports `80` and `443`. If Trevo Caddy is already
using those ports, do not start another public Caddy for Tea Station.

Recommended options:

- Use one shared edge Caddy outside app repos and proxy each hostname.
- Or temporarily add a host-level Caddy route for `tea.trevo.studio` to
  `127.0.0.1:3200`.

Example host-level Caddy route:

```caddyfile
tea.trevo.studio {
	encode gzip zstd
	reverse_proxy 127.0.0.1:3200
}
```

This proxy wiring is deployment infrastructure. It should not store
`TREVO_API_KEY`, `TREVO_ORG_SLUG`, or other Tea Station business config inside
Trevo env.

## 5. DNS

At the domain provider:

- `A app.trevo.studio -> Azure VM IP`
- `A api.trevo.studio -> Azure VM IP`
- `A tea.trevo.studio -> Azure VM IP`

The reverse proxy separates traffic by hostname.

## 6. Verify

```bash
curl http://127.0.0.1:3200/api/storefront/health
curl https://tea.trevo.studio/api/storefront/health
curl https://api.trevo.studio/api/public/tea-store/products
```

Then open:

- `https://tea.trevo.studio`
- `https://tea.trevo.studio/products.html`
- `https://tea.trevo.studio/checkout.html`

## 7. Update Release

```bash
cd ~/tea-station
git pull origin main
docker compose --env-file .env.server -f docker-compose.prod.yml up -d --build
```

Use this command after each Tea Station code change. Trevo does not need a
redeploy unless the Trevo API itself changed.
