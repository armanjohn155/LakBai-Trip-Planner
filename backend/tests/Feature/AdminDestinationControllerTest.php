<?php

namespace Tests\Feature;

use App\Models\Destination;
use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class AdminDestinationControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['role' => 'admin']);
    }

    /**
     * @return array<string, mixed>
     */
    private function validPayload(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Kawasan Falls',
            'description' => 'A three-stage cascade of turquoise water.',
            'category' => 'Waterfall',
            'region' => 'South Cebu',
            'municipality' => 'Badian',
            'latitude' => 9.8019444,
            'longitude' => 123.3738889,
            'estimated_cost' => 500,
        ], $overrides);
    }

    public function test_guests_cannot_access_admin_destinations(): void
    {
        $this->getJson('/api/admin/destinations')->assertUnauthorized();
    }

    public function test_non_admin_users_are_forbidden_from_admin_destinations(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->getJson('/api/admin/destinations')
            ->assertForbidden()
            ->assertJsonPath('message', 'This action requires administrator access.');
    }

    public function test_admin_can_list_destinations(): void
    {
        Destination::factory()->count(2)->create();
        Destination::factory()->create(['name' => 'Kawasan Falls']);

        $this->actingAs($this->admin())
            ->getJson('/api/admin/destinations')
            ->assertOk()
            ->assertJsonCount(3, 'data')
            ->assertJsonStructure(['data' => [['id', 'name', 'category', 'region', 'municipality', 'deleted_at']]]);
    }

    public function test_admin_index_searches_by_name_and_municipality(): void
    {
        Destination::factory()->create(['name' => 'Kawasan Falls', 'municipality' => 'Badian']);
        Destination::factory()->create(['name' => 'Oslob Whale Sharks', 'municipality' => 'Oslob']);

        $this->actingAs($this->admin())
            ->getJson('/api/admin/destinations?search=kawasan')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Kawasan Falls');

        $this->actingAs($this->admin())
            ->getJson('/api/admin/destinations?search=oslob')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.municipality', 'Oslob');
    }

    public function test_admin_index_filters_by_category_and_region(): void
    {
        Destination::factory()->create(['name' => 'Kawasan Falls', 'category' => 'Waterfall', 'region' => 'South Cebu']);
        Destination::factory()->create(['name' => 'Bantayan Beach', 'category' => 'Beach', 'region' => 'North Cebu']);

        $this->actingAs($this->admin())
            ->getJson('/api/admin/destinations?category=Waterfall&region=South Cebu')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Kawasan Falls');
    }

    public function test_admin_can_create_a_destination(): void
    {
        $this->actingAs($this->admin())
            ->postJson('/api/admin/destinations', $this->validPayload())
            ->assertCreated()
            ->assertJsonPath('data.name', 'Kawasan Falls')
            ->assertJsonPath('data.municipality', 'Badian');

        $this->assertDatabaseHas('destinations', [
            'name' => 'Kawasan Falls',
            'category' => 'Waterfall',
            'region' => 'South Cebu',
        ]);
    }

    public function test_new_destinations_default_to_zero_rating_and_review_count(): void
    {
        $this->actingAs($this->admin())
            ->postJson('/api/admin/destinations', $this->validPayload())
            ->assertCreated()
            ->assertJsonPath('data.rating', '0.0')
            ->assertJsonPath('data.review_count', 0);
    }

    public function test_admin_cannot_create_a_destination_with_an_invalid_category(): void
    {
        $this->actingAs($this->admin())
            ->postJson('/api/admin/destinations', $this->validPayload(['category' => 'Volcano']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('category');
    }

    public function test_admin_cannot_create_a_destination_with_an_invalid_region(): void
    {
        $this->actingAs($this->admin())
            ->postJson('/api/admin/destinations', $this->validPayload(['region' => 'Palawan']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('region');
    }

    public function test_admin_cannot_create_a_destination_with_out_of_range_coordinates(): void
    {
        $this->actingAs($this->admin())
            ->postJson('/api/admin/destinations', $this->validPayload(['latitude' => 95]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('latitude');

        $this->actingAs($this->admin())
            ->postJson('/api/admin/destinations', $this->validPayload(['longitude' => -200]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('longitude');
    }

    public function test_admin_cannot_create_a_destination_with_a_negative_cost(): void
    {
        $this->actingAs($this->admin())
            ->postJson('/api/admin/destinations', $this->validPayload(['estimated_cost' => -1]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('estimated_cost');
    }

    public function test_admin_cannot_create_a_destination_with_a_duplicate_name(): void
    {
        Destination::factory()->create(['name' => 'Kawasan Falls']);

        $this->actingAs($this->admin())
            ->postJson('/api/admin/destinations', $this->validPayload())
            ->assertUnprocessable()
            ->assertJsonValidationErrors('name');
    }

    public function test_admin_can_update_a_destination_keeping_its_own_name(): void
    {
        $destination = Destination::factory()->create(['name' => 'Kawasan Falls', 'municipality' => 'Badian']);

        $this->actingAs($this->admin())
            ->putJson("/api/admin/destinations/{$destination->id}", [
                'name' => 'Kawasan Falls',
                'estimated_cost' => 750,
                'tips' => 'Go early to avoid crowds.',
            ])
            ->assertOk()
            ->assertJsonPath('data.estimated_cost', '750.00')
            ->assertJsonPath('data.tips', 'Go early to avoid crowds.');

        $this->assertDatabaseHas('destinations', [
            'id' => $destination->id,
            'estimated_cost' => 750,
        ]);
    }

    public function test_admin_cannot_update_a_destination_to_a_duplicate_name(): void
    {
        Destination::factory()->create(['name' => 'Kawasan Falls']);
        $destination = Destination::factory()->create(['name' => 'Tumalog Falls']);

        $this->actingAs($this->admin())
            ->putJson("/api/admin/destinations/{$destination->id}", ['name' => 'Kawasan Falls'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('name');
    }

    public function test_rating_and_review_count_are_ignored_when_sent_by_the_admin(): void
    {
        $response = $this->actingAs($this->admin())
            ->postJson('/api/admin/destinations', $this->validPayload([
                'rating' => 5,
                'review_count' => 99999,
            ]))
            ->assertCreated()
            ->assertJsonPath('data.rating', '0.0')
            ->assertJsonPath('data.review_count', 0);

        $destination = Destination::findOrFail($response->json('data.id'));
        $this->assertSame(0, (int) $destination->review_count);

        $this->actingAs($this->admin())
            ->putJson("/api/admin/destinations/{$destination->id}", [
                'rating' => 1,
                'review_count' => 12345,
            ])
            ->assertOk()
            ->assertJsonPath('data.rating', '0.0')
            ->assertJsonPath('data.review_count', 0);
    }

    public function test_soft_deleted_destinations_are_hidden_from_public_endpoints(): void
    {
        $destination = Destination::factory()->create();
        $admin = $this->admin();

        $this->actingAs($admin)->deleteJson("/api/admin/destinations/{$destination->id}")->assertNoContent();

        $this->assertSoftDeleted('destinations', ['id' => $destination->id]);

        $this->getJson('/api/destinations')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson("/api/destinations/{$destination->id}")->assertNotFound();
    }

    public function test_admin_index_status_filters_include_trashed_destinations(): void
    {
        $active = Destination::factory()->create(['name' => 'Active Spot']);
        $trashed = Destination::factory()->create(['name' => 'Trashed Spot']);
        $admin = $this->admin();

        $this->actingAs($admin)->deleteJson("/api/admin/destinations/{$trashed->id}")->assertNoContent();

        $this->actingAs($admin)
            ->getJson('/api/admin/destinations?status=active')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $active->id);

        $this->actingAs($admin)
            ->getJson('/api/admin/destinations?status=trashed')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $trashed->id);

        $this->actingAs($admin)
            ->getJson('/api/admin/destinations?status=all')
            ->assertOk()
            ->assertJsonCount(2, 'data');
    }

    public function test_admin_can_restore_a_soft_deleted_destination(): void
    {
        $destination = Destination::factory()->create();
        $admin = $this->admin();

        $this->actingAs($admin)->deleteJson("/api/admin/destinations/{$destination->id}")->assertNoContent();

        $this->actingAs($admin)
            ->postJson("/api/admin/destinations/{$destination->id}/restore")
            ->assertOk()
            ->assertJsonPath('data.id', $destination->id);

        $this->assertDatabaseHas('destinations', [
            'id' => $destination->id,
            'deleted_at' => null,
        ]);

        $this->getJson('/api/destinations')->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_force_delete_is_blocked_when_the_destination_is_used_by_an_itinerary_stop(): void
    {
        $user = User::factory()->create();
        $destination = Destination::factory()->create();
        $itinerary = $user->itineraries()->create(['title' => 'Cebu Trip']);
        $itinerary->items()->create(['destination_id' => $destination->id]);

        $this->actingAs($this->admin())
            ->deleteJson("/api/admin/destinations/{$destination->id}/force")
            ->assertUnprocessable();

        $this->assertDatabaseHas('destinations', ['id' => $destination->id]);
    }

    public function test_admin_can_force_delete_an_unreferenced_destination(): void
    {
        $destination = Destination::factory()->create();
        $admin = $this->admin();

        $this->actingAs($admin)->deleteJson("/api/admin/destinations/{$destination->id}")->assertNoContent();

        $this->actingAs($admin)
            ->deleteJson("/api/admin/destinations/{$destination->id}/force")
            ->assertNoContent();

        $this->assertDatabaseMissing('destinations', ['id' => $destination->id]);
    }

    public function test_admin_can_upload_an_image_when_creating_a_destination(): void
    {
        Storage::fake('public');

        $response = $this->actingAs($this->admin())
            ->post('/api/admin/destinations', $this->validPayload([
                'image' => UploadedFile::fake()->image('kawasan.jpg', 640, 480),
            ]))
            ->assertCreated();

        $this->assertStringContainsString('/storage/destinations/kawasan-falls-', $response->json('data.image_url'));
        $this->assertStringStartsWith('http://', $response->json('data.image_url'));
        Storage::disk('public')->assertExists('destinations/'.basename($response->json('data.image_url')));
    }

    public function test_uploading_a_new_image_replaces_the_previous_upload(): void
    {
        Storage::fake('public');
        $admin = $this->admin();

        $created = $this->actingAs($admin)
            ->post('/api/admin/destinations', $this->validPayload([
                'image' => UploadedFile::fake()->image('first.jpg', 640, 480),
            ]))
            ->assertCreated();

        $oldPath = 'destinations/'.basename($created->json('data.image_url'));

        $updated = $this->actingAs($admin)
            ->post("/api/admin/destinations/{$created->json('data.id')}", [
                '_method' => 'put',
                'name' => 'Kawasan Falls',
                'image' => UploadedFile::fake()->image('second.jpg', 640, 480),
            ])
            ->assertOk();

        $newUrl = $updated->json('data.image_url');
        $this->assertStringContainsString('/storage/destinations/kawasan-falls-', $newUrl);
        $this->assertNotSame($created->json('data.image_url'), $newUrl);

        Storage::disk('public')->assertMissing($oldPath);
        Storage::disk('public')->assertExists('destinations/'.basename($newUrl));
    }

    public function test_replacing_a_seeded_static_image_leaves_the_static_file_alone(): void
    {
        Storage::fake('public');
        $destination = Destination::factory()->create([
            'name' => 'Kawasan Falls',
            'image_url' => '/images/destinations/kawasan-falls.jpg',
        ]);

        $this->actingAs($this->admin())
            ->post("/api/admin/destinations/{$destination->id}", [
                '_method' => 'put',
                'tips' => 'Bring a dry bag.',
                'image' => UploadedFile::fake()->image('new.jpg', 640, 480),
            ])
            ->assertOk()
            ->assertJsonPath('data.tips', 'Bring a dry bag.');

        $this->assertStringStartsWith('/storage/destinations/', $destination->fresh()->image_url);
    }

    public function test_admin_image_upload_rejects_invalid_files(): void
    {
        Storage::fake('public');

        $this->actingAs($this->admin())
            ->post('/api/admin/destinations', $this->validPayload([
                'image' => UploadedFile::fake()->create('notes.txt', 10),
            ]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('image');
    }

    public function test_signup_cannot_set_the_admin_role(): void
    {
        $this->postJson('/api/register', [
            'name' => 'Sneaky',
            'email' => 'sneaky@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'role' => 'admin',
        ])->assertCreated();

        $this->assertDatabaseHas('users', [
            'email' => 'sneaky@example.com',
            'role' => 'user',
        ]);
    }

    public function test_itinerary_stops_cannot_reference_a_soft_deleted_destination(): void
    {
        $user = User::factory()->create();
        $destination = Destination::factory()->create();
        $itinerary = $user->itineraries()->create(['title' => 'Cebu Trip']);

        $this->actingAs($this->admin())->deleteJson("/api/admin/destinations/{$destination->id}")->assertNoContent();

        $this->actingAs($user)
            ->postJson("/api/itineraries/{$itinerary->id}/items", ['destination_id' => $destination->id])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('destination_id');
    }

    public function test_itinerary_stops_keep_rendering_after_their_destination_is_soft_deleted(): void
    {
        $user = User::factory()->create();
        $destination = Destination::factory()->create();
        $itinerary = $user->itineraries()->create(['title' => 'Cebu Trip']);
        $itinerary->items()->create(['destination_id' => $destination->id]);

        $this->actingAs($this->admin())->deleteJson("/api/admin/destinations/{$destination->id}")->assertNoContent();

        $this->actingAs($user)
            ->getJson("/api/itineraries/{$itinerary->id}")
            ->assertOk()
            ->assertJsonPath('data.items.0.destination.name', $destination->name)
            ->assertJsonPath('data.items.0.destination.deleted_at', fn ($value) => $value !== null);
    }
}
