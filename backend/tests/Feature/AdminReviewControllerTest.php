<?php

namespace Tests\Feature;

use App\Models\Destination;
use App\Models\Review;
use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Tests\TestCase;

class AdminReviewControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['role' => 'admin']);
    }

    public function test_non_admins_cannot_access_the_moderation_queue(): void
    {
        $this->actingAs(User::factory()->create())
            ->getJson('/api/admin/reviews')
            ->assertForbidden();
    }

    public function test_admin_can_list_all_reviews_including_hidden(): void
    {
        Review::factory()->create();
        Review::factory()->hidden()->create();

        $this->actingAs($this->admin())
            ->getJson('/api/admin/reviews')
            ->assertOk()
            ->assertJsonCount(2, 'data');
    }

    public function test_admin_can_filter_reported_reviews(): void
    {
        $reported = Review::factory()->create();
        Review::factory()->create();
        $reported->reports()->create(['user_id' => User::factory()->create()->id, 'reason' => 'spam']);

        $this->actingAs($this->admin())
            ->getJson('/api/admin/reviews?status=reported')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $reported->id);
    }

    public function test_admin_can_hide_and_unhide_a_review(): void
    {
        $review = Review::factory()->create();

        $this->actingAs($this->admin())
            ->postJson("/api/admin/reviews/{$review->id}/hide", ['reason' => 'Abusive language.'])
            ->assertOk()
            ->assertJsonPath('data.is_hidden', true);

        $this->assertDatabaseHas('reviews', ['id' => $review->id, 'is_hidden' => true]);

        $this->actingAs($this->admin())
            ->postJson("/api/admin/reviews/{$review->id}/unhide")
            ->assertOk()
            ->assertJsonPath('data.is_hidden', false);
    }

    public function test_hiding_a_review_recalculates_destination_stats(): void
    {
        $destination = Destination::factory()->create([
            'base_rating' => 0,
            'base_review_count' => 0,
            'rating' => 0,
            'review_count' => 0,
        ]);
        $review = Review::factory()->create(['destination_id' => $destination->id]);

        $destination->refresh();
        $this->assertSame(1, $destination->review_count);

        $this->actingAs($this->admin())
            ->postJson("/api/admin/reviews/{$review->id}/hide")
            ->assertOk();

        $destination->refresh();
        $this->assertSame(0, $destination->review_count);
    }

    public function test_admin_can_permanently_delete_a_review(): void
    {
        $review = Review::factory()->create();

        $this->actingAs($this->admin())
            ->deleteJson("/api/admin/reviews/{$review->id}")
            ->assertNoContent();

        $this->assertDatabaseMissing('reviews', ['id' => $review->id]);
    }
}
