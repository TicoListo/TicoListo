# TicoListo

TicoListo is a bilingual Costa Rica services MVP for visitors and newcomers.
English is the default language and Spanish is available from the language switcher.

## MVP vertical

- `frontend/`: Next.js public catalog, bilingual SEO service pages under `/es/servicios/[slug]` and `/en/services/[slug]`, JSON-LD, hreflang, sitemap and operations panel under `/admin`.
- `backend/`: FastAPI + SQLAlchemy API backed by PostgreSQL for services, official guides, assistance requests and admin messaging.
- `docker-compose.yml`: local PostgreSQL, API and web services.
- `TicoListo-MVP-v0.1/`: original offline Android prototype kept as a product reference.

## Run locally

```powershell
docker compose up --build
```

Open `http://localhost:3000` for the web app and `http://localhost:8000/docs` for the API.

The public form uses `POST /assistance-requests`. Public guides expose the institution, exact official portal, requirements, steps and a delegation CTA. The administrative API is protected with the `X-Admin-Key` header; configure `ADMIN_API_KEY` in the environment before deployment. The local development value is `dev-admin-key`, and `/admin` provides the initial request queue.

Available guide endpoints include `GET /guides` and `GET /guides/{slug}`. SEO services expose `GET /services/{language}/{slug}` and can be created or edited from the browser through `GET/POST/PUT/PATCH/DELETE /admin/services` (protected by `X-Admin-Key`). Configure `NEXT_PUBLIC_SITE_URL` with the public domain so canonical URLs, Open Graph, hreflang and the sitemap do not use localhost. The old `/guias/[slug]` route redirects to the corresponding Spanish service URL when a matching service exists.

The administrative panel is separated into `/admin/clientes`, `/admin/calendario` and `/admin/seo`. The calendar section centralizes the public due-date guidance for INS, DEKRA, municipal taxes, Hacienda and CCSS. From each calendar item, an administrator can open the official portal or prepare a follow-up note in the selected client case.

The platform also includes:

- Daily official portal monitoring plus the protected `GET /admin/portals` and `POST /admin/portals/check` endpoints.
- Operational request statuses: new, contacted, waiting documents, documents received, in progress, waiting institutional response, correction required and completed.
- Advanced request search by name, email, phone, description, province and tags.
- Tasks, notifications, internal tags, consent capture and protected document uploads per request.
- Intelligent search suggestions, a guided intake assistant, province landing pages and FAQ JSON-LD.
- A PowerShell PostgreSQL backup script: `.\scripts\backup.ps1`. Store backups outside the repository and test restoration regularly.

Personal data is restricted to the protected admin API. Before production, configure HTTPS, a real identity provider, encrypted object storage, retention/deletion workflows and a privacy notice/consent policy.

The frontend uses Tailwind CSS for the shared visual system. From `frontend/`, run `npm install` and `npm run dev` for local development. The full stack remains available with `docker compose up --build`.

## Production deployment with Supabase and Vercel

The production deployment uses only two services:

1. Create or select the Supabase project and use its **pooler** PostgreSQL
   connection string for `DATABASE_URL`, changing the scheme to
   `postgresql+asyncpg://`. The current Vercel-compatible project entry point
   is `api/index.py`; it exposes the FastAPI application as Vercel's Python
   function.
2. Import the repository into Vercel. Keep the repository root as the project
   root (do not set `frontend` as the Root Directory), then configure:
   `DATABASE_URL`, `ADMIN_API_KEY`, `CORS_ORIGINS`, `NEXT_PUBLIC_API_URL=/api`,
   `API_SERVER_URL=https://YOUR-VERCEL-DOMAIN.vercel.app/api` and
   `NEXT_PUBLIC_SITE_URL=https://YOUR-VERCEL-DOMAIN.vercel.app`.
3. Vercel builds Next.js from `frontend/` using the root `vercel.json` and
   serves FastAPI under `/api`. Supabase supplies PostgreSQL only.

The portal monitor is disabled on Vercel because serverless functions cannot
maintain an infinite background task. Use the protected portal-check endpoint
from a scheduled external call if continuous monitoring is required.

Do not use `localhost` or the local `dev-admin-key` in production. Copy the
example variables from `backend/.env.example` and `frontend/.env.example`;
never commit real credentials.