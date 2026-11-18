<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreDestinationOptionRequest;
use App\Http\Requests\Admin\UpdateDestinationOptionRequest;
use App\Models\Destination;
use App\Models\DestinationCategory;
use App\Models\DestinationRegion;
use App\Models\ItineraryItem;
use App\Services\DestinationOptionService;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class DestinationOptionController extends Controller
{
    public function __construct(private readonly DestinationOptionService $options) {}

    public function categories(): JsonResponse
    {
        return $this->listFor(DestinationOptionService::CATEGORY);
    }

    public function storeCategory(StoreDestinationOptionRequest $request): JsonResponse
    {
        return $this->storeFor(DestinationOptionService::CATEGORY, $request);
    }

    public function updateCategory(UpdateDestinationOptionRequest $request, DestinationCategory $category): JsonResponse
    {
        return $this->updateFor(DestinationOptionService::CATEGORY, $request, $category);
    }

    public function destroyCategory(Request $request, DestinationCategory $category): JsonResponse
    {
        return $this->destroyFor(DestinationOptionService::CATEGORY, $request, $category);
    }

    public function reorderCategories(Request $request): JsonResponse
    {
        return $this->reorderFor(DestinationOptionService::CATEGORY, $request);
    }

    public function regions(): JsonResponse
    {
        return $this->listFor(DestinationOptionService::REGION);
    }

    public function storeRegion(StoreDestinationOptionRequest $request): JsonResponse
    {
        return $this->storeFor(DestinationOptionService::REGION, $request);
    }

    public function updateRegion(UpdateDestinationOptionRequest $request, DestinationRegion $region): JsonResponse
    {
        return $this->updateFor(DestinationOptionService::REGION, $request, $region);
    }

    public function destroyRegion(Request $request, DestinationRegion $region): JsonResponse
    {
        return $this->destroyFor(DestinationOptionService::REGION, $request, $region);
    }

    public function reorderRegions(Request $request): JsonResponse
    {
        return $this->reorderFor(DestinationOptionService::REGION, $request);
    }

    private function listFor(string $type): JsonResponse
    {
        $model = $this->options->modelFor($type);
        $destinationCounts = $this->destinationCounts($type);
        $itineraryCounts = $type === DestinationOptionService::CATEGORY ? $this->itineraryCounts() : [];

        $items = $model::query()
            ->ordered()
            ->get()
            ->map(fn (Model $option): array => $this->payload(
                $option,
                $destinationCounts[Str::lower($option->name)] ?? 0,
                $type === DestinationOptionService::CATEGORY ? ($itineraryCounts[Str::lower($option->name)] ?? 0) : null,
            ))
            ->all();

        return response()->json(['data' => $items]);
    }

    private function storeFor(string $type, StoreDestinationOptionRequest $request): JsonResponse
    {
        $data = $request->validated();
        $model = $this->options->modelFor($type);
        $name = $data['name'];

        $existing = $model::query()->whereRaw('LOWER(name) = ?', [Str::lower($name)])->first();

        if ($existing !== null) {
            throw ValidationException::withMessages([
                'name' => $existing->is_active
                    ? "A {$type} named \"{$existing->name}\" already exists."
                    : "A hidden {$type} named \"{$existing->name}\" already exists. Reactivate it instead of creating a duplicate.",
            ]);
        }

        $attributes = [
            'name' => $name,
            'slug' => $this->options->uniqueSlug($type, $name),
            'sort_order' => ((int) $model::query()->max('sort_order')) + 1,
            'is_active' => true,
            'is_system' => false,
        ];

        if ($type === DestinationOptionService::CATEGORY) {
            $attributes['icon'] = $data['icon'] ?? null;
            $attributes['color'] = $data['color'] ?? null;
        }

        $option = DB::transaction(fn (): Model => $model::query()->create($attributes));

        $this->options->forget();

        return response()->json([
            'data' => $this->payload($option, 0, $type === DestinationOptionService::CATEGORY ? 0 : null),
        ], 201);
    }

    private function updateFor(string $type, UpdateDestinationOptionRequest $request, Model $option): JsonResponse
    {
        $data = $request->validated();

        if ($type === DestinationOptionService::REGION) {
            unset($data['icon'], $data['color']);
        }

        $oldName = null;

        if (array_key_exists('name', $data) && $data['name'] !== $option->name) {
            $duplicate = $this->options->modelFor($type)::query()
                ->whereRaw('LOWER(name) = ?', [Str::lower($data['name'])])
                ->whereKeyNot($option->getKey())
                ->exists();

            if ($duplicate) {
                throw ValidationException::withMessages([
                    'name' => "A {$type} named \"{$data['name']}\" already exists.",
                ]);
            }

            $oldName = $option->name;
            $data['slug'] = $this->options->uniqueSlug($type, $data['name'], (int) $option->getKey());
        }

        DB::transaction(function () use ($type, $option, $data, $oldName): void {
            $option->fill($data)->save();

            if ($oldName === null || $oldName === $option->name) {
                return;
            }

            $column = $type === DestinationOptionService::CATEGORY ? 'category' : 'region';

            Destination::withTrashed()
                ->whereRaw("LOWER({$column}) = ?", [Str::lower($oldName)])
                ->update([$column => $option->name]);

            if ($type === DestinationOptionService::CATEGORY) {
                ItineraryItem::query()
                    ->whereRaw('LOWER(category) = ?', [Str::lower($oldName)])
                    ->update(['category' => $option->name]);
            }
        });

        $this->options->forget();

        $destinationCounts = $this->destinationCounts($type);
        $itineraryCounts = $type === DestinationOptionService::CATEGORY ? $this->itineraryCounts() : [];

        return response()->json([
            'data' => $this->payload(
                $option->fresh(),
                $destinationCounts[Str::lower($option->name)] ?? 0,
                $type === DestinationOptionService::CATEGORY ? ($itineraryCounts[Str::lower($option->name)] ?? 0) : null,
            ),
        ]);
    }

    private function destroyFor(string $type, Request $request, Model $option): JsonResponse
    {
        if ($option->is_system) {
            return response()->json([
                'message' => 'System options can be hidden but not deleted.',
            ], 422);
        }

        $request->validate([
            'reassign_to' => ['nullable', 'integer'],
        ]);

        $destinationCounts = $this->destinationCounts($type);
        $itineraryCounts = $type === DestinationOptionService::CATEGORY ? $this->itineraryCounts() : [];
        $key = Str::lower($option->name);
        $destinationCount = $destinationCounts[$key] ?? 0;
        $itineraryCount = $itineraryCounts[$key] ?? 0;

        $target = null;
        $reassignTo = $request->input('reassign_to');

        if ($reassignTo !== null && $reassignTo !== '') {
            $target = $this->options->modelFor($type)::query()->find((int) $reassignTo);

            if ($target === null || $target->getKey() === $option->getKey()) {
                throw ValidationException::withMessages([
                    'reassign_to' => "Choose another {$type} to move the existing records to.",
                ]);
            }
        }

        if ($target === null && ($destinationCount > 0 || $itineraryCount > 0)) {
            $usage = "{$destinationCount} ".Str::plural('destination', $destinationCount);

            if ($itineraryCount > 0) {
                $usage .= " and {$itineraryCount} ".Str::plural('itinerary stop', $itineraryCount);
            }

            return response()->json([
                'message' => "This {$type} is used by {$usage}. Hide it instead, or choose another {$type} to move them to.",
                'destinations_count' => $destinationCount,
                'itinerary_items_count' => $itineraryCount,
            ], 422);
        }

        DB::transaction(function () use ($type, $option, $target): void {
            if ($target !== null) {
                $column = $type === DestinationOptionService::CATEGORY ? 'category' : 'region';

                Destination::withTrashed()
                    ->whereRaw("LOWER({$column}) = ?", [Str::lower($option->name)])
                    ->update([$column => $target->name]);

                if ($type === DestinationOptionService::CATEGORY) {
                    ItineraryItem::query()
                        ->whereRaw('LOWER(category) = ?', [Str::lower($option->name)])
                        ->update(['category' => $target->name]);
                }
            }

            $option->delete();
        });

        $this->options->forget();

        return response()->json([
            'message' => "{$type} deleted.",
        ]);
    }

    private function reorderFor(string $type, Request $request): JsonResponse
    {
        $data = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.id' => ['required', 'integer', 'distinct'],
            'items.*.sort_order' => ['required', 'integer', 'min:0'],
        ]);

        $model = $this->options->modelFor($type);
        $ids = collect($data['items'])->pluck('id')->all();

        if ($model::query()->whereIn('id', $ids)->count() !== count($ids)) {
            throw ValidationException::withMessages([
                'items' => "One or more {$type} options no longer exist.",
            ]);
        }

        DB::transaction(function () use ($model, $data): void {
            foreach ($data['items'] as $item) {
                $model::query()
                    ->whereKey($item['id'])
                    ->update(['sort_order' => $item['sort_order']]);
            }
        });

        $this->options->forget();

        return response()->json(['message' => 'Order saved.']);
    }

    /**
     * @return array<string, int>
     */
    private function destinationCounts(string $type): array
    {
        $column = $type === DestinationOptionService::CATEGORY ? 'category' : 'region';

        return Destination::withTrashed()
            ->selectRaw("LOWER({$column}) AS option_key, COUNT(*) AS aggregate")
            ->groupByRaw("LOWER({$column})")
            ->pluck('aggregate', 'option_key')
            ->map(fn (mixed $count): int => (int) $count)
            ->all();
    }

    /**
     * @return array<string, int>
     */
    private function itineraryCounts(): array
    {
        return ItineraryItem::query()
            ->whereNotNull('category')
            ->selectRaw('LOWER(category) AS option_key, COUNT(*) AS aggregate')
            ->groupByRaw('LOWER(category)')
            ->pluck('aggregate', 'option_key')
            ->map(fn (mixed $count): int => (int) $count)
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(Model $option, int $destinationsCount, ?int $itineraryItemsCount): array
    {
        $payload = [
            'id' => $option->getKey(),
            'name' => $option->name,
            'slug' => $option->slug,
            'sort_order' => $option->sort_order,
            'is_active' => $option->is_active,
            'is_system' => $option->is_system,
            'destinations_count' => $destinationsCount,
        ];

        if ($option instanceof DestinationCategory) {
            $payload['icon'] = $option->icon;
            $payload['color'] = $option->color;
            $payload['itinerary_items_count'] = $itineraryItemsCount ?? 0;
        }

        return $payload;
    }
}
