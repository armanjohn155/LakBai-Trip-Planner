<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\VisitResource;
use App\Models\Visit;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Carbon;

class VisitHistoryController extends Controller
{
    /**
     * Paginated visiting history for the authenticated user.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $perPage = (int) config('lakbai.history_per_page', 15);

        $visits = Visit::query()
            ->forUser($request->user())
            ->with('destination')
            ->when($request->filled('verified'), fn (Builder $query) => $query->where('verified', $request->boolean('verified')))
            ->when($request->filled('category'), fn (Builder $query) => $query->whereHas('destination', fn (Builder $inner) => $inner->where('category', $request->string('category')->toString())))
            ->when($request->filled('region'), fn (Builder $query) => $query->whereHas('destination', fn (Builder $inner) => $inner->where('region', $request->string('region')->toString())))
            ->when($request->filled('from'), fn (Builder $query) => $query->where('visited_at', '>=', Carbon::parse($request->string('from')->toString())->startOfDay()))
            ->when($request->filled('to'), fn (Builder $query) => $query->where('visited_at', '<=', Carbon::parse($request->string('to')->toString())->endOfDay()))
            ->latest('visited_at')
            ->paginate($request->integer('per_page', $perPage));

        return VisitResource::collection($visits);
    }

    /**
     * Aggregate statistics for the authenticated user's visits.
     */
    public function stats(Request $request): JsonResponse
    {
        $visits = Visit::query()->forUser($request->user())->with('destination')->get();

        $verified = $visits->where('verified', true);
        $destinations = $visits->map(fn (Visit $visit) => $visit->destination)->filter();

        $first = $visits->sortBy('visited_at')->first();
        $latest = $visits->sortByDesc('visited_at')->first();

        $months = collect(range(11, 0))->map(function (int $offset) use ($visits) {
            $month = Carbon::now()->startOfMonth()->subMonths($offset);

            return [
                'month' => $month->format('Y-m'),
                'label' => $month->format('M'),
                'count' => $visits->filter(fn (Visit $visit) => $visit->visited_at->isSameMonth($month))->count(),
            ];
        });

        return response()->json([
            'data' => [
                'total_visits' => $visits->count(),
                'verified_visits' => $verified->count(),
                'unique_destinations' => $destinations->unique('id')->count(),
                'regions_covered' => $destinations->pluck('region')->filter()->unique()->values(),
                'categories' => $destinations->groupBy('category')->map->count(),
                'per_month' => $months,
                'first_visit' => $first ? new VisitResource($first) : null,
                'latest_visit' => $latest ? new VisitResource($latest) : null,
            ],
        ]);
    }

    /**
     * Lightweight list of visited places for the history map.
     */
    public function map(Request $request): JsonResponse
    {
        $places = Visit::query()
            ->forUser($request->user())
            ->with('destination')
            ->get()
            ->filter(fn (Visit $visit) => $visit->destination !== null)
            ->groupBy('destination_id')
            ->map(function ($group) {
                /** @var Visit $lead */
                $lead = $group->sortByDesc('visited_at')->first();
                $destination = $lead->destination;

                return [
                    'destination_id' => $destination->id,
                    'name' => $destination->name,
                    'latitude' => $destination->latitude,
                    'longitude' => $destination->longitude,
                    'verified' => $group->contains(fn (Visit $visit) => $visit->verified),
                    'last_visited_at' => $lead->visited_at->toIso8601String(),
                    'visit_count' => $group->count(),
                ];
            })
            ->values();

        return response()->json(['data' => $places]);
    }
}
