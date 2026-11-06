<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::table('destinations')
            ->where('region', 'Metro Cebu')
            ->update(['region' => 'Cebu City and Metro Cebu']);

        DB::table('destinations')
            ->where('region', 'North Cebu')
            ->where(function ($query) {
                $query->where('municipality', 'like', '%Camotes%')
                    ->orWhere('name', 'like', '%Camotes%');
            })
            ->update(['region' => 'Camotes and Cross Region Trip']);

        DB::table('destinations')
            ->where('region', 'North Cebu')
            ->where(function ($query) {
                $query->where('municipality', 'like', '%Bantayan%')
                    ->orWhere('municipality', 'like', '%Daanbantayan%')
                    ->orWhere('name', 'like', '%Island%');
            })
            ->update(['region' => 'North Cebu Islands']);

        DB::table('destinations')
            ->where('region', 'North Cebu')
            ->update(['region' => 'North Cebu Mainland']);

        $westMunicipalities = ['Toledo', 'Balamban', 'Asturias', 'Pinamungajan', 'Aloguinsan', 'Tuburan', 'Tabuelan'];

        DB::table('destinations')
            ->where('region', 'South Cebu')
            ->where(function ($query) use ($westMunicipalities) {
                foreach ($westMunicipalities as $municipality) {
                    $query->orWhere('municipality', 'like', "%{$municipality}%");
                }
            })
            ->update(['region' => 'West Cebu']);

        $southwestMunicipalities = ['Badian', 'Moalboal', 'Alegria', 'Malabuyoc', 'Ginatilan', 'Barili', 'Dumanjug', 'Ronda'];

        DB::table('destinations')
            ->where('region', 'South Cebu')
            ->where(function ($query) use ($southwestMunicipalities) {
                foreach ($southwestMunicipalities as $municipality) {
                    $query->orWhere('municipality', 'like', "%{$municipality}%");
                }

                $query->orWhere('name', 'like', '%Osmeña%');
            })
            ->update(['region' => 'South Cebu: Southwest and Highlands']);

        DB::table('destinations')
            ->where('region', 'South Cebu')
            ->update(['region' => 'South Cebu: Southeast and Southern Trip']);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('destinations')
            ->where('region', 'Cebu City and Metro Cebu')
            ->update(['region' => 'Metro Cebu']);

        DB::table('destinations')
            ->whereIn('region', ['North Cebu Islands', 'North Cebu Mainland', 'Camotes and Cross Region Trip'])
            ->update(['region' => 'North Cebu']);

        DB::table('destinations')
            ->whereIn('region', ['South Cebu: Southwest and Highlands', 'South Cebu: Southeast and Southern Trip', 'West Cebu'])
            ->update(['region' => 'South Cebu']);
    }
};
