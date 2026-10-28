# Data Safety

- Never run `migrate:fresh`, `migrate:refresh`, or `db:wipe` against a database that contains real admin data.
- Use `php artisan migrate` and `php artisan db:seed --class=DestinationSeeder` instead.
- Admin-created destinations are stored directly in the database with `source = admin` and must never be overwritten by seeders.
- Use `php artisan destinations:export` to back up all destinations (including admin-created) to `storage/app/backups/`.
- Use `php artisan destinations:import <path>` to restore from a backup idempotently.
