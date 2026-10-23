<?php

namespace App\Http\Requests;

use App\Models\Destination;
use App\Models\ItineraryItem;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateItineraryItemRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('item'));
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'destination_id' => [
                'sometimes',
                'nullable',
                'integer',
                Rule::exists('destinations', 'id')->whereNull('deleted_at'),
            ],
            'custom_title' => ['sometimes', 'nullable', 'string', 'max:255'],
            'custom_latitude' => ['sometimes', 'nullable', 'numeric', 'between:-90,90'],
            'custom_longitude' => ['sometimes', 'nullable', 'numeric', 'between:-180,180'],
            'custom_address' => ['sometimes', 'nullable', 'string', 'max:500'],
            'day_number' => ['sometimes', 'integer', 'min:1', 'max:30'],
            'order' => ['sometimes', 'integer', 'min:0'],
            'start_time' => ['sometimes', 'nullable', 'date_format:H:i'],
            'duration_minutes' => ['sometimes', 'nullable', 'integer', 'min:5', 'max:1440'],
            'category' => ['sometimes', 'nullable', 'string', Rule::in($this->allowedCategories())],
            'estimated_budget' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'visited' => ['sometimes', 'boolean'],
            'status' => ['sometimes', Rule::in(ItineraryItem::STATUSES)],
            'base_version' => ['sometimes', 'integer', 'min:1'],
        ];
    }

    /**
     * Validate the final merged state: a stop must reference a live destination
     * or provide a custom title plus coordinates.
     *
     * @return array<int, \Closure>
     */
    public function after(): array
    {
        return [
            function ($validator) {
                if ($validator->errors()->isNotEmpty()) {
                    return;
                }

                /** @var ItineraryItem $item */
                $item = $this->route('item');

                $destinationId = $this->has('destination_id')
                    ? $this->input('destination_id')
                    : $item->destination_id;

                if ($destinationId !== null) {
                    return;
                }

                $title = $this->has('custom_title') ? $this->input('custom_title') : $item->custom_title;
                $lat = $this->has('custom_latitude') ? $this->input('custom_latitude') : $item->custom_latitude;
                $lng = $this->has('custom_longitude') ? $this->input('custom_longitude') : $item->custom_longitude;

                if (blank($title)) {
                    $validator->errors()->add('custom_title', 'A custom stop needs a title.');
                }

                if ($lat === null || $lng === null) {
                    $validator->errors()->add('custom_latitude', 'A custom stop needs coordinates.');
                }
            },
        ];
    }

    /**
     * @return array<int, string>
     */
    private function allowedCategories(): array
    {
        return array_merge(Destination::CATEGORIES, ItineraryItem::CUSTOM_CATEGORIES);
    }
}
