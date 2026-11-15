<?php

namespace App\Services;

use App\Models\Itinerary;
use App\Models\ItineraryItem;
use App\Models\TripPhoto;
use App\Models\TripRecap;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TripPhotoService
{
    public function __construct(private readonly PhotoProcessor $processor) {}

    /**
     * @param  array{caption?: string|null, taken_at?: string|null, itinerary_item_id?: int|null}  $meta
     */
    public function upload(Itinerary $itinerary, User $user, UploadedFile $file, array $meta = []): TripPhoto
    {
        $limit = (int) config('lakbai.recap.max_photos_per_user', 20);

        $existing = TripPhoto::query()
            ->where('itinerary_id', $itinerary->id)
            ->where('user_id', $user->id)
            ->count();

        if ($existing >= $limit) {
            throw ValidationException::withMessages([
                'photo' => "You can add up to {$limit} photos to this trip.",
            ]);
        }

        $itemId = $this->itemIdFor($itinerary, $meta['itinerary_item_id'] ?? null);

        $processed = $this->processor->process($file, (int) $itinerary->id);

        try {
            return DB::transaction(function () use ($itinerary, $user, $itemId, $meta, $processed) {
                $position = ((int) TripPhoto::query()
                    ->where('itinerary_id', $itinerary->id)
                    ->max('position')) + 1;

                return TripPhoto::query()->create([
                    'itinerary_id' => $itinerary->id,
                    'itinerary_item_id' => $itemId,
                    'user_id' => $user->id,
                    'path' => $processed['path'],
                    'caption' => $meta['caption'] ?? null,
                    'taken_at' => $meta['taken_at'] ?? null,
                    'position' => $position,
                    'is_hidden' => false,
                ]);
            });
        } catch (\Throwable $exception) {
            // Never leave an orphaned upload behind when the row fails.
            \Illuminate\Support\Facades\Storage::disk(TripPhoto::DISK)->delete([
                $processed['path'],
                $processed['thumbnail_path'],
            ]);

            throw $exception;
        }
    }

    /**
     * @param  array{caption?: string|null, taken_at?: string|null, itinerary_item_id?: int|null, is_hidden?: bool}  $data
     */
    public function update(TripPhoto $photo, array $data): TripPhoto
    {
        if (array_key_exists('itinerary_item_id', $data)) {
            $data['itinerary_item_id'] = $this->itemIdFor($photo->itinerary, $data['itinerary_item_id']);
        }

        $photo->fill($data)->save();

        return $photo->refresh();
    }

    /**
     * @param  array<int, int>  $photoIds
     */
    public function reorder(Itinerary $itinerary, array $photoIds): void
    {
        $photos = TripPhoto::query()
            ->where('itinerary_id', $itinerary->id)
            ->whereIn('id', $photoIds)
            ->get()
            ->keyBy('id');

        if ($photos->count() !== count(array_unique($photoIds))) {
            throw ValidationException::withMessages([
                'photos' => 'One or more photos do not belong to this trip.',
            ]);
        }

        DB::transaction(function () use ($photoIds, $photos) {
            foreach (array_values($photoIds) as $position => $id) {
                $photos->get($id)?->forceFill(['position' => $position])->save();
            }
        });
    }

    public function delete(TripPhoto $photo): void
    {
        $photo->discardFiles();

        $recap = TripRecap::query()->where('itinerary_id', $photo->itinerary_id)->first();

        if ($recap !== null && (int) $recap->cover_photo_id === (int) $photo->id) {
            $recap->forceFill(['cover_photo_id' => null])->save();
        }

        $photo->delete();
    }

    /**
     * Called before an itinerary is deleted so cascades cannot leave files
     * behind on the public disk.
     */
    public function deleteForItinerary(Itinerary $itinerary): void
    {
        TripPhoto::query()
            ->withTrashed()
            ->where('itinerary_id', $itinerary->id)
            ->get()
            ->each(function (TripPhoto $photo) {
                $photo->discardFiles();
                $photo->forceDelete();
            });
    }

    private function itemIdFor(Itinerary $itinerary, mixed $itemId): ?int
    {
        if ($itemId === null || $itemId === '') {
            return null;
        }

        $belongs = ItineraryItem::query()
            ->where('itinerary_id', $itinerary->id)
            ->whereKey($itemId)
            ->exists();

        if (! $belongs) {
            throw ValidationException::withMessages([
                'itinerary_item_id' => 'That stop does not belong to this trip.',
            ]);
        }

        return (int) $itemId;
    }
}
