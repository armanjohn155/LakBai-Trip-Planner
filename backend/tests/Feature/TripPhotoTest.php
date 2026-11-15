<?php

namespace Tests\Feature;

use App\Models\Destination;
use App\Models\Itinerary;
use App\Models\ItineraryItem;
use App\Models\TripPhoto;
use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class TripPhotoTest extends TestCase
{
    use LazilyRefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        if (! function_exists('imagecreatefromstring') || ! function_exists('exif_read_data')) {
            $this->markTestSkipped('Photo processing tests need the GD and EXIF extensions.');
        }

        Storage::fake('public');
        Carbon::setTestNow('2026-11-15 09:00:00');
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_uploading_a_photo_re_encodes_it_and_strips_exif_gps(): void
    {
        [$owner, $trip] = $this->completedTrip();
        $item = $trip->items()->firstOrFail();

        $response = $this->actingAs($owner)
            ->post("/api/itineraries/{$trip->id}/photos", [
                'photo' => $this->uploadedExifJpeg(),
                'caption' => 'Misty ridge',
                'itinerary_item_id' => $item->id,
            ])
            ->assertCreated();

        $photo = TripPhoto::query()->findOrFail($response->json('data.id'));

        $this->assertSame('Misty ridge', $photo->caption);
        $this->assertSame($item->id, $photo->itinerary_item_id);
        $this->assertSame(1, $photo->position);

        Storage::disk('public')->assertExists($photo->path);
        Storage::disk('public')->assertExists($photo->thumbnailPath());

        $source = Storage::disk('public')->get($photo->path);

        // Re-encoding must drop the GPS block entirely.
        $exif = @exif_read_data(Storage::disk('public')->path($photo->path));
        $this->assertArrayNotHasKey('GPSLatitude', is_array($exif) ? $exif : []);
        $this->assertArrayNotHasKey('GPSLatitudeRef', is_array($exif) ? $exif : []);

        // EXIF orientation 6 means the 2x1 upload is stored as 1x2.
        $size = getimagesizefromstring($source);
        $this->assertSame(1, $size[0]);
        $this->assertSame(2, $size[1]);

        $thumbnail = getimagesizefromstring(
            Storage::disk('public')->get($photo->thumbnailPath()),
        );
        $this->assertSame(1, $thumbnail[0]);
        $this->assertSame(2, $thumbnail[1]);
    }

    public function test_upload_validation_rejects_non_images_oversized_files_and_foreign_stops(): void
    {
        [$owner, $trip] = $this->completedTrip();

        $this->actingAs($owner)
            ->post("/api/itineraries/{$trip->id}/photos", [
                'photo' => UploadedFile::fake()->createWithContent('fake.jpg', 'not an image at all'),
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('photo');

        $this->actingAs($owner)
            ->post("/api/itineraries/{$trip->id}/photos", [
                'photo' => UploadedFile::fake()->create('huge.jpg', 5121, 'image/jpeg'),
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('photo');

        $otherTrip = $this->completedTrip(User::factory()->create())[1];
        $foreignStop = $otherTrip->items()->firstOrFail();

        $this->actingAs($owner)
            ->post("/api/itineraries/{$trip->id}/photos", [
                'photo' => $this->uploadedExifJpeg(),
                'itinerary_item_id' => $foreignStop->id,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('itinerary_item_id');
    }

    public function test_each_traveller_is_limited_to_the_configured_number_of_photos(): void
    {
        [$owner, $trip] = $this->completedTrip();

        config(['lakbai.recap.max_photos_per_user' => 1]);

        $this->actingAs($owner)
            ->post("/api/itineraries/{$trip->id}/photos", ['photo' => $this->uploadedExifJpeg()])
            ->assertCreated();

        $this->actingAs($owner)
            ->post("/api/itineraries/{$trip->id}/photos", ['photo' => $this->uploadedExifJpeg()])
            ->assertStatus(422)
            ->assertJsonValidationErrors('photo');

        $this->assertSame(1, TripPhoto::query()->where('itinerary_id', $trip->id)->count());
    }

    public function test_viewers_cannot_upload_but_editors_can_manage_their_own_photos(): void
    {
        [$owner, $trip] = $this->completedTrip();
        $editor = User::factory()->create();
        $otherEditor = User::factory()->create();
        $viewer = User::factory()->create();

        $this->attachMember($trip, $editor, Itinerary::ROLE_EDITOR);
        $this->attachMember($trip, $otherEditor, Itinerary::ROLE_EDITOR);
        $this->attachMember($trip, $viewer, Itinerary::ROLE_VIEWER);

        $this->actingAs($viewer)
            ->post("/api/itineraries/{$trip->id}/photos", ['photo' => $this->uploadedExifJpeg()])
            ->assertForbidden();

        $photoId = $this->actingAs($editor)
            ->post("/api/itineraries/{$trip->id}/photos", ['photo' => $this->uploadedExifJpeg()])
            ->assertCreated()
            ->json('data.id');

        $photo = TripPhoto::query()->findOrFail($photoId);

        $this->actingAs($otherEditor)
            ->putJson("/api/itineraries/{$trip->id}/photos/{$photo->id}", ['caption' => 'Not mine'])
            ->assertForbidden();

        $this->actingAs($editor)
            ->putJson("/api/itineraries/{$trip->id}/photos/{$photo->id}", ['caption' => 'Mine'])
            ->assertOk()
            ->assertJsonPath('data.caption', 'Mine');

        // The trip owner can moderate anyone's photo.
        $this->actingAs($owner)
            ->putJson("/api/itineraries/{$trip->id}/photos/{$photo->id}", ['caption' => 'Moderated'])
            ->assertOk()
            ->assertJsonPath('data.caption', 'Moderated');

        $this->actingAs($otherEditor)
            ->deleteJson("/api/itineraries/{$trip->id}/photos/{$photo->id}")
            ->assertForbidden();

        $this->actingAs($editor)
            ->deleteJson("/api/itineraries/{$trip->id}/photos/{$photo->id}")
            ->assertNoContent();
    }

    public function test_photos_can_be_reordered_but_only_within_the_same_trip(): void
    {
        [$owner, $trip] = $this->completedTrip();

        $first = $this->actingAs($owner)
            ->post("/api/itineraries/{$trip->id}/photos", ['photo' => $this->uploadedExifJpeg()])
            ->json('data.id');

        $second = $this->actingAs($owner)
            ->post("/api/itineraries/{$trip->id}/photos", ['photo' => $this->uploadedExifJpeg()])
            ->json('data.id');

        $this->actingAs($owner)
            ->putJson("/api/itineraries/{$trip->id}/photos/reorder", [
                'photos' => [$second, $first],
            ])
            ->assertOk()
            ->assertJsonPath('data.0.id', $second)
            ->assertJsonPath('data.0.position', 0)
            ->assertJsonPath('data.1.id', $first)
            ->assertJsonPath('data.1.position', 1);

        $foreign = $this->completedTrip(User::factory()->create())[1];
        $foreignPhoto = $this->photo($foreign, $owner);

        $this->actingAs($owner)
            ->putJson("/api/itineraries/{$trip->id}/photos/reorder", [
                'photos' => [$first, $foreignPhoto->id],
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('photos');
    }

    public function test_deleting_a_trip_removes_photo_files_from_disk(): void
    {
        [$owner, $trip] = $this->completedTrip();

        $photoId = $this->actingAs($owner)
            ->post("/api/itineraries/{$trip->id}/photos", ['photo' => $this->uploadedExifJpeg()])
            ->json('data.id');

        $photo = TripPhoto::query()->findOrFail($photoId);
        $path = $photo->path;
        $thumbnail = $photo->thumbnailPath();

        Storage::disk('public')->assertExists($path);
        Storage::disk('public')->assertExists($thumbnail);

        $this->actingAs($owner)
            ->deleteJson("/api/itineraries/{$trip->id}")
            ->assertNoContent();

        Storage::disk('public')->assertMissing($path);
        Storage::disk('public')->assertMissing($thumbnail);
        $this->assertNull(TripPhoto::withTrashed()->find($photoId));
    }

    /**
     * @return array{0: User, 1: Itinerary}
     */
    private function completedTrip(?User $owner = null): array
    {
        $owner ??= User::factory()->create();

        $destination = Destination::factory()->create([
            'name' => 'Kawasan Falls '.uniqid(),
            'latitude' => 9.8,
            'longitude' => 123.2,
            'municipality' => 'Badian',
            'category' => 'Waterfall',
        ]);

        $trip = Itinerary::factory()->for($owner)->create([
            'title' => 'Badian weekend',
            'start_date' => '2026-11-14',
            'end_date' => '2026-11-15',
            'lifecycle_status' => Itinerary::LIFECYCLE_COMPLETED,
            'started_at' => Carbon::now()->subDay(),
            'completed_at' => Carbon::now(),
        ]);

        ItineraryItem::factory()->for($trip)->for($destination)->create([
            'day_number' => 1,
            'order' => 0,
            'status' => 'done',
            'visited' => true,
        ]);

        return [$owner, $trip];
    }

    private function photo(Itinerary $trip, User $user): TripPhoto
    {
        return TripPhoto::query()->create([
            'itinerary_id' => $trip->id,
            'user_id' => $user->id,
            'path' => 'recap-photos/'.$trip->id.'/photo.jpg',
            'position' => 1,
            'is_hidden' => false,
        ]);
    }

    private function attachMember(Itinerary $trip, User $user, string $role): void
    {
        $trip->members()->attach($user->id, [
            'role' => $role,
            'status' => Itinerary::STATUS_ACCEPTED,
            'invited_by' => $trip->user_id,
            'invited_at' => now(),
            'responded_at' => now(),
            'joined_at' => now(),
        ]);
    }

    /**
     * A two-pixel JPEG carrying EXIF orientation 6 and a GPS latitude. The
     * real upload path must read the orientation, rotate the pixels, and drop
     * every metadata tag before storing the file.
     */
    private function uploadedExifJpeg(): UploadedFile
    {
        $image = imagecreatetruecolor(2, 1);
        $red = imagecolorallocate($image, 220, 40, 40);
        imagefilledrectangle($image, 0, 0, 1, 0, $red);
        ob_start();
        imagejpeg($image, null, 90);
        $jpeg = (string) ob_get_clean();
        imagedestroy($image);

        $tiff = "II*\0\x08\0\0\0";
        $tiff .= "\x02\x00";
        $tiff .= "\x12\x01\x03\x00\x01\x00\x00\x00\x06\x00\x00\x00";
        $tiff .= "\x25\x88\x04\x00\x01\x00\x00\x00\x26\x00\x00\x00";
        $tiff .= "\x00\x00\x00\x00";
        $tiff .= "\x02\x00";
        $tiff .= "\x01\x00\x02\x00\x02\x00\x00\x00N\0\0\0";
        $tiff .= "\x02\x00\x05\x00\x03\x00\x00\x00\x44\x00\x00\x00";
        $tiff .= "\x00\x00\x00\x00";
        $tiff .= "\x0A\x00\x00\x00\x01\x00\x00\x00"
            ."\x00\x00\x00\x00\x01\x00\x00\x00"
            ."\x00\x00\x00\x00\x01\x00\x00\x00";

        $payload = "Exif\0\0".$tiff;
        $segment = "\xFF\xE1".pack('n', strlen($payload) + 2).$payload;
        $withExif = substr($jpeg, 0, 2).$segment.substr($jpeg, 2);

        return UploadedFile::fake()->createWithContent('ridge.jpg', $withExif);
    }
}
