<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\NotificationResource;
use App\Support\NotificationType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Validation\Rule;

class NotificationController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $validated = $request->validate([
            'unread' => ['sometimes', 'boolean'],
            'type' => ['sometimes', 'string', Rule::in(NotificationType::all())],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:50'],
        ]);

        $notifications = $request->user()
            ->notifications()
            ->when($validated['unread'] ?? false, fn ($query) => $query->whereNull('read_at'))
            ->when($validated['type'] ?? null, fn ($query, $type) => $query->where('type', $type))
            ->latest()
            ->paginate($validated['per_page'] ?? 20);

        return NotificationResource::collection($notifications);
    }

    public function unreadCount(Request $request): JsonResponse
    {
        return response()->json([
            'count' => $request->user()->unreadNotifications()->count(),
        ]);
    }

    public function read(Request $request, string $notification): NotificationResource
    {
        $record = $this->find($request, $notification);

        if ($record->read_at === null) {
            $record->markAsRead();
        }

        return new NotificationResource($record->fresh());
    }

    public function readAll(Request $request): JsonResponse
    {
        $updated = $request->user()
            ->unreadNotifications()
            ->update(['read_at' => now()]);

        return response()->json([
            'updated' => $updated,
            'count' => 0,
        ]);
    }

    public function destroy(Request $request, string $notification): Response
    {
        $this->find($request, $notification)->delete();

        return response()->noContent();
    }

    public function clearRead(Request $request): JsonResponse
    {
        $deleted = $request->user()
            ->notifications()
            ->whereNotNull('read_at')
            ->delete();

        return response()->json(['deleted' => $deleted]);
    }

    private function find(Request $request, string $notification): DatabaseNotification
    {
        return $request->user()
            ->notifications()
            ->whereKey($notification)
            ->firstOrFail();
    }
}
