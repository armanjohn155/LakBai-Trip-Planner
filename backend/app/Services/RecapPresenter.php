<?php

namespace App\Services;

use App\Models\Destination;
use App\Models\Itinerary;
use App\Models\ItineraryItem;
use App\Models\TripPhoto;
use App\Models\TripRecap;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Turns a TripRecap into two deliberately different shapes:
 *
 *  - member(): everything a signed-in owner/editor/viewer may see.
 *  - public(): a strict whitelist for `/s/{token}`. Budgets, notes, emails,
 *    member identities, exact route ends and live positions are never here.
 */
class RecapPresenter
{
    public function __construct(private readonly RouteSimplifier $geometry) {}

    /**
     * @return array<string, mixed>
     */
    public function member(TripRecap $recap, ?User $viewer = null): array
    {
        $itinerary = $this->itinerary($recap);
        $role = $itinerary->roleFor($viewer);
        $photos = $this->photos($itinerary);
        $canSeeBudget = $role === Itinerary::ROLE_OWNER
            || $role === Itinerary::ROLE_EDITOR
            || (bool) $itinerary->share_budget;

        return [
            'id' => $recap->id,
            'itinerary_id' => $recap->itinerary_id,
            'title' => $recap->title,
            'summary' => $recap->summary,
            'start_date' => $itinerary->start_date?->toDateString(),
            'end_date' => $itinerary->end_date?->toDateString(),
            'day_count' => $itinerary->dayCount(),
            'lifecycle_status' => $itinerary->lifecycle_status,
            'completed_at' => $itinerary->completed_at?->toIso8601String(),
            'cover_photo_id' => $recap->cover_photo_id,
            'cover_photo' => $this->cover($recap, $photos, $itinerary),
            'visibility' => $recap->visibility,
            'hide_endpoints' => (bool) $recap->hide_endpoints,
            'show_stats' => (bool) $recap->show_stats,
            'show_photos' => (bool) $recap->show_photos,
            'theme_accent' => $recap->theme_accent ?: 'surf',
            'stats' => $this->memberStats($recap, $canSeeBudget),
            'route' => $this->route($recap),
            'stops' => $this->memberStops($itinerary, $photos),
            'photos' => $photos->map(fn (TripPhoto $photo) => $this->photo($photo))->values(),
            'members' => $this->members($itinerary),
            'member_count' => $this->memberCount($itinerary),
            'share' => [
                'active' => $recap->shareIsActive(),
                'has_link' => $recap->share_token_hash !== null,
                'expires_at' => $recap->share_expires_at?->toIso8601String(),
                'url' => null,
            ],
            'permissions' => [
                'can_edit' => $role === Itinerary::ROLE_OWNER,
                'can_upload_photos' => $itinerary->isEditableBy($viewer),
            ],
        ];
    }

    /**
     * Public payload. This is the only place that reads public recap data, so
     * keeping the array hand-written (instead of reusing member()) is the
     * safety boundary.
     *
     * @return array<string, mixed>
     */
    public function public(TripRecap $recap): array
    {
        $itinerary = $this->itinerary($recap);
        $photos = $recap->show_photos
            ? $this->photos($itinerary)->where('is_hidden', false)->values()
            : collect();

        return [
            'title' => $recap->title,
            'summary' => $recap->summary,
            'start_date' => $itinerary->start_date?->toDateString(),
            'end_date' => $itinerary->end_date?->toDateString(),
            'day_count' => $itinerary->dayCount(),
            'theme_accent' => $recap->theme_accent ?: 'surf',
            'hide_endpoints' => (bool) $recap->hide_endpoints,
            'cover_photo' => $recap->show_photos
                ? $this->cover($recap, $photos, $itinerary, true)
                : null,
            'stats' => $recap->show_stats ? $this->publicStats($recap) : null,
            'route' => $recap->hide_endpoints
                ? $this->trimmedRoute($recap)
                : $this->route($recap),
            'stops' => $this->publicStops($itinerary, $photos),
            'photos' => $photos->map(fn (TripPhoto $photo) => $this->photo($photo, false))->values(),
        ];
    }

