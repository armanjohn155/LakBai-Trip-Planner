    FROM php:8.4-fpm-alpine

    RUN apk add --no-cache \
            bash \
            curl \
            git \
            zip \
            unzip \
        && docker-php-ext-enable opcache

    COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

    WORKDIR /var/www/html

    COPY composer.json composer.lock ./
    RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist

    COPY . .

    RUN composer install --no-dev --prefer-dist --optimize-autoloader

    COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
    RUN chmod +x /usr/local/bin/entrypoint.sh

    RUN mkdir -p storage/framework/cache/data \
        && chown -R www-data:www-data storage bootstrap/cache \
        && chmod -R g+w storage

   EXPOSE 8080

ENTRYPOINT ["entrypoint.sh"]
CMD php artisan serve --host=0.0.0.0 --port=${PORT:-8080}
