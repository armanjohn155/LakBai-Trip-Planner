#!/bin/sh
set -e

if [ -z "${APP_KEY}" ]; then
    echo "APP_KEY not set — generating a temporary one. Set APP_KEY in your .env to persist it."
    APP_KEY="$(php artisan key:generate --show 2>/dev/null | tail -n 1)"
    export APP_KEY
fi

if [ ! -f storage/database.sqlite ]; then
    touch storage/database.sqlite
fi

chown www-data:www-data storage/database.sqlite

php artisan migrate --force
php artisan storage:link --force 2>/dev/null || true

chown -R www-data:www-data storage bootstrap/cache

exec "$@"