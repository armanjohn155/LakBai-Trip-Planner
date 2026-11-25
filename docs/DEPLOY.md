# Deploying LakBai to Render

This deployment keeps Neon PostgreSQL as the database. Render runs three services:

- `lakbai-api` — Laravel API (Docker)
- `lakbai-web` — React static site
- `lakbai-reverb` — Laravel Reverb WebSocket server (Docker)

A queue worker and scheduler are optional and are included as commented blocks in `render.yaml`.

## Before you deploy

1. Push the deployment branch to GitHub/GitLab.
2. In Render, create a new **Blueprint** from `render.yaml`.
3. Fill every `sync: false` environment variable in the Render dashboard. Do not commit values.
4. Use the same `APP_KEY` for `lakbai-api`, `lakbai-reverb`, and any worker/cron you enable. Generate one with:

   ```sh
   php artisan key:generate --show
   ```

5. Set `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS`, `REVERB_ALLOWED_ORIGINS`, and the Google callback URLs to the **frontend** HTTPS URL. Set `APP_URL` and `GOOGLE_REDIRECT_URI` to the **API** HTTPS URL.
6. Deploy the Blueprint. The static site build derives `VITE_API_URL` and `VITE_REVERB_*` from the deployed service hosts, so no localhost URL is baked into the bundle.

## Environment variables

### `lakbai-api`

