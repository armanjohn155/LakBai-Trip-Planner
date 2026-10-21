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
        ];
    }
}
