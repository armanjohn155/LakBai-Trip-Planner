<?php

namespace Tests\Feature;

use App\Models\Itinerary;
use App\Models\ItineraryItem;
use App\Models\User;
use App\Policies\ItineraryItemPolicy;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Tests\TestCase;

class ItineraryItemPolicyTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_owner_can_view_update_and_delete_item(): void
    {
        $user = User::factory()->create();
        $itinerary = Itinerary::factory()->for($user)->create();
        $item = ItineraryItem::factory()->recycle($itinerary)->create();
        $policy = new ItineraryItemPolicy;

        $this->assertTrue($policy->view($user, $item));
        $this->assertTrue($policy->update($user, $item));
        $this->assertTrue($policy->delete($user, $item));
    }

    public function test_other_user_cannot_view_update_or_delete_item(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $itinerary = Itinerary::factory()->for($owner)->create();
        $item = ItineraryItem::factory()->recycle($itinerary)->create();
        $policy = new ItineraryItemPolicy;

        $this->assertFalse($policy->view($other, $item));
        $this->assertFalse($policy->update($other, $item));
        $this->assertFalse($policy->delete($other, $item));
    }

    public function test_any_authenticated_user_can_create(): void
    {
        $user = User::factory()->create();

        $this->assertTrue((new ItineraryItemPolicy)->create($user));
    }
}
