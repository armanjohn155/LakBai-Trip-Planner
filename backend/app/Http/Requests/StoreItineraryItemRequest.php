<?php

namespace App\Http\Requests;

use App\Models\Itinerary;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

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
            'destination_id' => ['required', 'integer', 'exists:destinations,id'],
            'day_number' => ['nullable', 'integer', 'min:1'],
            'order' => ['nullable', 'integer', 'min:0'],
            'estimated_budget' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string'],
            'visited' => ['sometimes', 'boolean'],
        ];
    }
}
