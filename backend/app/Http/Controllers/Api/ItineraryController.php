<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreItineraryRequest;
use App\Http\Requests\UpdateItineraryRequest;
use App\Http\Resources\ItineraryResource;
use App\Http\Resources\ItinerarySummaryResource;
use App\Events\TripDeleted;
use App\Models\Itinerary;
use App\Models\Visit;
use App\Services\ItineraryActivityLogger;
use App\Services\ItineraryConflictGuard;
use App\Services\TripInvitationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class ItineraryController extends Controller
{
    public function __construct(
        private readonly ItineraryActivityLogger $activityLogger,
        private readonly ItineraryConflictGuard $conflictGuard,
        private readonly TripInvitationService $invitations,
    ) {}

    /**
     * Display the itineraries the user owns or collaborates on.
     *
     * Supports `filter=all|owned|shared|invited` (default all).
     */
    public function index(): AnonymousResourceCollection
    {
        $user = request()->user();
        $filter = (string) request()->query('filter', 'all');

        $query = Itinerary::query()
            ->withCount([
                'items',
                'members as members_count' => fn ($query) => $query->wherePivot('status', Itinerary::STATUS_ACCEPTED),
            ])
            ->with([
                'user:id,name,username,avatar_url',
                'updatedBy:id,name',
                'members' => fn ($query) => $query
                    ->wherePivot('status', Itinerary::STATUS_ACCEPTED)
                    ->select('users.id', 'users.name', 'users.username', 'users.avatar_url'),
                'items.destination' => fn ($query) => $query->withTrashed(),
            ]);

        $query->when($filter === 'owned', fn ($query) => $query->whereBelongsTo($user))
            ->when($filter === 'shared', fn ($query) => $query->accessibleBy($user)->where('user_id', '!=', $user->id))
            ->when($filter === 'invited', fn ($query) => $query->pendingFor($user))
            ->when(! in_array($filter, ['owned', 'shared', 'invited'], true), fn ($query) => $query->accessibleBy($user));

        $itineraries = $query->latest('updated_at')->paginate(20);

        $this->flagVerifiedStops($itineraries->getCollection(), $user);

        return ItineraryResource::collection($itineraries);
    }

    /**
     * Store a newly created itinerary, optionally inviting accepted friends in
     * the same transaction.
     */
    public function store(StoreItineraryRequest $request): ItineraryResource
    {
        $user = $request->user();

        $itinerary = DB::transaction(function () use ($request, $user) {
            $itinerary = $user->itineraries()->create(
                $request->safe()->only([
                    'title',
                    'description',
                    'start_date',
                    'end_date',
                    'budget',
                    'total_budget',
                    'cover_image_url',
                    'trip_type',
                ]) + ['trip_type' => Itinerary::TRIP_SOLO]
            );

            $inviteIds = $request->input('invite_user_ids', []);

            if (is_array($inviteIds) && $inviteIds !== []) {
                $this->invitations->invite(
                    $itinerary,
                    $user,
                    $inviteIds,
                    (string) $request->input('role', Itinerary::ROLE_VIEWER),
                );
            }

            return $itinerary;
        });

        return new ItineraryResource($itinerary->loadForDisplay($user)->loadCount([
            'members as members_count' => fn ($query) => $query->wherePivot('status', Itinerary::STATUS_ACCEPTED),
        ]));
    }

    /**
     * Display the specified itinerary.
     */
    public function show(Itinerary $itinerary): ItineraryResource
    {
        Gate::authorize('view', $itinerary);

        return new ItineraryResource($itinerary->loadForDisplay(request()->user())->loadCount([
            'members as members_count' => fn ($query) => $query->wherePivot('status', Itinerary::STATUS_ACCEPTED),
        ]));
    }

    /**
     * Update the specified itinerary. Editors may edit details; only the owner
     * may change sharing settings (share_budget).
     */
    public function update(UpdateItineraryRequest $request, Itinerary $itinerary): ItineraryResource
    {
        $this->conflictGuard->assertFresh($itinerary, $request->input('base_version'));

        $attributes = $request->safe()->only([
            'title',
            'description',
            'start_date',
            'end_date',
            'budget',
            'total_budget',
            'cover_image_url',
        ]);

        // share_budget is an owner-only sharing setting.
        if ($request->has('share_budget') && $request->user()->can('manageMembers', $itinerary)) {
            $attributes['share_budget'] = $request->boolean('share_budget');
        }

        DB::transaction(function () use ($itinerary, $attributes, $request) {
            $itinerary->update($attributes);
            $this->activityLogger->recordChange($itinerary, 'itinerary.updated', $request->user(), $itinerary);
        });

        return new ItineraryResource($itinerary->loadForDisplay($request->user())->loadCount([
            'members as members_count' => fn ($query) => $query->wherePivot('status', Itinerary::STATUS_ACCEPTED),
        ]));
    }

    /**
     * Duplicate the itinerary and all of its stops into the current user's
     * account. The copy never inherits members or invites.
     */
    public function duplicate(Itinerary $itinerary): JsonResponse
    {
        Gate::authorize('duplicate', $itinerary);

        $user = request()->user();

        $copy = DB::transaction(function () use ($itinerary, $user) {
            $copy = $itinerary->replicate(['is_template', 'template_key']);
            $copy->user_id = $user->id;
            $copy->title = 'Copy of '.$itinerary->title;
            $copy->is_template = false;
            $copy->template_key = null;
            $copy->trip_type = Itinerary::TRIP_SOLO;
            $copy->version = 1;
            $copy->updated_by = $user->id;
            $copy->save();

            $itinerary->load(['items.destination' => fn ($query) => $query->withTrashed()]);

            foreach ($itinerary->items as $item) {
                $copy->items()->create([
                    'destination_id' => $item->destination_id,
                    'custom_title' => $item->custom_title,
                    'custom_latitude' => $item->custom_latitude,
                    'custom_longitude' => $item->custom_longitude,
                    'custom_address' => $item->custom_address,
                    'day_number' => $item->day_number,
                    'order' => $item->order,
                    'start_time' => $item->start_time,
                    'duration_minutes' => $item->duration_minutes,
                    'category' => $item->category,
                    'estimated_budget' => $item->estimated_budget,
                    'notes' => $item->notes,
                    'status' => 'planned',
                    'visited' => false,
                    'updated_by' => $user->id,
                ]);
            }

            return $copy;
        });

        return (new ItineraryResource($copy->loadForDisplay($user)->loadCount([
            'members as members_count' => fn ($query) => $query->wherePivot('status', Itinerary::STATUS_ACCEPTED),
        ])))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * Remove the specified itinerary. Owner only; cascades members/invites.
     */
    public function destroy(Itinerary $itinerary): Response
    {
        Gate::authorize('delete', $itinerary);

        event(new TripDeleted($itinerary, request()->user()));

        $itinerary->delete();

        return response()->noContent();
    }

    /**
     * Display the total estimated budget breakdown for the itinerary.
     */
    public function summary(Itinerary $itinerary): ItinerarySummaryResource
    {
        Gate::authorize('view', $itinerary);

        return new ItinerarySummaryResource($itinerary->load(['items.destination' => fn ($query) => $query->withTrashed()]));
    }

    /**
     * Lightweight polling endpoint: has the itinerary changed since version N?
     */
    public function changes(Itinerary $itinerary): JsonResponse
    {
        Gate::authorize('view', $itinerary);

        $since = (int) request()->query('since_version', 0);

        $activities = $itinerary->activities()
            ->with('user:id,name')
            ->when($since > 0, fn ($query) => $query->where('id', '>', $since))
            ->limit(50)
            ->get()
            ->map(fn ($activity) => [
                'id' => $activity->id,
                'action' => $activity->action,
                'user' => $activity->user?->name,
                'meta' => $activity->meta,
                'created_at' => $activity->created_at,
            ]);

        return response()->json([
            'data' => [
                'version' => (int) $itinerary->version,
                'changed' => (int) $itinerary->version > $since,
                'updated_by' => $itinerary->updatedBy?->name,
                'activities' => $activities,
            ],
        ]);
    }

    /**
     * Flag the stops on a collection of itineraries with the user's verified
     * visit status in a couple of queries rather than one per stop.
     *
     * @param  Collection<int, Itinerary>  $itineraries
     */
    private function flagVerifiedStops($itineraries, $user): void
    {
        $destinationIds = $itineraries
            ->flatMap(fn (Itinerary $itinerary) => $itinerary->items->pluck('destination_id'))
            ->filter()
            ->unique()
            ->values();

        if ($destinationIds->isEmpty()) {
            return;
        }

        $verifiedIds = Visit::query()
            ->where('user_id', $user->id)
            ->verified()
            ->whereIn('destination_id', $destinationIds)
            ->pluck('destination_id')
            ->unique();

        $itineraries->each(function (Itinerary $itinerary) use ($verifiedIds) {
            $itinerary->items->each(function ($item) use ($verifiedIds) {
                $item->verified = $item->destination_id !== null
                    && $verifiedIds->contains($item->destination_id);
            });
        });
    }
}
