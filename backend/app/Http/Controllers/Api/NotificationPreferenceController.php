<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\NotificationPreferenceService;
use App\Support\NotificationType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class NotificationPreferenceController extends Controller
{
    public function __construct(private readonly NotificationPreferenceService $preferences) {}

    public function index(Request $request): JsonResponse
    {
        return $this->payload($request);
    }

    public function update(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'preferences' => ['required', 'array', 'min:1'],
            'preferences.*.type' => ['required', 'string', Rule::in(NotificationType::all())],
            'preferences.*.channel' => ['required', 'string', Rule::in(NotificationType::channels())],
            'preferences.*.enabled' => ['required', 'boolean'],
        ]);

        $changes = collect($validated['preferences'])
            ->reject(fn (array $change) => $change['type'] === NotificationType::REVIEW_REPORTED && ! $user->isAdmin())
            ->values()
            ->all();

        $this->preferences->update($user, $changes);

        return $this->payload($request);
    }

    private function payload(Request $request): JsonResponse
    {
        return response()->json([
            'mail_configured' => $this->preferences->mailConfigured(),
            'channels' => NotificationType::channels(),
            'preferences' => $this->preferences->matrix($request->user()),
        ]);
    }
}
