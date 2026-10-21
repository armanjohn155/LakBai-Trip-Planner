<?php

namespace Tests\Feature;

use App\Models\Destination;
use App\Models\Review;
use App\Models\User;
use App\Models\Visit;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Tests\TestCase;

class ReviewControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    private function verifiedVisitor(Destination $destination): User
    {
        $user = User::factory()->create();

        Visit::factory()->verified()->create([
            'user_id' => $user->id,
            'destination_id' => $destination->id,
        ]);

        return $user;
    }

    public function test_guests_cannot_create_reviews(): void
    {
        $destination = Destination::factory()->create();

        $this->postJson("/api/destinations/{$destination->id}/reviews", [
            'rating' => 5,
            'body' => 'A genuinely wonderful place to spend the afternoon.',
        ])->assertUnauthorized();
    }

    public function test_user_without_a_visit_cannot_review(): void
    {
        $user = User::factory()->create();
        $destination = Destination::factory()->create();

        $this->actingAs($user)
            ->postJson("/api/destinations/{$destination->id}/reviews", [
                'rating' => 5,
                'body' => 'A genuinely wonderful place to spend the afternoon.',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('destination');
    }

    public function test_manual_visits_do_not_qualify_for_reviews(): void
    {
        $user = User::factory()->create();
        $destination = Destination::factory()->create();

        Visit::factory()->create([
            'user_id' => $user->id,
            'destination_id' => $destination->id,
            'verified' => false,
        ]);

        $this->actingAs($user)
            ->postJson("/api/destinations/{$destination->id}/reviews", [
                'rating' => 4,
                'body' => 'I was here last summer, quite a nice place.',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('destination');
    }

    public function test_verified_visitor_can_create_a_review(): void
    {
        $destination = Destination::factory()->create();
        $user = $this->verifiedVisitor($destination);

        $this->actingAs($user)
            ->postJson("/api/destinations/{$destination->id}/reviews", [
                'rating' => 5,
                'title' => 'Worth the trip',
                'body' => 'A genuinely wonderful place to spend the afternoon.',
            ])
            ->assertCreated()
            ->assertJsonPath('data.rating', 5)
            ->assertJsonPath('data.author.id', $user->id);

        $this->assertDatabaseHas('reviews', [
            'user_id' => $user->id,
            'destination_id' => $destination->id,
        ]);
    }

    public function test_a_user_cannot_review_the_same_destination_twice(): void
    {
        $destination = Destination::factory()->create();
        $user = $this->verifiedVisitor($destination);

        $this->actingAs($user)->postJson("/api/destinations/{$destination->id}/reviews", [
            'rating' => 5,
            'body' => 'A genuinely wonderful place to spend the afternoon.',
        ])->assertCreated();

        $this->actingAs($user)->postJson("/api/destinations/{$destination->id}/reviews", [
            'rating' => 3,
            'body' => 'Second thoughts after another visit, honestly.',
        ])->assertOk();

        $this->assertSame(1, Review::where('destination_id', $destination->id)->count());
    }

    public function test_review_body_strips_html(): void
    {
        $destination = Destination::factory()->create();
        $user = $this->verifiedVisitor($destination);

        $this->actingAs($user)
            ->postJson("/api/destinations/{$destination->id}/reviews", [
                'rating' => 4,
                'body' => '<script>alert(1)</script>A very nice place to visit indeed.',
            ])
            ->assertCreated();

        $review = Review::first();
        $this->assertStringNotContainsString('<script>', $review->body);
    }

    public function test_flagged_words_hide_the_review(): void
    {
        config(['lakbai.banned_words' => ['scam']]);

        $destination = Destination::factory()->create();
        $user = $this->verifiedVisitor($destination);

        $this->actingAs($user)
            ->postJson("/api/destinations/{$destination->id}/reviews", [
                'rating' => 1,
                'body' => 'Total scam, do not visit this place ever again.',
            ])
            ->assertCreated()
            ->assertJsonPath('data.is_hidden', true);
    }

    public function test_public_listing_excludes_hidden_reviews(): void
    {
        $destination = Destination::factory()->create();
        Review::factory()->create(['destination_id' => $destination->id]);
        Review::factory()->hidden()->create(['destination_id' => $destination->id]);

        $this->getJson("/api/destinations/{$destination->id}/reviews")
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_review_resource_never_exposes_email(): void
    {
        $destination = Destination::factory()->create();
        Review::factory()->create(['destination_id' => $destination->id]);

        $this->getJson("/api/destinations/{$destination->id}/reviews")
            ->assertOk()
            ->assertJsonMissingPath('data.0.author.email');
    }

    public function test_author_can_update_and_delete_their_review(): void
    {
        $destination = Destination::factory()->create();
        $user = $this->verifiedVisitor($destination);

        $this->actingAs($user)->postJson("/api/destinations/{$destination->id}/reviews", [
            'rating' => 5,
            'body' => 'A genuinely wonderful place to spend the afternoon.',
        ])->assertCreated();

        $review = Review::first();

        $this->actingAs($user)
            ->putJson("/api/reviews/{$review->id}", ['rating' => 2])
            ->assertOk()
            ->assertJsonPath('data.rating', 2);

        $this->actingAs($user)
            ->deleteJson("/api/reviews/{$review->id}")
            ->assertNoContent();

        $this->assertSoftDeleted('reviews', ['id' => $review->id]);
    }

    public function test_other_users_cannot_update_someone_elses_review(): void
    {
        $destination = Destination::factory()->create();
        $review = Review::factory()->create(['destination_id' => $destination->id]);
        $other = User::factory()->create();

        $this->actingAs($other)
            ->putJson("/api/reviews/{$review->id}", ['rating' => 1])
            ->assertForbidden();
    }

    public function test_review_stats_blend_baseline_and_lakbai_ratings(): void
    {
        $destination = Destination::factory()->create([
            'base_rating' => 4.8,
            'base_review_count' => 1000,
            'rating' => 4.8,
            'review_count' => 1000,
        ]);

        $user = $this->verifiedVisitor($destination);

        $this->actingAs($user)->postJson("/api/destinations/{$destination->id}/reviews", [
            'rating' => 1,
            'body' => 'A genuinely wonderful place to spend the afternoon.',
        ])->assertCreated();

        $destination->refresh();

        $this->assertSame(1001, $destination->review_count);
        $this->assertSame(1, $destination->lakbai_review_count);
        // A single bad review must not tank a well-reviewed destination.
        $this->assertEqualsWithDelta(4.8, (float) $destination->rating, 0.1);
    }

    public function test_user_can_report_a_review_once(): void
    {
        $destination = Destination::factory()->create();
        $review = Review::factory()->create(['destination_id' => $destination->id]);
        $reporter = User::factory()->create();

        $this->actingAs($reporter)
            ->postJson("/api/reviews/{$review->id}/report", ['reason' => 'spam'])
            ->assertCreated();

        $this->actingAs($reporter)
            ->postJson("/api/reviews/{$review->id}/report", ['reason' => 'spam'])
            ->assertForbidden();
    }

    public function test_my_reviews_lists_only_the_users_own(): void
    {
        $user = User::factory()->create();
        Review::factory()->count(2)->create(['user_id' => $user->id]);
        Review::factory()->create();

        $this->actingAs($user)
            ->getJson('/api/reviews/mine')
            ->assertOk()
            ->assertJsonCount(2, 'data');
    }
}
