# Data and Neon Verification

## Destination persistence safety
- Destination create/update must persist through Eloquent against the active configured database connection (Neon/PostgreSQL in production environments using `DB_URL`/`pgsql`).
- Never run `php artisan migrate:fresh`, `php artisan migrate:refresh`, or `php artisan db:wipe` against shared/Neon databases.
- Run automated tests only against isolated SQLite in-memory configuration (`phpunit.xml` forces `DB_CONNECTION=sqlite`, `DB_DATABASE=:memory:`, and clears `DB_URL`).
- Do not commit or print secrets such as `DB_URL`, database passwords, or tokens.

## Neon SQL verification
After creating a destination via the admin UI/API, refresh the Neon table viewer manually and run:

```sql
SELECT id, name, category, region, source, created_at
FROM destinations
ORDER BY id DESC
LIMIT 5;
```

You can also verify from the app environment:

```bash
php artisan destinations:latest --limit=5
```

Admin-only API check for a specific saved row:

```http
GET /api/admin/destinations/{id}/db-check
Authorization: Bearer <admin-token>
```

The response includes the stored `id`, `created_at`, `source`, and active database name/driver (no credentials).

## Images
- Uploaded destination images are stored on local disk at `storage/app/public/destinations` (served via the app's `/storage/...` path when the storage symlink is configured).
- The database stores only the image path/URL reference (for example `/storage/destinations/...`), not the binary image data.

## Known leftover Neon test rows (report)
If present in the shared Neon database, these rows were previously reported and must **not** be deleted without checking references first:

- `XTestUnique123`
- `XTestUnique999`

Check for itinerary references before removal:

```sql
SELECT ii.id, ii.itinerary_id, ii.destination_id, d.name
FROM itinerary_items ii
JOIN destinations d ON d.id = ii.destination_id
WHERE d.name IN ('XTestUnique123', 'XTestUnique999');
```

Only delete if there are no references:

```sql
DELETE FROM destinations
WHERE name IN ('XTestUnique123', 'XTestUnique999')
  AND id NOT IN (SELECT destination_id FROM itinerary_items WHERE destination_id IS NOT NULL);
```
