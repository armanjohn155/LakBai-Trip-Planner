<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['user_id', 'email_reminders', 'digest', 'marketing'])]
class UserSettings extends Model
{
    /**
     * Get the owner of these settings.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * The attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_reminders' => 'boolean',
            'digest' => 'boolean',
            'marketing' => 'boolean',
        ];
    }
}
