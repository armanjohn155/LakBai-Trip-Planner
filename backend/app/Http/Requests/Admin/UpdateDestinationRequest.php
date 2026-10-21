<?php

namespace App\Http\Requests\Admin;

use App\Models\Destination;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateDestinationRequest extends FormRequest
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
            'name' => [
                'sometimes',
                'string',
                'max:255',
                Rule::unique('destinations', 'name')->ignore($this->route('destination')),
            ],
            'description' => ['sometimes', 'string'],
            'category' => ['sometimes', 'string', Rule::in(Destination::CATEGORIES)],
            'region' => ['sometimes', 'string', Rule::in(Destination::REGIONS)],
            'municipality' => ['sometimes', 'string', 'max:255'],
            'latitude' => ['sometimes', 'numeric', 'between:-90,90'],
            'longitude' => ['sometimes', 'numeric', 'between:-180,180'],
            'radius_m' => ['sometimes', 'nullable', 'integer', 'between:30,2000'],
            'estimated_cost' => ['sometimes', 'numeric', 'min:0'],
            'image' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
            'image_url' => ['sometimes', 'nullable', 'string', 'max:500'],
            'best_time_to_visit' => ['sometimes', 'nullable', 'string', 'max:255'],
            'tips' => ['sometimes', 'nullable', 'string'],
        ];
    }
}
