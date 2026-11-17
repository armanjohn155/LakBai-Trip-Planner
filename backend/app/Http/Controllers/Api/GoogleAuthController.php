<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use League\OAuth2\Client\Provider\Exception\IdentityProviderException;
use League\OAuth2\Client\Provider\GenericProvider;

class GoogleAuthController extends Controller
{
    private const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

    private const TOKEN_URL = 'https://oauth2.googleapis.com/token';

    private const USERINFO_URL = 'https://www.googleapis.com/oauth2/v1/userinfo';

    /**
     * Redirect the user to Google's OAuth consent screen.
     *
     * `prompt=select_account` forces Google to always show the account
     * chooser (including "Use another account") instead of silently
     * reusing the last signed-in account.
     */
    public function redirect(): RedirectResponse
    {
        $config = config('google');

        if (! $config['client_id'] || ! $config['client_secret']) {
            return $this->failure('Google sign-in is not configured. Please contact support.');
        }

        $authUrl = $this->provider($config)->getAuthorizationUrl([
            'scope' => $config['scopes'],
            'access_type' => 'online',
            'prompt' => 'select_account',
            // league/oauth2-client defaults to `approval_prompt=auto`, which
            // Google rejects when `prompt` is also present. Null removes it.
            'approval_prompt' => null,
        ]);

        Log::debug('Google OAuth authorization URL generated.', ['url' => $authUrl]);

        return redirect($authUrl);
    }

    /**
     * Handle the Google OAuth callback.
     *
     * Flow:
     * 1. Exchange the authorization code for an access token.
     * 2. Fetch the authenticated user's profile from Google.
     * 3. If google_id exists -> log them in.
     * 4. Else if email exists -> link google_id to that account.
     * 5. Else -> create a new user (password = null).
     * 6. Generate a Sanctum token (same as email/password login).
     * 7. Redirect to the frontend callback with the token.
     */
    public function callback(Request $request): RedirectResponse
    {
        $config = config('google');

        if ($request->filled('error')) {
            $message = $request->input('error') === 'access_denied'
                ? 'Google sign-in was cancelled.'
                : $request->input('error_description', 'Google sign-in was cancelled.');

            return $this->failure($message);
        }

        if (! $request->has('code')) {
            return $this->failure('No authorization code received from Google.');
        }

        $provider = $this->provider($config);

        try {
            $accessToken = $provider->getAccessToken('authorization_code', [
                'code' => $request->input('code'),
            ]);
            $googleUser = $provider->getResourceOwner($accessToken);
        } catch (IdentityProviderException $e) {
            return $this->failure('Google authentication failed: '.$e->getMessage());
        }

        $profile = $googleUser->toArray();
        $googleId = (string) $googleUser->getId();
        $email = $profile['email'] ?? null;
        $name = $profile['name'] ?? $email;
        $avatar = $profile['picture'] ?? null;

        if (! $email) {
            return $this->failure('Google account has no email address.');
        }

        $user = User::where('google_id', $googleId)->first();

        if (! $user) {
            $user = User::where('email', $email)->first();

            if ($user) {
                // Link existing account to Google
                $user->update([
                    'google_id' => $googleId,
                    'avatar_url' => $avatar ?: $user->avatar_url,
                ]);
            } else {
                // Create new user
                $user = User::create([
                    'name' => $name,
                    'email' => $email,
                    'google_id' => $googleId,
                    'avatar_url' => $avatar,
                    'password' => null,
                    'email_verified_at' => now(),
                    'username' => User::generateUsername($name),
                    'friend_code' => User::generateFriendCode(),
                    'friend_code_regenerated_at' => now(),
                ]);
            }
        } else {
            // Update avatar if Google provides one and user doesn't have one
            if ($avatar && ! $user->avatar_url) {
                $user->update(['avatar_url' => $avatar]);
            }
        }

        $token = $user->createToken('api')->plainTextToken;

        return redirect($config['frontend_callback'].'?token='.urlencode($token));
    }

    /**
     * Log out the current user and revoke their Google-linked token.
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out.']);
    }

    /**
     * Build a Google OAuth provider using Google's documented endpoints.
     *
     * @param  array<string, mixed>  $config
     */
    private function provider(array $config): GenericProvider
    {
        return new GenericProvider([
            'clientId' => $config['client_id'],
            'clientSecret' => $config['client_secret'],
            'redirectUri' => $config['redirect'],
            'urlAuthorize' => self::AUTHORIZE_URL,
            'urlAccessToken' => self::TOKEN_URL,
            'urlResourceOwnerDetails' => self::USERINFO_URL,
            // Google requires space-delimited scopes (`%20`), not commas.
            'scopeSeparator' => ' ',
        ]);
    }

    /**
     * Send the user back to the frontend callback with a friendly error.
     */
    private function failure(string $message): RedirectResponse
    {
        return redirect(config('google.frontend_callback').'?error='.urlencode($message));
    }
}
