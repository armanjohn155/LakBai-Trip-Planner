<?php

namespace App\Http\Controllers\Api;

use App\Http\Resources\FriendshipResource;
use App\Http\Resources\FriendUserResource;
use App\Models\Friendship;
use App\Models\User;
use App\Services\FriendshipService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;

class FriendController extends Controller
{
    public function __construct(private readonly FriendshipService $service) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $user = $request->user();
        $q = trim((string) $request->query('q', ''));

        $friendships = Friendship::query()
            ->with(['requester', 'addressee'])
            ->where('status', 'accepted')
            ->where(function ($query) use ($user) {
                $query->where('requester_id', $user->id)->orWhere('addressee_id', $user->id);
            })
            ->get();

        $friends = $friendships->map(fn ($f) => $f->otherUser($user))->filter()->values();

        if ($q !== '') {
            $friends = $friends->filter(function ($f) use ($q) {
                return str_contains(strtolower($f->name), strtolower($q))
                    || ($f->username && str_contains(strtolower($f->username), strtolower($q)));
            })->values();
        }

        return FriendUserResource::collection($friends);
    }

    public function requests(Request $request): AnonymousResourceCollection
    {
        $user = $request->user();
        $direction = $request->query('direction', 'incoming');

        if (! in_array($direction, ['incoming', 'outgoing'], true)) {
            abort(422, 'The direction must be incoming or outgoing.');
        }

        if ($direction === 'outgoing') {
            $requests = Friendship::query()
                ->with(['requester', 'addressee'])
                ->where('requester_id', $user->id)
                ->where('status', 'pending')
                ->get();
        } else {
            $requests = Friendship::query()
                ->with(['requester', 'addressee'])
                ->where('addressee_id', $user->id)
                ->where('status', 'pending')
                ->get();
        }

        return FriendshipResource::collection($requests);
    }

    public function send(Request $request): JsonResponse
    {
        $this->enforceRequestThrottle($request);

        $validated = $request->validate([
            'identifier' => ['required', 'string', 'max:255'],
        ]);

        $user = $request->user();
        $identifier = trim((string) $validated['identifier']);

        $addressee = null;

        // Exact match only
        $upperIdentifier = strtoupper($identifier);
        if (str_starts_with($upperIdentifier, 'LAKBAI-')) {
            $addressee = User::query()->where('friend_code', $upperIdentifier)->first();
        } else {
            $identifierLower = strtolower($identifier);
            if (str_contains($identifierLower, '@')) {
                $addressee = User::query()->whereRaw('LOWER(email) = ?', [$identifierLower])->first();
            } else {
                $addressee = User::query()->where('username', $identifierLower)->first();
            }
        }

        if (! $addressee || $addressee->id === $user->id) {
            return response()->json([
                'message' => 'If that user exists, a request was sent.',
            ], 200);
        }

        if ($this->service->isBlockedBetween($user, $addressee)) {
            return response()->json([
                'message' => 'If that user exists, a request was sent.',
            ], 200);
        }

        try {
            $this->service->send($user, $addressee);
        } catch (ValidationException $e) {
            // Always return generic message to prevent enumeration
            return response()->json([
                'message' => 'If that user exists, a request was sent.',
            ], 200);
        }

        return response()->json([
            'message' => 'If that user exists, a request was sent.',
        ], 200);
    }

    public function accept(Request $request, Friendship $friendship): JsonResponse
    {
        $this->service->accept($request->user(), $friendship);

        return response()->json([
            'data' => (new FriendshipResource($friendship->fresh(['requester', 'addressee'])))->resolve(),
            'message' => 'Friend request accepted.',
        ]);
    }

    public function decline(Request $request, Friendship $friendship): JsonResponse
    {
        $this->service->decline($request->user(), $friendship);

        return response()->json([
            'message' => 'Friend request declined.',
        ]);
    }

    public function cancel(Request $request, Friendship $friendship): Response
    {
        $this->service->cancel($request->user(), $friendship);

        return response()->noContent();
    }

    public function unfriend(Request $request, User $user): Response
    {
        $this->service->unfriend($request->user(), $user);

        return response()->noContent();
    }

    public function block(Request $request, User $user): JsonResponse
    {
        $friendship = $this->service->block($request->user(), $user);

        return response()->json([
            'data' => (new FriendshipResource($friendship->fresh(['requester', 'addressee'])))->resolve(),
            'message' => 'User blocked.',
        ]);
    }

    public function unblock(Request $request, User $user): Response
    {
        $this->service->unblock($request->user(), $user);

        return response()->noContent();
    }

    public function blocked(Request $request): AnonymousResourceCollection
    {
        $user = $request->user();

        $blocks = Friendship::query()
            ->with(['requester', 'addressee'])
            ->where('status', 'blocked')
            ->where('requester_id', $user->id)
            ->get();

        return FriendshipResource::collection($blocks);
    }

    public function friendCode(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'data' => [
                'friend_code' => $user->friend_code,
                'friend_code_regenerated_at' => $user->friend_code_regenerated_at,
            ],
        ]);
    }

    public function regenerateFriendCode(Request $request): JsonResponse
    {
        $this->enforceCodeRegenThrottle($request);
        $user = $request->user();

        $user->friend_code = User::generateFriendCode($user->id);
        $user->friend_code_regenerated_at = now();
        $user->save();

        return response()->json([
            'data' => [
                'friend_code' => $user->friend_code,
                'friend_code_regenerated_at' => $user->friend_code_regenerated_at,
            ],
            'message' => 'Friend code regenerated.',
        ]);
    }

    private function enforceRequestThrottle(Request $request): void
    {
        $key = 'friend-request:'.$request->user()->id;
        $throttle = config('lakbai.friends.request_throttle', '15,1');
        [$max, $decay] = array_map('intval', explode(',', $throttle));
        if (RateLimiter::tooManyAttempts($key, $max)) {
            abort(429, 'Too many attempts. Please try again later.');
        }
        RateLimiter::hit($key, $decay * 60);
    }

    private function enforceCodeRegenThrottle(Request $request): void
    {
        $key = 'friend-code-regen:'.$request->user()->id;
        $throttle = config('lakbai.friends.friend_code_regen_throttle', '5,1');
        [$max, $decay] = array_map('intval', explode(',', $throttle));
        if (RateLimiter::tooManyAttempts($key, $max)) {
            abort(429, 'Too many attempts. Please try again later.');
        }
        RateLimiter::hit($key, $decay * 60);
    }
}
