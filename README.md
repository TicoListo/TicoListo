# TicoListo

TicoListo is a bilingual Costa Rica services MVP for visitors and newcomers.
English is the default language and Spanish is available from the language switcher.

## MVP vertical

- `frontend/`: Next.js public catalog, search/filter experience, service details and assistance request CTA.
- `backend/`: FastAPI + SQLAlchemy API backed by PostgreSQL for services and assistance requests.
- `docker-compose.yml`: local PostgreSQL, API and web services.
- `TicoListo-MVP-v0.1/`: original offline Android prototype kept as a product reference.

## Run locally

```powershell
docker compose up --build
```

Open `http://localhost:3000` for the web app and `http://localhost:8000/docs` for the API.

The public form is the initial UX vertical. The next implementation slice should connect it to `POST /assistance-requests`, add authentication, seed the catalog, and build the protected admin CRUD/assignment workflow.

The frontend uses Tailwind CSS for the shared visual system. From `frontend/`, run `npm install` and `npm run dev` for local development. The full stack remains available with `docker compose up --build`.