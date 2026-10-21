<?php

namespace App\Http\Requests;

use App\Models\Review;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class UpdateReviewRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        /** @var Review $review */
        $review = $this->route('review');

        return $this->user()?->can('update', $review) ?? false;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        /** @var Review $review */
        $review = $this->route('review');
        $existing = $review->photos()->count();

        return [
            'rating' => ['sometimes', 'integer', 'between:1,5'],
            'title' => ['sometimes', 'nullable', 'string', 'max:100'],
            'body' => ['sometimes', 'string', 'min:20', 'max:2000'],
            'visited_on' => ['sometimes', 'nullable', 'date', 'before_or_equal:now'],
            'photos' => ['sometimes', 'nullable', 'array', 'max:'.Review::MAX_PHOTOS],
            'photos.*' => ['file', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
            'remove_photo_ids' => [
                'sometimes',
                'nullable',
                'array',
                function (string $attribute, mixed $value, $fail) use ($existing) {
                    $remaining = $existing - count((array) $value);
                    $adding = count((array) $this->file('photos', []));
                    if ($remaining + $adding > Review::MAX_PHOTOS) {
                        $fail('A review can have at most '.Review::MAX_PHOTOS.' photos.');
                    }
                },
            ],
            'remove_photo_ids.*' => ['integer'],
        ];
    }
}
