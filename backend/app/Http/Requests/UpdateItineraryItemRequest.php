<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

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
            'destination_id' => ['sometimes', 'integer', 'exists:destinations,id'],
            'day_number' => ['sometimes', 'nullable', 'integer', 'min:1'],
            'order' => ['sometimes', 'nullable', 'integer', 'min:0'],
            'estimated_budget' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'notes' => ['sometimes', 'nullable', 'string'],
            'visited' => ['sometimes', 'boolean'],
        ];
    }
}
