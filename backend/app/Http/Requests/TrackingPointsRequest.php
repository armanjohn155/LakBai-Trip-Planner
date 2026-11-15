<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class TrackingPointsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * Accept either a bare array [{lat,lng,...}] or {points: [...]}.
     */
    protected function prepareForValidation(): void
    {
        $input = $this->all();

        if (array_is_list($input)) {
            $this->replace(['points' => $input]);
        }
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $max = (int) config('lakbai.tracking.batch_max', 50);

        return [
            'points' => ['required', 'array', 'min:1', "max:{$max}"],
            'points.*.lat' => ['required', 'numeric', 'between:-90,90'],
            'points.*.lng' => ['required', 'numeric', 'between:-180,180'],
            'points.*.accuracy' => ['nullable', 'numeric', 'min:0', 'max:100000'],
            'points.*.speed' => ['nullable', 'numeric', 'min:0', 'max:1000'],
            'points.*.heading' => ['nullable', 'numeric', 'min:0', 'max:360'],
            'points.*.recorded_at' => ['required', 'date'],
        ];
    }
}
