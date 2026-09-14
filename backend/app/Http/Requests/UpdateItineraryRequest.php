<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class UpdateItineraryRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('itinerary'));
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'title' => ['sometimes', 'string', 'max:255'],
            'start_date' => ['sometimes', 'nullable', 'date'],
            'end_date' => ['sometimes', 'nullable', 'date'],
            'budget' => ['sometimes', 'nullable', 'numeric', 'min:0'],
        ];
    }

    /**
     * Validate cross-field date constraints after base rules.
     *
     * @return array<int, \Closure>
     */
    public function after(): array
    {
        return [
            function ($validator) {
                if ($validator->errors()->hasAny(['start_date', 'end_date'])) {
                    return;
                }

                $start = $this->date('start_date');
                $end = $this->date('end_date');

                if ($start && $end && $end->lt($start)) {
                    $validator->errors()->add('end_date', 'The end date must be on or after the start date.');
                }
            },
        ];
    }
}
