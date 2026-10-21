<?php

namespace App\Http\Requests;

use App\Models\Destination;
use App\Models\Itinerary;
use App\Models\ItineraryItem;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreItineraryItemRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        /** @var Itinerary $itinerary */
        $itinerary = $this->route('itinerary');

        return $this->user()->can('update', $itinerary);
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
                'nullable',
                'integer',
                Rule::exists('destinations', 'id')->whereNull('deleted_at'),
                'required_without:custom_title',
            ],
            'custom_title' => ['nullable', 'string', 'max:255', 'required_without:destination_id'],
            'custom_latitude' => ['nullable', 'numeric', 'between:-90,90', 'required_with:custom_title'],
            'custom_longitude' => ['nullable', 'numeric', 'between:-180,180', 'required_with:custom_title'],
            'custom_address' => ['nullable', 'string', 'max:500'],
            'day_number' => ['nullable', 'integer', 'min:1', 'max:30'],
            'order' => ['nullable', 'integer', 'min:0'],
            'start_time' => ['nullable', 'date_format:H:i'],
            'duration_minutes' => ['nullable', 'integer', 'min:5', 'max:1440'],
            'category' => ['nullable', 'string', Rule::in($this->allowedCategories())],
            'estimated_budget' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'visited' => ['sometimes', 'boolean'],
            'status' => ['sometimes', Rule::in(ItineraryItem::STATUSES)],
        ];
    }

    /**
     * Destination categories plus the custom-stop categories.
     *
     * @return array<int, string>
     */
    private function allowedCategories(): array
    {
        return array_merge(Destination::CATEGORIES, ItineraryItem::CUSTOM_CATEGORIES);
    }
}
