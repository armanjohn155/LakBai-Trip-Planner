<?php

namespace App\Services;

use App\Models\Destination;
use App\Models\DestinationCategory;
use App\Models\DestinationRegion;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Single source of truth for the admin-managed destination category and region
 * option lists.
 */
class DestinationOptionService
{
    public const CACHE_KEY = 'destination-options:v1';

    public const CACHE_TTL_SECONDS = 600;

    public const CATEGORY = 'category';

    public const REGION = 'region';

    /**
     * Icon keys available to categories. These mirror the inline SVG icon set in
     * the frontend (frontend/src/components/icons.tsx).
     *
     * @var list<string>
     */
    public const ICONS = [
        'pin',
        'crosshair',
        'star',
        'heart',
        'grid',
        'list',
        'sliders',
        'plus',
        'arrow-left',
        'check',
        'calendar',
        'ticket',
        'clock',
        'share',
        'copy',
        'download',
        'map',
        'expand',
        'user',
        'friends',
        'shield',
        'camera',
        'search',
        'layers',
        'route',
        'pencil',
        'car',
        'more',
    ];

    /**
     * The public option payload. Active options only, ordered for display.
     *
     * @return array{categories: list<array{name: string, slug: string, icon: string|null, color: string|null}>, regions: list<array{name: string, slug: string}>}
     */
    public function options(): array
    {
        return Cache::remember(self::CACHE_KEY, self::CACHE_TTL_SECONDS, function (): array {
            return [
                'categories' => DestinationCategory::query()
                    ->where('is_active', true)
                    ->ordered()
                    ->get(['name', 'slug', 'icon', 'color'])
                    ->map(fn (DestinationCategory $category): array => [
                        'name' => $category->name,
                        'slug' => $category->slug,
                        'icon' => $category->icon,
                        'color' => $category->color,
                    ])
                    ->all(),
                'regions' => DestinationRegion::query()
                    ->where('is_active', true)
                    ->ordered()
                    ->get(['name', 'slug'])
                    ->map(fn (DestinationRegion $region): array => [
                        'name' => $region->name,
                        'slug' => $region->slug,
                    ])
                    ->all(),
            ];
        });
    }

    public function forget(): void
    {
        Cache::forget(self::CACHE_KEY);
    }

    /**
     * @return list<string>
     */
    public function activeNames(string $type): array
    {
        $key = $type === self::CATEGORY ? 'categories' : 'regions';

        return array_column($this->options()[$key], 'name');
    }

    /**
     * Find the stored casing for an option name, including hidden options so a
     * destination can keep its existing value while it is being edited.
     */
    public function canonicalName(string $type, string $name): ?string
    {
        $option = $this->modelFor($type)::query()
            ->whereRaw('LOWER(name) = ?', [Str::lower($name)])
            ->first();

        return $option?->name;
    }

    public function normalizeName(string $name): string
    {
        $name = strip_tags($name);
        $name = preg_replace('/\s+/u', ' ', $name) ?? '';

        return trim($name);
    }

    public function uniqueSlug(string $type, string $name, ?int $ignoreId = null): string
    {
        $model = $this->modelFor($type);
        $base = Str::slug($name);

        if ($base === '') {
            $base = $type;
        }

        $base = Str::limit($base, 100, '');
        $slug = $base;
        $counter = 2;

        while ($model::query()
            ->where('slug', $slug)
            ->when($ignoreId !== null, fn ($query) => $query->whereKeyNot($ignoreId))
            ->exists()) {
            $slug = $base.'-'.$counter;
            $counter++;
        }

        return $slug;
    }

    /**
     * @return class-string<Model>
     */
    public function modelFor(string $type): string
    {
        return $type === self::CATEGORY ? DestinationCategory::class : DestinationRegion::class;
    }

    /**
     * Seed the built-in constants plus every value already stored on a
     * destination. Safe to run repeatedly: rows are matched case-insensitively
     * by name and created only when missing.
     */
    public function seedDefaults(): void
    {
        $defaults = [
            self::CATEGORY => Destination::CATEGORIES,
            self::REGION => Destination::REGIONS,
        ];

        foreach ($defaults as $type => $builtInNames) {
            $model = $this->modelFor($type);
            $column = $type === self::CATEGORY ? 'category' : 'region';

            $existingValues = DB::table('destinations')
                ->select($column)
                ->whereNotNull($column)
                ->distinct()
                ->pluck($column)
                ->map(fn (mixed $value): string => $this->normalizeName((string) $value))
                ->filter()
                ->values();

            $names = collect($builtInNames)
                ->map(fn (string $name): string => $this->normalizeName($name))
                ->concat($existingValues)
                ->filter()
                ->unique(fn (string $name): string => Str::lower($name))
                ->values();

            $builtInLookup = array_map(fn (string $name): string => Str::lower($name), $builtInNames);
            $sortOrder = (int) $model::query()->max('sort_order');

            foreach ($names as $name) {
                $lower = Str::lower($name);
                $existing = $model::query()->whereRaw('LOWER(name) = ?', [$lower])->first();

                if ($existing !== null) {
                    if (in_array($lower, $builtInLookup, true) && ! $existing->is_system) {
                        $existing->forceFill(['is_system' => true])->save();
                    }

                    continue;
                }

                $sortOrder++;

                $model::query()->create([
                    'name' => $name,
                    'slug' => $this->uniqueSlug($type, $name),
                    'sort_order' => $sortOrder,
                    'is_active' => true,
                    'is_system' => in_array($lower, $builtInLookup, true),
                ]);
            }
        }

        $this->forget();
    }
}
