<?php

namespace App\Http\Requests;

use App\Models\ItineraryItem;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CheckInRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'accuracy' => ['required', 'numeric', 'min:0', 'max:100000'],
            'itinerary_stop_id' => [
                'nullable',
                'integer',
                Rule::exists('itinerary_items', 'id')->where(
                    fn ($query) => $query->whereIn(
                        'itinerary_id',
                        ItineraryItem::query()->whereIn(
                            'itinerary_id',
                            $this->user()->itineraries()->select('id'),
                        )->select('itinerary_id'),
                    ),
                ),
            ],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