    private function itinerary(TripRecap $recap): Itinerary
    {
        $itinerary = $recap->relationLoaded('itinerary')
            ? $recap->itinerary
            : $recap->itinerary()->firstOrFail();

        $itinerary->loadMissing([
            'user:id,name,username,avatar_url',
            'items.destination' => fn ($query) => $query->withTrashed(),
            'members' => fn ($query) => $query
                ->wherePivot('status', Itinerary::STATUS_ACCEPTED)
                ->select('users.id', 'users.name', 'users.username', 'users.avatar_url'),
        ]);

        return $itinerary;
    }

    /**
     * @return Collection<int, TripPhoto>
     */
    private function photos(Itinerary $itinerary): Collection
    {
        return TripPhoto::query()
            ->where('itinerary_id', $itinerary->id)
            ->with('user:id,name')
            ->orderBy('position')
            ->orderBy('id')
            ->get();
    }

    /**
     * @param  Collection<int, TripPhoto>  $photos
     * @return array<string, mixed>|null
     */
    private function cover(TripRecap $recap, Collection $photos, Itinerary $itinerary, bool $visibleOnly = false): ?array
    {
        $cover = $recap->cover_photo_id !== null
            ? $photos->firstWhere('id', $recap->cover_photo_id)
            : null;

        $cover ??= $photos->first();

        if ($cover === null && $recap->cover_photo_id !== null) {
            $cover = TripPhoto::query()
                ->where('itinerary_id', $itinerary->id)
                ->where('id', $recap->cover_photo_id)
                ->when($visibleOnly, fn ($query) => $query->where('is_hidden', false))
                ->first();
        }

        return $cover === null ? null : $this->photo($cover, false);
    }

