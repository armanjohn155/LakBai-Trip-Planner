<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\ItineraryResource;
use App\Models\Itinerary;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ItineraryTemplateController extends Controller
{
    /**
     * Mark any itinerary as an admin-curated template (or update its key).
     *
     * Resolved without the owner scope on purpose: admins curate templates
     * that may have originated from another account.
     */
    public function store(Request $request, int $itinerary): ItineraryResource
    {
        $validated = $request->validate([
            'template_key' => ['nullable', 'string', 'max:255'],
            'cover_image_url' => ['nullable', 'string', 'max:2048'],
        ]);

        /** @var Itinerary $model */
        $model = Itinerary::query()->findOrFail($itinerary);

        $model->update([
            'is_template' => true,
            'template_key' => $validated['template_key'] ?? $model->template_key ?? Str::slug($model->title),
            'cover_image_url' => $validated['cover_image_url'] ?? $model->cover_image_url,
        ]);

        return new ItineraryResource($model->loadForDisplay($request->user()));
    }

    /**
     * Un-mark an itinerary as a template.
     */
    public function destroy(int $itinerary): ItineraryResource
    {
        /** @var Itinerary $model */
        $model = Itinerary::query()->findOrFail($itinerary);

        $model->update(['is_template' => false, 'template_key' => null]);

        return new ItineraryResource($model->loadForDisplay(null));
    }
}
