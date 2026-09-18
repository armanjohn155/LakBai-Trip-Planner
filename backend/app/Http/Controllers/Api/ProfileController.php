<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\DeleteAccountRequest;
use App\Http\Requests\UpdatePasswordRequest;
use App\Http\Requests\UpdateProfileRequest;
use App\Http\Requests\UpdateSettingsRequest;
use App\Models\UserSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class ProfileController extends Controller
{
    /**
     * Update the authenticated user's profile.
     */
    public function update(UpdateProfileRequest $request): JsonResponse
    {
        $user = $request->user();
        $user->update($request->safe()->only(['name', 'email']));

        return response()->json(['user' => $user->fresh()->loadMissing('settings')]);
    }

    /**
     * Upload a profile photo for the authenticated user.
     */
    public function avatar(Request $request): JsonResponse
    {
        $request->validate([
            'avatar' => ['required', 'image', 'mimes:jpeg,png', 'max:2048'],
        ], [
            'avatar.mimes' => 'The avatar must be a JPG or PNG file.',
            'avatar.max' => 'The avatar must not be larger than 2 MB.',
        ]);

        $user = $request->user();
        $path = $request->file('avatar')->store('avatars', 'public');
        $url = '/storage/'.ltrim($path, '/');

        if ($user->avatar_url) {
            Storage::disk('public')->delete('avatars/'.basename($user->avatar_url));
        }

        $user->update(['avatar_url' => $url]);

        return response()->json(['user' => $user->fresh()->loadMissing('settings')]);
    }

    /**
     * Change the authenticated user's password.
     */
    public function password(UpdatePasswordRequest $request): JsonResponse
    {
        $user = $request->user();

        if (! Hash::check($request->input('current_password'), $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['The current password is incorrect.'],
            ]);
        }

        $user->update(['password' => $request->input('password')]);

        return response()->json(['message' => 'Password updated.']);
    }

    /**
     * Return the authenticated user's settings, creating defaults when missing.
     */
    public function settings(Request $request): JsonResponse
    {
        $settings = $this->settingsFor($request->user());

        return response()->json(['data' => $settings]);
    }

    /**
     * Update the authenticated user's settings.
     */
    public function updateSettings(UpdateSettingsRequest $request): JsonResponse
    {
        $settings = $this->settingsFor($request->user());
        $settings->update($request->safe()->only(['email_reminders', 'digest', 'marketing']));

        return response()->json(['data' => $settings->fresh()]);
    }

    /**
     * Permanently delete the authenticated user's account.
     */
    public function destroy(DeleteAccountRequest $request): JsonResponse
    {
        $user = $request->user();

        if (! Hash::check($request->input('password'), $user->password)) {
            throw ValidationException::withMessages([
                'password' => ['The password is incorrect.'],
            ]);
        }

        $user->tokens()->delete();
        $user->delete();

        return response()->json(['message' => 'Account deleted.'], 200);
    }

    /**
     * Return the user's settings, creating defaults when missing.
     */
    private function settingsFor($user): UserSettings
    {
        return $user->settings()->firstOrCreate()->refresh();
    }
}
