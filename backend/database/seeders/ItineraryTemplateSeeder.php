<?php

namespace Database\Seeders;

use App\Models\Destination;
use App\Models\Itinerary;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class ItineraryTemplateSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed admin-curated itinerary templates from existing destinations.
     *
     * Idempotent: templates are keyed by `template_key`, and destination names
     * that cannot be resolved are skipped rather than aborting the seed.
     */
    public function run(): void
    {
        $owner = User::query()->where('role', 'admin')->first()
            ?? User::query()->first();

        if ($owner === null) {
            $this->command?->warn('No user found for itinerary templates; skipping.');

            return;
        }

        foreach ($this->templates() as $template) {
            $itinerary = Itinerary::firstOrNew(['template_key' => $template['key']]);

            $itinerary->forceFill([
                'user_id' => $owner->id,
                'title' => $template['title'],
                'description' => $template['description'],
                'cover_image_url' => $template['cover_image_url'] ?? null,
                'budget' => $template['budget'] ?? null,
                'is_template' => true,
            ]);
            $itinerary->save();

            // Rebuild stops so re-running the seeder is deterministic.
            $itinerary->items()->delete();

            $orderByDay = [];

            foreach ($template['stops'] as $stop) {
                $destination = Destination::query()->where('name', $stop['destination'])->first();

                if ($destination === null) {
                    $this->command?->warn("Skipping '{$stop['destination']}': destination not found.");

                    continue;
                }

                $day = $stop['day'];
                $orderByDay[$day] = ($orderByDay[$day] ?? 0) + 1;

                $itinerary->items()->create([
                    'destination_id' => $destination->id,
                    'day_number' => $day,
                    'order' => $orderByDay[$day],
                    'start_time' => $stop['start_time'] ?? null,
                    'duration_minutes' => $stop['duration_minutes'] ?? null,
                    'estimated_budget' => $destination->estimated_cost,
                    'notes' => $stop['notes'] ?? null,
                    'status' => 'planned',
                    'visited' => false,
                ]);
            }

            $this->command?->info("Itinerary template ready: {$template['title']}");
        }
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function templates(): array
    {
        return [
            [
                'key' => 'south-cebu-waterfalls-beaches-3-day',
                'title' => '3-Day South Cebu: Waterfalls & Beaches',
                'description' => 'A classic southern loop pairing canyoneering at Kawasan with Oslob whale sharks, Moalboal sardines and a Sumilon sandbar finale. Ideal for first-timers.',
                'cover_image_url' => '/images/destinations/kawasan-falls.jpg',
                'budget' => 12000,
                'stops' => [
                    ['destination' => 'Canyoneering at Badian', 'day' => 1, 'start_time' => '07:00', 'duration_minutes' => 300, 'notes' => 'Book a guided run; starts early to beat the crowds.'],
                    ['destination' => 'Kawasan Falls', 'day' => 1, 'start_time' => '12:30', 'duration_minutes' => 180, 'notes' => 'The canyoneering finish point — swim and relax.'],
                    ['destination' => 'Oslob Whale Sharks (Tan-awan)', 'day' => 2, 'start_time' => '06:00', 'duration_minutes' => 120, 'notes' => 'Arrive before 7 AM; no sunscreen before entering the water.'],
                    ['destination' => 'Tumalog Falls', 'day' => 2, 'start_time' => '09:00', 'duration_minutes' => 120, 'notes' => 'Short detour from the whale shark briefing area.'],
                    ['destination' => 'Moalboal (Sardine Run & Pescador Island)', 'day' => 3, 'start_time' => '08:00', 'duration_minutes' => 240, 'notes' => 'Snorkel the sardine run straight off Panagsama Beach.'],
                    ['destination' => 'Sumilon Island', 'day' => 3, 'start_time' => '14:00', 'duration_minutes' => 180, 'notes' => 'Sandbar day trip; book ahead in peak season.'],
                ],
            ],
            [
                'key' => 'metro-cebu-heritage-food-2-day',
                'title' => '2-Day Metro Cebu: Heritage & Food',
                'description' => 'A compact city break covering Cebu\'s colonial landmarks, hilltop views and the island\'s most famous lechon — light on travel, heavy on flavour.',
                'cover_image_url' => '/images/destinations/basilica-del-santo-nino.jpg',
                'budget' => 4000,
                'stops' => [
                    ['destination' => 'Basilica del Santo Niño', 'day' => 1, 'start_time' => '08:00', 'duration_minutes' => 90, 'notes' => 'Dress modestly; it is an active place of worship.'],
                    ['destination' => 'Magellan\'s Cross', 'day' => 1, 'start_time' => '09:45', 'duration_minutes' => 45, 'notes' => 'Right beside the Basilica.'],
                    ['destination' => 'Fort San Pedro', 'day' => 1, 'start_time' => '10:45', 'duration_minutes' => 90, 'notes' => 'Then stroll Plaza Independencia.'],
                    ['destination' => 'Cebu Lechon (Zubuchon)', 'day' => 1, 'start_time' => '12:30', 'duration_minutes' => 90, 'notes' => 'Go at lunch when freshly roasted.'],
                    ['destination' => 'Temple of Leah', 'day' => 2, 'start_time' => '09:00', 'duration_minutes' => 120, 'notes' => 'Hilltop temple with panoramic city views.'],
                    ['destination' => 'Sirao Flower Garden', 'day' => 2, 'start_time' => '11:30', 'duration_minutes' => 120, 'notes' => 'Pair with Temple of Leah in the same morning.'],
                    ['destination' => 'Carbon Market', 'day' => 2, 'start_time' => '15:00', 'duration_minutes' => 90, 'notes' => 'Street food and souvenirs; keep valuables close.'],
                ],
            ],
            [
                'key' => 'north-cebu-island-hop-3-day',
                'title' => '3-Day North Cebu Island Hop',
                'description' => 'Slow island-hopping through Bantayan, Malapascua and Camotes — white sand, sandbars and thresher sharks for divers.',
                'cover_image_url' => '/images/destinations/bantayan-island.jpg',
                'budget' => 15000,
                'stops' => [
                    ['destination' => 'Bantayan Island', 'day' => 1, 'start_time' => '10:00', 'duration_minutes' => 360, 'notes' => 'Ferry from Hagnaya Port; book tickets ahead in peak season.'],
                    ['destination' => 'Malapascua Island', 'day' => 2, 'start_time' => '07:00', 'duration_minutes' => 300, 'notes' => 'Thresher shark dives depart around 5 AM — book a PADI shop.'],
                    ['destination' => 'Camotes Islands', 'day' => 3, 'start_time' => '09:00', 'duration_minutes' => 360, 'notes' => 'Rent a scooter; public transport between towns is limited.'],
                ],
            ],
        ];
    }
}
