<?php

namespace Tests\Feature;

use App\Models\Itinerary;
use App\Models\User;
use App\Policies\ItineraryPolicy;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Tests\TestCase;

class ItineraryPolicyTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_owner_can_view_update_and_delete_their_itinerary(): void
    {
        $user = User::factory()->create();
        $itinerary = Itinerary::factory()->for($user)->create();
        $policy = new ItineraryPolicy;

        $this->assertTrue($policy->view($user, $itinerary));
        $this->assertTrue($policy->update($user, $itinerary));
        $this->assertTrue($policy->delete($user, $itinerary));
    }

    public function test_other_user_cannot_view_update_or_delete_itinerary(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $itinerary = Itinerary::factory()->for($owner)->create();
        $policy = new ItineraryPolicy;

        $this->assertFalse($policy->view($other, $itinerary));
        $this->assertFalse($policy->update($other, $itinerary));
        $this->assertFalse($policy->delete($other, $itinerary));
    }

    public function test_any_authenticated_user_can_create(): void
    {
        $user = User::factory()->create();

        $this->assertTrue((new ItineraryPolicy)->create($user));
    }
}
