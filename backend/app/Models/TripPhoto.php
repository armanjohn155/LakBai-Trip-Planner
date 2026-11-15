<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Storage;

#[Fillable([
    'itinerary_id',
    'itinerary_item_id',
    'user_id',
    'path',
    'caption',
    'taken_at',
    'position',
    'is_hidden',
])]
class TripPhoto extends Model
{
    use SoftDeletes;

    public const DISK = 'public';

    public const MAX_PER_USER = 20;

    protected function casts(): array
    {
        return [
            'itinerary_item_id' => 'integer',
            'taken_at' => 'datetime',
            'position' => 'integer',
            'is_hidden' => 'boolean',
        ];
    }

    public function itinerary(): BelongsTo
    {
        return $this->belongsTo(Itinerary::class);
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(ItineraryItem::class, 'itinerary_item_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function absoluteUrl(): string
    {
        return asset('storage/'.ltrim($this->path, '/'));
    }

    public function thumbnailPath(): string
    {
        $directory = dirname($this->path);

        if ($directory === '.' || $directory === '') {
            return 'thumbs/'.basename($this->path);
        }

        return $directory.'/thumbs/'.basename($this->path);
    }

    public function thumbnailUrl(): string
    {
        return asset('storage/'.ltrim($this->thumbnailPath(), '/'));
    }

    public function discardFiles(): void
    {
        $disk = Storage::disk(self::DISK);
        $disk->delete([$this->path, $this->thumbnailPath()]);
    }
}
