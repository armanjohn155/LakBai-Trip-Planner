<?php

namespace Database\Seeders;

use App\Services\DestinationOptionService;
use Illuminate\Database\Seeder;

class DestinationOptionSeeder extends Seeder
{
    /**
     * Fill the category and region option tables from the built-in constants
     * and any values already present on destinations. Idempotent.
     */
    public function run(): void
    {
        app(DestinationOptionService::class)->seedDefaults();
    }
}
