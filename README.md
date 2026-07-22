# naksha-backend

Express + TypeScript + Prisma + Postgres + Cloudinary.

## Setup

```bash
cd backend
npm install
# Fill real values in .env:
#   DATABASE_URL  — replace **** with your Neon password
#   CLOUDINARY_API_SECRET
npm run prisma:migrate -- --name init   # creates all tables on Neon
npm run dev                              # starts server on :4000
```

## Auth

Single admin user, credentials from the environment:

```bash
npx tsx scripts/hash-password.ts 'the-password'   # prints ADMIN_PASSWORD_HASH + AUTH_SECRET
```

Set `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` and `AUTH_SECRET` (see `.env.example`).
The hash is colon-separated (`scrypt:N:salt:hash`) rather than the usual `$`
form, because Docker Compose interpolates `$FOO` and would silently truncate it.
Paste the whole value; if it arrives malformed the startup log says so by name.
`POST /auth/login` returns a signed, stateless token that the admin sends as
`Authorization: Bearer <token>`; it expires after `AUTH_TOKEN_TTL_HOURS`
(default 12). Changing `AUTH_SECRET` invalidates every issued token.

What is protected:

| | |
|---|---|
| Public | all `GET`s the website reads (collections, pages, globals, redirects, SEO), plus `POST /contact` and `/health` |
| Admin only | every `POST`/`PUT`/`PATCH`/`DELETE`, plus `GET /contact` (inbox) and `GET /internal-links` |

Reads stay open on purpose: the public site fetches this API anonymously, so
gating them would take the site offline. If the auth variables are missing the
server still boots and serves those reads, but `/auth/login` returns 503 and
every write returns 401 — the CMS locks, the site does not.

Failed logins are throttled per IP (8 per 15 minutes, in-memory).

## Endpoints

### System
- `GET /` — service info
- `GET /health` — server + database status

### Auth
- `POST /auth/login` `{ email, password }` → `{ token, expiresAt, user }`
- `GET /auth/me` — current admin (requires token)
- `POST /auth/logout` — client-side token drop; tokens are stateless

### Content collections (CRUD)
- `/projects` — list / `:id` / `by-slug/:slug` / POST / PATCH / DELETE
- `/services`
- `/markets`
- `/articles`
- `/leaders`
- `/jobs`
- `/locations`
- `/testimonials`

Each: `GET /` (list, sorted by `sortOrder`), `GET /:id`, `GET /by-slug/:slug` (if applicable), `POST`, `PATCH /:id`, `DELETE /:id`. Renaming a slug auto-creates a `Redirect`.

### Pages (block-based layouts, one per route)
- `GET /pages` — list
- `GET /pages/by-path?path=/about`
- `GET /pages/by-key/:key`
- `GET /pages/:id`
- `POST /pages` `{ key, path, title, blocks, seo* }`
- `PATCH /pages/:id` — auto-creates redirect if `path` changes
- `DELETE /pages/:id`

### Globals (singletons: navbar, footer, siteSettings)
- `GET /globals` — list all
- `GET /globals/:key`
- `PUT /globals/:key` `{ value: ... }` — upsert
- `DELETE /globals/:key`

### Media library (Cloudinary-backed)
- `GET /media?tag=&folder=` — list
- `GET /media/:id`
- `POST /media` — register an asset that the admin just uploaded to Cloudinary
- `PATCH /media/:id` — update `alt`/`tags`
- `DELETE /media/:id` — removes from Cloudinary + DB

### Cloudinary signed uploads
- `POST /uploads/sign` `{ folder?, tags? }` → returns `{ timestamp, signature, apiKey, cloudName }` for the browser upload widget

### Redirects
- `GET /redirects`
- `POST /redirects` `{ fromPath, toPath, statusCode? }` — upsert
- `PATCH /redirects/:id`
- `DELETE /redirects/:id`

### Contact form
- `POST /contact` — public submit
- `GET /contact` — admin inbox (latest 200)
- `DELETE /contact/:id`

## What's next

- **Phase 3** — Admin UI app in `admin/` calling these endpoints.
- **Phase 4** — Seed existing `lib/data.ts` content + page copy + cutover the public site.

Auth is intentionally not added yet (per spec).
