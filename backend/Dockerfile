FROM php:8.4-fpm-alpine

RUN apk add --no-cache \
        bash \
        curl \
        freetype \
        git \
        libjpeg-turbo \
        libpng \
        libpq \
        zip \
        unzip \
    && apk add --no-cache --virtual .build-deps \
        $PHPIZE_DEPS \
        freetype-dev \
        libjpeg-turbo-dev \
        libpng-dev \
        libpq-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j"$(nproc)" gd pcntl pdo_pgsql pgsql \
    && docker-php-ext-enable opcache \
    && apk del .build-deps

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist

COPY . .
RUN composer install --no-dev --prefer-dist --optimize-autoloader

RUN addgroup -g 1000 -S lakbai \
    && adduser -u 1000 -S lakbai -G lakbai

COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
COPY docker/php.ini /usr/local/etc/php/conf.d/zz-lakbai.ini

RUN chmod +x /usr/local/bin/entrypoint.sh \
    && (php artisan storage:link --force >/dev/null 2>&1 || true)

RUN mkdir -p storage/framework/cache/data storage/framework/sessions storage/framework/views \
    && chown -R lakbai:lakbai storage bootstrap/cache public \
    && chmod -R 775 storage bootstrap/cache

USER lakbai

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS "http://127.0.0.1:${PORT:-8080}/up" || exit 1

ENTRYPOINT ["entrypoint.sh"]
CMD ["sh", "-c", "exec php artisan serve --host=0.0.0.0 --port=${PORT:-8080}"]
