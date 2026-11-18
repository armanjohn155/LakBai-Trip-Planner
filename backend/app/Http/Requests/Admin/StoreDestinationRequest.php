<?php

namespace App\Http\Requests\Admin;

use App\Rules\ActiveDestinationOption;
use App\Services\DestinationOptionService;
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
            'category' => ['required', 'string', new ActiveDestinationOption(DestinationOptionService::CATEGORY)],
            'region' => ['required', 'string', new ActiveDestinationOption(DestinationOptionService::REGION)],
            'municipality' => ['required', 'string', 'max:255'],
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'radius_m' => ['nullable', 'integer', 'between:30,2000'],
            'estimated_cost' => ['required', 'numeric', 'min:0', 'max:99999999.99'],
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
     * Friendlier messages for the nested array rules admins actually hit.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'images.*.max' => 'Each photo must be 2 MB or smaller.',
            'images.*.mimes' => 'Photos must be JPG, PNG, or WebP files.',
            'images.*.uploaded' => 'One of the photos could not be uploaded. Check that it is 2 MB or smaller.',
            'images.*.file' => 'One of the photos could not be uploaded. Check that it is 2 MB or smaller.',
            'gallery.*.max' => 'Each gallery image URL must be 500 characters or fewer.',
            'highlights.*.max' => 'Each highlight must be 40 characters or fewer.',
            'how_to_get_there.*.route.max' => 'Each transport route must be 255 characters or fewer.',
            'travel_tips.*.max' => 'Each travel tip must be 500 characters or fewer.',
            'estimated_cost.required' => 'Estimated cost is required. Enter 0 if the destination is free.',
            'estimated_cost.numeric' => 'Estimated cost must be a single number, e.g. 500 or 500.00. Put ranges like "300-850" in the entrance fee field.',
            'estimated_cost.max' => 'Estimated cost is too large.',
        ];
    }

    /**
     * Prepare the data for validation.
     */
    protected function prepareForValidation(): void
    {
        // destinations.estimated_cost is a decimal column, so accept the ways
        // people actually type money ("₱500", "PHP 1,200", "500.00") instead
        // of letting PostgreSQL reject the value with a 500.
        $this->normalizeEstimatedCost();

        // Canonicalize the option-backed fields so the stored value always
        // matches the category/region table casing.
        $options = app(DestinationOptionService::class);
        $optionFields = [];

        foreach ([DestinationOptionService::CATEGORY, DestinationOptionService::REGION] as $field) {
            if (! is_string($this->input($field))) {
                continue;
            }

            $name = $options->normalizeName($this->input($field));
            $optionFields[$field] = $options->canonicalName($field, $name) ?? $name;
        }

        if (! empty($optionFields)) {
            $this->merge($optionFields);
        }

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

        // The admin form posts array fields (highlights, how_to_get_there,
        // travel_tips) as JSON strings via FormData. Decode them back to
        // PHP arrays so the `array` validation rule passes.
        $arrayFields = ['highlights', 'how_to_get_there', 'travel_tips'];
        foreach ($arrayFields as $field) {
            if ($this->has($field) && is_string($this->input($field))) {
                $decoded = json_decode($this->input($field), true);
                if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                    $this->merge([$field => $decoded]);
                }
            }
        }
    }

    /**
     * Strip currency symbols and thousands separators from the cost so the
     * `numeric` rule decides what is valid, not the database driver.
     */
    private function normalizeEstimatedCost(): void
    {
        $value = $this->input('estimated_cost');

        if (! is_string($value)) {
            return;
        }

        $cleaned = str_replace(['₱', 'PHP', 'Php', 'php', ',', ' '], '', trim($value));

        if ($cleaned !== '' && $cleaned !== $value) {
            $this->merge(['estimated_cost' => $cleaned]);
        }
    }
}