| Variable | Notes |
| --- | --- |
| `APP_NAME` | Fixed in the blueprint. |
| `APP_ENV` | `production`. |
| `APP_DEBUG` | Must be false. |
| `APP_KEY` | Dashboard only. Must match Reverb/worker/cron. |
| `APP_URL` | Public API HTTPS URL. Drives `asset()` URLs in API responses. |
| `APP_FORCE_HTTPS` | Forces HTTPS URL generation. |
| `TRUSTED_PROXIES` | Set to `*` so Render's proxy headers are honoured. |
| `FRONTEND_URL` | Public frontend HTTPS URL. Used by CORS, Sanctum, Reverb, password resets, Google redirects. |
| `CORS_ALLOWED_ORIGINS` | Comma-separated browser origins allowed to call the API. |
| `SANCTUM_STATEFUL_DOMAINS` | Hosts allowed for stateful Sanctum cookies. Bearer-token auth does not require this. |
| `LOG_CHANNEL` | `stderr` for Render log capture. |
| `DB_CONNECTION` | `pgsql`. |
| `DB_URL` | Neon pooled connection string (used by the app at runtime). |
| `DB_URL_DIRECT` | Neon direct connection string. Used only for migrations. |
| `RUN_MIGRATIONS` | Set to `true` only on the API service. After a successful migration deploy you may set it back to `false`. |
| `SESSION_DRIVER`, `QUEUE_CONNECTION`, `CACHE_STORE` | `database` by default; can be changed to lighter drivers on constrained plans. |
| `SESSION_SECURE_COOKIE`, `SESSION_SAME_SITE` | Hardened cookie settings. |
| `FILESYSTEM_DISK` | `s3` to route public uploads to S3/R2. |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_DEFAULT_REGION`, `AWS_BUCKET`, `AWS_URL`, `AWS_ENDPOINT`, `AWS_USE_PATH_STYLE_ENDPOINT` | Object storage settings. `AWS_URL` must be the public base URL. |
| `BROADCAST_CONNECTION` | `reverb`. |
| `REVERB_APP_ID`, `REVERB_APP_KEY`, `REVERB_APP_SECRET` | From the `lakbai-reverb` environment group. Same values in all services that broadcast or listen. |
| `REVERB_HOST`, `REVERB_PORT`, `REVERB_SCHEME` | Internal Reverb endpoint used by the backend to publish (`fromService` host, port `10000`, `http`). The browser uses the public host baked into the static bundle instead. |
| `REVERB_ALLOWED_ORIGINS` | Comma-separated frontend origins allowed to open WebSockets. |
| `MAIL_MAILER`, `MAIL_HOST`, `MAIL_PORT`, `MAIL_SCHEME`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME` | Production mail transport. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GOOGLE_FRONTEND_CALLBACK` | Google OAuth client settings. |
| `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD` | Used only when you explicitly run `AdminSeeder`. Never leave a real admin password in the repository. |

### `lakbai-reverb`

Use the same `APP_KEY`, Reverb app credentials, database, cache, queue, and object-storage variables as the API. `RUN_MIGRATIONS` must be `false`. `PORT`, `REVERB_SERVER_HOST`, and `REVERB_SERVER_PORT` are set in the blueprint for the container listener.

### `lakbai-web`

`VITE_API_URL`, `VITE_APP_NAME`, and `VITE_REVERB_*` are exported by the build command from public `onrender.com` hostnames. Do not set them manually to localhost or to Render's private `fromService` hostnames. The static site also has an SPA rewrite (`/*` → `/index.html`) and security headers in `render.yaml`.

## Migrations and admin bootstrap

The container entrypoint never seeds automatically and never creates a SQLite file.

1. On the first deploy, leave `RUN_MIGRATIONS=true`. The API service runs `php artisan migrate --force` using `DB_URL_DIRECT` (falling back to `DB_URL`) before caching config and routes.
2. Confirm `/up` returns 200 and the deploy is healthy.
3. To avoid re-running migrations on every deploy, set `RUN_MIGRATIONS=false` and redeploy. Turn it back on only for a release that contains migrations.
4. To create the first admin, use Render Shell on `lakbai-api` with `ADMIN_EMAIL` and `ADMIN_PASSWORD` present, then run:

   ```sh
   php artisan db:seed --class=AdminSeeder --force
   ```

5. Destination data can be seeded explicitly with `php artisan db:seed --class=DestinationSeeder --force` if it is not already present.

Never run `migrate:fresh`, `migrate:refresh`, or `db:wipe` against production.

## Google OAuth

1. Create an OAuth client in Google Cloud.
2. Add the frontend HTTPS URL as an authorized JavaScript origin.
3. Add the API path `/api/auth/google/callback` as an authorized redirect URI.
4. Put the client ID and secret in the Render dashboard only. Update `GOOGLE_REDIRECT_URI` and `GOOGLE_FRONTEND_CALLBACK` if your service hostnames differ from the blueprint defaults.

## Mail

The default `log` mailer must not be used in production. Configure `MAIL_MAILER=smtp` and the SMTP variables in the Render dashboard. Password-reset links point at `FRONTEND_URL/reset-password`.

## Object storage

Set `FILESYSTEM_DISK=s3` and the `AWS_*` variables on every service that reads or writes uploaded media. Public upload URLs are generated with `Storage::disk('public')->url(...)`; with S3/R2 this resolves to `AWS_URL`. Existing local `/storage/...` values continue to resolve to the same public base URL.

## Reverb, worker, and scheduler

- Reverb is a separate web service. The frontend uses `VITE_REVERB_*` from the static build; if the key is missing, the app falls back to polling.
- Uncomment `lakbai-worker` in `render.yaml` when queued jobs are needed. It runs `queue:work`.
- Uncomment `lakbai-cron` in `render.yaml` to run `schedule:run` every minute. The scheduled commands are defined in `bootstrap/app.php`.
- Keep `RUN_MIGRATIONS=false` on both optional services.

## Free-tier limits

- Free web services sleep after inactivity and have slow cold starts. Reverb and the API should use a paid plan if live tracking or predictable response times matter.
- Neon's free tier has compute and storage limits and may pause. Use the pooled URL for runtime traffic and the direct URL for migrations.
- Render Key Value (if adopted later) has a free 25 MB tier with a limited connection count.
- Database-backed sessions, cache, and queues add load to Neon. On constrained deployments, consider `array`/`file` cache, `sync` queue, and cookie sessions.
- Static sites are free and served from Render's CDN.

## Custom domains

Add domains under the `domains` field of `lakbai-api`, `lakbai-web`, and `lakbai-reverb`. Then update every absolute URL variable (`APP_URL`, `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS`, `SANCTUM_STATEFUL_DOMAINS`, `REVERB_ALLOWED_ORIGINS`, `GOOGLE_REDIRECT_URI`, `GOOGLE_FRONTEND_CALLBACK`, `AWS_URL`) and redeploy the frontend so the compiled `VITE_*` values match.

## Rollback

1. In Render, deploy the previous known-good commit for each affected service.
2. If a rollback includes a migration, restore the Neon database from a backup before the old code starts serving traffic.
3. Run `php artisan optimize:clear` in Render Shell after rollback so cached config/routes/views match the restored code.
4. Keep `RUN_MIGRATIONS=false` during a code-only rollback.

## Deployment checklist

- [ ] No secrets in the repository; `.env` files remain untracked.
- [ ] `APP_KEY` set and identical on API/Reverb/worker/cron.
- [ ] `APP_URL` is the API HTTPS URL; `FRONTEND_URL` is the frontend HTTPS URL.
- [ ] `DB_URL` and `DB_URL_DIRECT` set in the dashboard.
- [ ] `RUN_MIGRATIONS=true` only for the migration deploy.
- [ ] Admin and destination seeders run explicitly, not automatically.
- [ ] `CORS_ALLOWED_ORIGINS` and `REVERB_ALLOWED_ORIGINS` contain only real frontend origins.
- [ ] Mail transport configured; no `log` mailer in production.
- [ ] Object storage configured with a public `AWS_URL`.
- [ ] Google OAuth redirect/origin URLs registered.
- [ ] `GET /up` returns 200 on `lakbai-api`.
- [ ] Frontend deep links return the SPA shell and unknown routes show the 404 page.
- [ ] Reverb connection works or polling fallback is confirmed.
- [ ] Optional worker/cron enabled only if queue/schedule behaviour is needed.