    /**
     * @return array<string, mixed>
     */
    private function photo(TripPhoto $photo, bool $withUploader = true): array
    {
        $data = [
            'id' => $photo->id,
            'url' => $photo->absoluteUrl(),
            'thumbnail_url' => $photo->thumbnailUrl(),
            'caption' => $photo->caption,
            'taken_at' => $photo->taken_at?->toIso8601String(),
            'itinerary_item_id' => $photo->itinerary_item_id,
            'position' => (int) $photo->position,
            'is_hidden' => (bool) $photo->is_hidden,
        ];

        if ($withUploader) {
            $data['user'] = [
                'id' => $photo->user_id,
                'name' => $photo->relationLoaded('user') ? $photo->user?->name : null,
            ];
        }

        return $data;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function memberStats(TripRecap $recap, bool $canSeeBudget): ?array
    {
        if ($recap->stats === null) {
            return null;
        }

        $stats = $recap->stats;

        if (! $canSeeBudget) {
            $stats['spend_planned'] = null;
            $stats['spend_estimated'] = null;
        }

        return $stats;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function publicStats(TripRecap $recap): ?array
    {
        if ($recap->stats === null) {
            return null;
        }

        $safe = [
            'distance_m',
            'moving_seconds',
            'elapsed_seconds',
            'days',
            'stops_total',
            'stops_visited',
            'stops_skipped',
            'verified_visits',
            'average_speed_kmh',
        ];

        $stats = [];

        foreach ($safe as $key) {
            $stats[$key] = $recap->stats[$key] ?? null;
        }

        return $stats;
    }

    /**
     * @return array{type: string, features: array<int, array<string, mixed>>}
     */
    private function route(TripRecap $recap): array
    {
        $route = $recap->route_geojson;

        if (! is_array($route) || ! isset($route['features'])) {
            return ['type' => 'FeatureCollection', 'features' => []];
        }

        return $route;
    }

    /**
     * Trim the first and last privacy radius from every line in a public
     * route, in metres along the line.
     *
     * @return array{type: string, features: array<int, array<string, mixed>>}
     */
    private function trimmedRoute(TripRecap $recap): array
    {
        $route = $this->route($recap);
        $features = [];

        foreach ($route['features'] as $feature) {
            if (($feature['geometry']['type'] ?? null) !== 'LineString') {
                continue;
            }

            $coordinates = $feature['geometry']['coordinates'] ?? [];
            $points = array_map(fn (array $coordinate) => [(float) $coordinate[1], (float) $coordinate[0]], $coordinates);
            $trimmed = $this->geometry->trimEnds($points);

            if (count($trimmed) < 2) {
                continue;
            }

            $feature['geometry']['coordinates'] = array_map(
                fn (array $point) => [round($point[1], 7), round($point[0], 7)],
                $trimmed,
            );

            $features[] = $feature;
        }

        return ['type' => 'FeatureCollection', 'features' => $features];
    }

    /**
     * @param  Collection<int, TripPhoto>  $photos
     * @return array<int, array<string, mixed>>
     */
    private function memberStops(Itinerary $itinerary, Collection $photos): array
    {
        return $itinerary->items
            ->map(function (ItineraryItem $item) use ($photos) {
                $destination = $item->destination;

                return [
                    'id' => $item->id,
                    'destination_id' => $item->destination_id,
                    'day_number' => (int) $item->day_number,
                    'order' => (int) $item->order,
                    'title' => $item->resolvedTitle(),
                    'category' => $item->resolvedCategory(),
                    'municipality' => $destination?->municipality,
                    'image_url' => $this->imageUrl($destination?->image_url),
                    'latitude' => $item->resolvedCoordinates()[0] ?? null,
                    'longitude' => $item->resolvedCoordinates()[1] ?? null,
                    'start_time' => $item->start_time,
                    'status' => $item->status ?? 'planned',
                    'arrived_at' => $item->arrived_at?->toIso8601String(),
                    'completed_at' => $item->completed_at?->toIso8601String(),
                    'verified' => $item->visit_id !== null,
                    'notes' => $item->notes,
                    'photo_ids' => $photos
                        ->where('itinerary_item_id', $item->id)
                        ->pluck('id')
                        ->values()
                        ->all(),
                ];
            })
            ->values()
            ->all();
    }

    /**
     * Public stops expose a destination's public name/category/image and its
     * coordinates (a published destination is already public). Custom stops
     * never expose coordinates or notes because those can be a private home.
     *
     * @param  Collection<int, TripPhoto>  $photos
     * @return array<int, array<string, mixed>>
     */
    private function publicStops(Itinerary $itinerary, Collection $photos): array
    {
        return $itinerary->items
            ->map(function (ItineraryItem $item) use ($photos) {
                $destination = $item->destination;

                return [
                    'id' => $item->id,
                    'day_number' => (int) $item->day_number,
                    'order' => (int) $item->order,
                    'title' => $item->resolvedTitle(),
                    'category' => $item->resolvedCategory(),
                    'municipality' => $destination?->municipality,
                    'image_url' => $this->imageUrl($destination?->image_url),
                    'latitude' => $destination?->latitude !== null ? (float) $destination->latitude : null,
                    'longitude' => $destination?->longitude !== null ? (float) $destination->longitude : null,
                    'status' => $item->status ?? 'planned',
                    'photo_ids' => $photos
                        ->where('itinerary_item_id', $item->id)
                        ->pluck('id')
                        ->values()
                        ->all(),
                ];
            })
            ->values()
            ->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function members(Itinerary $itinerary): array
    {
        $owner = $itinerary->user;

        $members = $itinerary->members->map(fn (User $member) => [
            'id' => $member->id,
            'name' => $member->name,
            'username' => $member->username,
            'avatar_url' => $member->avatar_url,
            'role' => $member->pivot?->role,
        ]);

        if ($owner !== null) {
            $members->prepend([
                'id' => $owner->id,
                'name' => $owner->name,
                'username' => $owner->username,
                'avatar_url' => $owner->avatar_url,
                'role' => Itinerary::ROLE_OWNER,
            ]);
        }

        return $members->values()->all();
    }

    private function memberCount(Itinerary $itinerary): int
    {
        return $itinerary->members->count() + 1;
    }

    private function imageUrl(?string $imageUrl): ?string
    {
        if ($imageUrl === null || ! is_string($imageUrl)) {
            return null;
        }

        if (str_starts_with($imageUrl, '/storage/')) {
            return Storage::disk('public')->url(Str::after($imageUrl, '/storage/'));
        }

        return $imageUrl;
    }
}
