# TicoListo

TicoListo is a bilingual Costa Rica services MVP for visitors and newcomers.
English is the default language and Spanish is available from the language switcher.

## MVP vertical

- `frontend/`: Next.js public catalog, SEO guides under `/guias/[slug]`, JSON-LD, sitemap and operations panel under `/admin`.
- `backend/`: FastAPI + SQLAlchemy API backed by PostgreSQL for services, official guides, assistance requests and admin messaging.
- `docker-compose.yml`: local PostgreSQL, API and web services.
- `TicoListo-MVP-v0.1/`: original offline Android prototype kept as a product reference.

## Run locally

```powershell
docker compose up --build
```

Open `http://localhost:3000` for the web app and `http://localhost:8000/docs` for the API.

The public form uses `POST /assistance-requests`. Public guides expose the institution, exact official portal, requirements, steps and a delegation CTA. The administrative API is protected with the `X-Admin-Key` header; configure `ADMIN_API_KEY` in the environment before deployment. The local development value is `dev-admin-key`, and `/admin` provides the initial request queue.

Available guide endpoints include `GET /guides`, `GET /guides/{slug}`, `GET /admin/assistance-requests`, `PATCH /admin/assistance-requests/{id}`, `POST /admin/assistance-requests/{id}/messages`, `GET /admin/guides` and `POST /admin/guides`.

The platform also includes:

- Daily official portal monitoring plus the protected `GET /admin/portals` and `POST /admin/portals/check` endpoints.
- Operational request statuses: new, contacted, waiting documents, documents received, in progress, waiting institutional response, correction required and completed.
- Advanced request search by name, email, phone, description, province and tags.
- Tasks, notifications, internal tags, consent capture and protected document uploads per request.
- Intelligent search suggestions, a guided intake assistant, province landing pages and FAQ JSON-LD.
- A PowerShell PostgreSQL backup script: `.\scripts\backup.ps1`. Store backups outside the repository and test restoration regularly.

Personal data is restricted to the protected admin API. Before production, configure HTTPS, a real identity provider, encrypted object storage, retention/deletion workflows and a privacy notice/consent policy.

The frontend uses Tailwind CSS for the shared visual system. From `frontend/`, run `npm install` and `npm run dev` for local development. The full stack remains available with `docker compose up --build`.