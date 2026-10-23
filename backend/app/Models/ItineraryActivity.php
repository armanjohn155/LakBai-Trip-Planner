<?php

namespace App\Models;

<<<<<<< HEAD
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

#[Fillable([
    'itinerary_id',
    'user_id',
    'action',
    'subject_type',
    'subject_id',
    'meta',
])]
class ItineraryActivity extends Model
{
    public const UPDATED_AT = null;
=======
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
>>>>>>> origin/main

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
<<<<<<< HEAD

    public function subject(): MorphTo
    {
        return $this->morphTo();
    }
=======
>>>>>>> origin/main
}
