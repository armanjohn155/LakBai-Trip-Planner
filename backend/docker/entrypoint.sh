#!/bin/sh
set -e

if [ -z "${APP_KEY:-}" ]; then
    echo "APP_KEY not set — generating a temporary key for this container. Set APP_KEY in the Render dashboard."
    APP_KEY="$(php artisan key:generate --show 2>/dev/null | tail -n 1)"
    export APP_KEY
fi

if [ "${RUN_MIGRATIONS:-false}" = "true" ] || [ "${RUN_MIGRATIONS:-false}" = "1" ]; then
    echo "Running database migrations..."
    # A cached config would hide DB_URL_DIRECT, so start from a clean config.
    php artisan config:clear >/dev/null 2>&1 || true

    if [ -n "${DB_URL_DIRECT:-}" ]; then
        DB_URL="$DB_URL_DIRECT" php artisan migrate --force --no-interaction
    else
        php artisan migrate --force --no-interaction
    fi
fi

php artisan storage:link --force >/dev/null 2>&1 || true

if [ "${RUN_CACHES:-true}" != "false" ]; then
    php artisan config:cache
    php artisan route:cache
    php artisan view:cache
    php artisan event:cache >/dev/null 2>&1 || true
fi

exec "$@"
