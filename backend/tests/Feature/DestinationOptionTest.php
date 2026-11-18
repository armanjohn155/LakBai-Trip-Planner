<?php

namespace Tests\Feature;

use App\Models\Destination;
use App\Models\DestinationCategory;
use App\Models\DestinationRegion;
use App\Models\ItineraryItem;
use App\Models\User;
use App\Services\DestinationOptionService;
use Database\Seeders\DestinationOptionSeeder;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class DestinationOptionTest extends TestCase
{
    use LazilyRefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['role' => 'admin']);
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function destinationPayload(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Kawasan Falls',
            'description' => 'A three-stage cascade of turquoise water.',
            'category' => 'Waterfall',
            'region' => 'South Cebu: Southwest and Highlands',
            'municipality' => 'Badian',
            'latitude' => 9.8019444,
            'longitude' => 123.3738889,
            'estimated_cost' => '500',
        ], $overrides);
    }

    public function test_options_are_seeded_from_constants_and_existing_destination_values(): void
    {
        $this->assertDatabaseHas('destination_categories', ['name' => 'Beach', 'is_system' => true]);
        $this->assertDatabaseHas('destination_regions', [
            'name' => 'South Cebu: Southwest and Highlands',
            'is_system' => true,
        ]);

        Destination::factory()->create([
            'category' => 'Hot Springs',
            'region' => 'Ilocos Norte',
        ]);

        $this->seed(DestinationOptionSeeder::class);

        $this->assertDatabaseHas('destination_categories', ['name' => 'Hot Springs', 'is_system' => false]);
        $this->assertDatabaseHas('destination_regions', ['name' => 'Ilocos Norte', 'is_system' => false]);
    }

    public function test_public_endpoint_returns_active_options_only_and_invalidates_its_cache(): void
    {
        $category = DestinationCategory::query()->where('name', 'Beach')->firstOrFail();

        $response = $this->getJson('/api/destination-options')->assertOk();
        $response->assertJsonFragment(['name' => 'Beach']);

        // Bypassing the service keeps the cached payload stale.
        $category->forceFill(['is_active' => false])->save();

        $this->getJson('/api/destination-options')
            ->assertOk()
            ->assertJsonFragment(['name' => 'Beach']);

        app(DestinationOptionService::class)->forget();

        $this->getJson('/api/destination-options')
            ->assertOk()
            ->assertJsonMissing(['name' => 'Beach']);

        $this->actingAs($this->admin())
            ->postJson('/api/admin/categories', ['name' => 'Hot Springs'])
            ->assertCreated();

        $this->getJson('/api/destination-options')
            ->assertOk()
            ->assertJsonFragment(['name' => 'Hot Springs']);
    }

    public function test_guests_and_non_admins_cannot_manage_options(): void
    {
        $this->getJson('/api/admin/categories')->assertUnauthorized();

        $this->actingAs(User::factory()->create())
            ->getJson('/api/admin/regions')
            ->assertForbidden();
    }

    public function test_create_normalizes_names_and_rejects_case_insensitive_duplicates(): void
    {
        $admin = $this->admin();

        $this->actingAs($admin)
            ->postJson('/api/admin/categories', ['name' => '  Hot   <b>Springs</b> ', 'is_system' => true])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Hot Springs')
            ->assertJsonPath('data.slug', 'hot-springs')
            ->assertJsonPath('data.is_system', false);

        $this->actingAs($admin)
            ->postJson('/api/admin/categories', ['name' => 'hot springs'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('name');

        $this->actingAs($admin)
            ->postJson('/api/admin/categories', ['name' => 'beach'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('name');

        DestinationCategory::query()->create([
            'name' => 'Old Trail',
            'slug' => 'old-trail',
            'sort_order' => 99,
            'is_active' => false,
        ]);

        $this->actingAs($admin)
            ->postJson('/api/admin/categories', ['name' => 'OLD TRAIL'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('name');
    }

    public function test_destinations_require_an_active_category_and_region(): void
    {
        $admin = $this->admin();

        $this->actingAs($admin)
            ->postJson('/api/admin/destinations', $this->destinationPayload(['category' => 'Unknown']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('category');

        DestinationCategory::query()->create([
            'name' => 'Closed Trail',
            'slug' => 'closed-trail',
            'sort_order' => 100,
            'is_active' => false,
        ]);

        $this->actingAs($admin)
            ->postJson('/api/admin/destinations', $this->destinationPayload(['category' => 'Closed Trail']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('category');

        $this->actingAs($admin)
            ->postJson('/api/admin/destinations', $this->destinationPayload())
            ->assertCreated();
    }

    public function test_hidden_option_keeps_existing_destinations_saveable(): void
    {
        $admin = $this->admin();
        $category = DestinationCategory::query()->where('name', 'Beach')->firstOrFail();
        $destination = Destination::factory()->create(['category' => 'Beach']);

        $this->actingAs($admin)
            ->putJson("/api/admin/categories/{$category->id}", ['is_active' => false])
            ->assertOk()
            ->assertJsonPath('data.is_active', false);

        $this->actingAs($admin)
            ->putJson("/api/admin/destinations/{$destination->id}", ['name' => 'Renamed Beach'])
            ->assertOk();

        $this->actingAs($admin)
            ->putJson("/api/admin/destinations/{$destination->id}", ['category' => 'Waterfall'])
            ->assertOk();

        $this->actingAs($admin)
            ->putJson("/api/admin/destinations/{$destination->id}", ['category' => 'Beach'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('category');
    }

    public function test_rename_cascades_to_destinations_and_itinerary_items(): void
    {
        $destination = Destination::factory()->create(['category' => 'Beach']);
        $item = ItineraryItem::factory()->custom()->create(['category' => 'Beach']);

        $category = DestinationCategory::query()->where('name', 'Beach')->firstOrFail();

        $this->actingAs($this->admin())
            ->putJson("/api/admin/categories/{$category->id}", ['name' => 'Beaches'])
            ->assertOk()
            ->assertJsonPath('data.name', 'Beaches');

        $this->assertSame('Beaches', $destination->fresh()->category);
        $this->assertSame('Beaches', $item->fresh()->category);
    }

    public function test_delete_is_blocked_in_use_and_reassigns_when_requested(): void
    {
        $admin = $this->admin();
        $category = DestinationCategory::query()->create([
            'name' => 'Beach Camp',
            'slug' => 'beach-camp',
            'sort_order' => 120,
            'is_active' => true,
        ]);
        $destination = Destination::factory()->create(['category' => 'Beach Camp']);

        $this->actingAs($admin)
            ->deleteJson("/api/admin/categories/{$category->id}")
            ->assertUnprocessable()
            ->assertJsonPath('destinations_count', 1);

        $target = $this->actingAs($admin)
            ->postJson('/api/admin/categories', ['name' => 'Beaches'])
            ->assertCreated()
            ->json('data');

        $this->actingAs($admin)
            ->deleteJson("/api/admin/categories/{$category->id}?reassign_to={$target['id']}")
            ->assertOk();

        $this->assertSame('Beaches', $destination->fresh()->category);
        $this->assertDatabaseMissing('destination_categories', ['id' => $category->id]);
    }

    public function test_system_options_cannot_be_deleted(): void
    {
        $category = DestinationCategory::query()->where('name', 'Waterfall')->firstOrFail();

        $this->actingAs($this->admin())
            ->deleteJson("/api/admin/categories/{$category->id}")
            ->assertUnprocessable()
            ->assertJsonPath('message', 'System options can be hidden but not deleted.');

        $this->assertDatabaseHas('destination_categories', ['id' => $category->id]);
    }

    public function test_reorder_persists(): void
    {
        $admin = $this->admin();
        $categories = DestinationCategory::query()->orderBy('id')->take(3)->get();

        $items = $categories->values()->map(fn (DestinationCategory $category, int $index): array => [
            'id' => $category->id,
            'sort_order' => 10 - $index,
        ])->all();

        $this->actingAs($admin)
            ->putJson('/api/admin/categories/reorder', ['items' => $items])
            ->assertOk();

        foreach ($items as $item) {
            $this->assertDatabaseHas('destination_categories', [
                'id' => $item['id'],
                'sort_order' => $item['sort_order'],
            ]);
        }
    }

    public function test_admin_list_avoids_n_plus_one_queries(): void
    {
        foreach (range(1, 10) as $index) {
            DestinationCategory::query()->create([
                'name' => "Extra {$index}",
                'slug' => "extra-{$index}",
                'sort_order' => 100 + $index,
                'is_active' => true,
            ]);
        }

        DB::flushQueryLog();
        DB::enableQueryLog();

        $this->actingAs($this->admin())
            ->getJson('/api/admin/categories')
            ->assertOk()
            ->assertJsonCount(DestinationCategory::query()->count(), 'data');

        $queryCount = count(DB::getQueryLog());
        DB::disableQueryLog();

        $this->assertLessThan(15, $queryCount, "Expected the option list to avoid N+1 queries, got {$queryCount}.");
    }

    public function test_region_rename_cascades(): void
    {
        $destination = Destination::factory()->create(['region' => 'West Cebu']);
        $region = DestinationRegion::query()->where('name', 'West Cebu')->firstOrFail();

        $this->actingAs($this->admin())
            ->putJson("/api/admin/regions/{$region->id}", ['name' => 'Western Cebu'])
            ->assertOk();

        $this->assertSame('Western Cebu', $destination->fresh()->region);
    }
}
