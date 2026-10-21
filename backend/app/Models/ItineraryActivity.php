<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ItineraryActivity extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'itinerary_id',
        'user_id',
        'action',
        'subject_type',
        'subject_id',
        'meta',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'meta' => 'array',
            'created_at' => 'datetime',
        ];
    }

    public function itinerary(): BelongsTo
    {
        return $this->belongsTo(Itinerary::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
