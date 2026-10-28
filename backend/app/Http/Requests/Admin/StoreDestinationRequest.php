<?php

namespace App\Http\Requests\Admin;

use App\Models\Destination;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreDestinationRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user()?->isAdmin() ?? false;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, Rule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255', Rule::unique('destinations', 'name')],
            'description' => ['required', 'string'],
            'category' => ['required', 'string', Rule::in(Destination::CATEGORIES)],
            'region' => ['required', 'string', Rule::in(Destination::REGIONS)],
            'municipality' => ['required', 'string', 'max:255'],
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'radius_m' => ['nullable', 'integer', 'between:30,2000'],
            'estimated_cost' => ['required', 'numeric', 'min:0'],
            'image' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
            'image_url' => ['nullable', 'string', 'max:500'],
            'best_time_to_visit' => ['nullable', 'string', 'max:255'],
            'tips' => ['nullable', 'string'],
            // New fields
            'highlights' => ['nullable', 'array', 'max:12'],
            'highlights.*' => ['string', 'max:40'],
            'entrance_fee_text' => ['nullable', 'string', 'max:255'],
            'visit_duration' => ['nullable', 'string', 'max:255'],
            'opening_hours' => ['nullable', 'string', 'max:255'],
            'how_to_get_there' => ['nullable', 'array', 'max:10'],
            'how_to_get_there.*.mode' => ['nullable', 'string', 'max:50'],
            'how_to_get_there.*.route' => ['nullable', 'string', 'max:255'],
            'how_to_get_there.*.duration' => ['nullable', 'string', 'max:255'],
            'how_to_get_there.*.price_text' => ['nullable', 'string', 'max:255'],
            'travel_tips' => ['nullable', 'array', 'max:15'],
            'travel_tips.*' => ['string', 'max:500'],
            'gallery' => ['nullable', 'array', 'max:8'],
            'gallery.*' => ['string', 'max:500'],
            // Multiple image uploads
            'images' => ['nullable', 'array', 'max:8'],
            'images.*' => ['file', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
            'cover_index' => ['nullable', 'integer', 'min:0'],
        ];
    }

    /**
     * Prepare the data for validation.
     */
    protected function prepareForValidation(): void
    {
        // Strip HTML tags from text fields if present
        $textFields = ['name', 'description', 'municipality', 'best_time_to_visit', 'tips', 'entrance_fee_text', 'visit_duration', 'opening_hours'];
        $sanitized = [];
        foreach ($textFields as $field) {
            if ($this->has($field) && is_string($this->input($field))) {
                $sanitized[$field] = strip_tags($this->input($field));
            }
        }
        if (! empty($sanitized)) {
            $this->merge($sanitized);
        }
    }
}
