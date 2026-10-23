<?php

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$listeners = app('events')->getListeners(App\Events\TripUpdated::class);
echo 'count='.count($listeners)."\n";
foreach ($listeners as $listener) {
    var_export($listener);
    echo "\n";
}
