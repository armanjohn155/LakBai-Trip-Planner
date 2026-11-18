<?php

namespace App\Rules;

use App\Models\DestinationCategory;
use App\Models\DestinationRegion;
use App\Services\DestinationOptionService;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Support\Str;

/**
 * Ensures a destination category or region exists and is visible in the
 * dropdowns. On update, the destination's currently stored value is accepted
 * even when the option has been hidden, so old records stay saveable.
 */
class ActiveDestinationOption implements ValidationRule
{
    public function __construct(
        private readonly string $type,
        private readonly ?string $currentValue = null,
    ) {}

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value) || trim($value) === '') {
            $fail($this->message());

            return;
        }

        $model = $this->type === DestinationOptionService::CATEGORY
            ? DestinationCategory::class
            : DestinationRegion::class;

        $option = $model::query()
            ->whereRaw('LOWER(name) = ?', [Str::lower($value)])
            ->first();

        if ($option === null) {
            $fail($this->message());

            return;
        }

        if ($option->is_active) {
            return;
        }

        $isCurrentValue = $this->currentValue !== null
            && Str::lower($this->currentValue) === Str::lower($value);

        if (! $isCurrentValue) {
            $fail("That {$this->type} is hidden. Choose an active {$this->type} or reactivate it from the manage screen.");
        }
    }

    private function message(): string
    {
        return "Choose an existing {$this->type} from the list.";
    }
}
