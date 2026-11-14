<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'tracking_session_id',
    'lat',
    'lng',
    'accuracy_m',
    'speed_mps',
    'recorded_at',
])]
class TrackingPoint extends Model
{
    protected function casts(): array
    {
        return [
            'lat' => 'decimal:7',
            'lng' => 'decimal:7',
            'accuracy_m' => 'integer',
            'speed_mps' => 'decimal:2',
            'recorded_at' => 'datetime',
        ];
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(TrackingSession::class, 'tracking_session_id');
    }
}
