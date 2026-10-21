<?php

namespace Tests\Feature;

use App\Models\Destination;
use App\Models\Itinerary;
use App\Models\ItineraryItem;
use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Tests\TestCase;

class ItineraryExportTest extends TestCase
{
    use LazilyRefreshDatabase;

    private function itineraryWithStops(User $user): Itinerary
    {
        $itinerary = Itinerary::factory()->for($user)->create([
            'title' => 'Cebu Adventure',
            'start_date' => '2026-11-01',
            'end_date' => '2026-11-03',
        ]);

        $destination = Destination::factory()->create([
            'name' => 'Kawasan Falls',
            'category' => 'Nature',
            'latitude' => 9.8123,
            'longitude' => 123.3456,
        ]);

        ItineraryItem::factory()->recycle($itinerary)->create([
            'destination_id' => $destination->id,
            'day_number' => 1,
            'order' => 1,
            'start_time' => '08:00',
            'duration_minutes' => 120,
            'estimated_budget' => 500,
            'notes' => 'Bring sunscreen',
        ]);

        ItineraryItem::factory()->recycle($itinerary)->custom()->create([
            'custom_title' => 'Lunch stop',
            'custom_latitude' => 10.3157,
            'custom_longitude' => 123.8854,
            'day_number' => 1,
            'order' => 2,
            'start_time' => '12:00',
            'duration_minutes' => 60,
        ]);

        return $itinerary;
    }

    public function test_exports_pdf(): void
    {
        $user = User::factory()->create();
        $itinerary = $this->itineraryWithStops($user);

        $response = $this->actingAs($user)
            ->get("/api/itineraries/{$itinerary->id}/export?format=pdf");

        $response->assertOk();
        $this->assertStringContainsString('application/pdf', $response->headers->get('Content-Type'));
        $this->assertStringContainsString('attachment', $response->headers->get('Content-Disposition'));
        $this->assertStringContainsString('.pdf', $response->headers->get('Content-Disposition'));
        $this->assertStringStartsWith('%PDF', $response->getContent());
    }

    public function test_exports_ics_with_events_timezone_and_uids(): void
    {
        $user = User::factory()->create();
        $itinerary = $this->itineraryWithStops($user);

        $response = $this->actingAs($user)
            ->get("/api/itineraries/{$itinerary->id}/export?format=ics");

        $response->assertOk();
        $this->assertStringContainsString('text/calendar', $response->headers->get('Content-Type'));

        $body = $response->getContent();

        $this->assertStringContainsString('BEGIN:VCALENDAR', $body);
        $this->assertStringContainsString('END:VCALENDAR', $body);
        $this->assertStringContainsString('TZID:Asia/Manila', $body);
        $this->assertSame(2, substr_count($body, 'BEGIN:VEVENT'));
        $this->assertSame(2, substr_count($body, 'END:VEVENT'));
        $this->assertStringContainsString('UID:lakbai-stop-', $body);
    }

    public function test_ics_requires_a_start_date(): void
    {
        $user = User::factory()->create();
        $itinerary = Itinerary::factory()->for($user)->create([
            'start_date' => null,
            'end_date' => null,
        ]);
        ItineraryItem::factory()->recycle($itinerary)->create();

        $this->actingAs($user)
            ->getJson("/api/itineraries/{$itinerary->id}/export?format=ics")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('start_date');
    }

    public function test_exports_valid_gpx(): void
    {
        $user = User::factory()->create();
        $itinerary = $this->itineraryWithStops($user);

        $response = $this->actingAs($user)
            ->get("/api/itineraries/{$itinerary->id}/export?format=gpx");

        $response->assertOk();
        $this->assertStringContainsString('application/gpx+xml', $response->headers->get('Content-Type'));

        $body = $response->getContent();

        $document = new \DOMDocument;
        $this->assertTrue($document->loadXML($body), 'GPX output must be well-formed XML');
        $this->assertSame('gpx', $document->documentElement->localName);
        $this->assertSame(2, $document->getElementsByTagName('wpt')->length);
        $this->assertSame(1, $document->getElementsByTagName('rte')->length);
        $this->assertSame(2, $document->getElementsByTagName('rtept')->length);
    }

    public function test_export_rejects_empty_itinerary(): void
    {
        $user = User::factory()->create();
        $itinerary = Itinerary::factory()->for($user)->create();

        $this->actingAs($user)
            ->getJson("/api/itineraries/{$itinerary->id}/export?format=pdf")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('itinerary');
    }

    public function test_export_rejects_unsupported_format(): void
    {
        $user = User::factory()->create();
        $itinerary = $this->itineraryWithStops($user);

        $this->actingAs($user)
            ->getJson("/api/itineraries/{$itinerary->id}/export?format=docx")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('format');
    }

    public function test_export_requires_authentication_and_ownership(): void
    {
        $owner = User::factory()->create();
        $itinerary = $this->itineraryWithStops($owner);

        $this->getJson("/api/itineraries/{$itinerary->id}/export?format=pdf")->assertUnauthorized();

        $other = User::factory()->create();
        $this->actingAs($other)
            ->get("/api/itineraries/{$itinerary->id}/export?format=pdf")
            ->assertNotFound();
    }
}
