<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ProfileControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_guest_cannot_update_profile(): void
    {
        $this->putJson('/api/user', ['name' => 'New Name', 'email' => 'new@example.com'])->assertUnauthorized();
    }

    public function test_user_can_update_profile(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->putJson('/api/user', ['name' => 'New Name', 'email' => 'new@example.com'])
            ->assertOk()
            ->assertJsonPath('user.name', 'New Name')
            ->assertJsonPath('user.email', 'new@example.com');

        $this->assertDatabaseHas('users', ['id' => $user->id, 'name' => 'New Name', 'email' => 'new@example.com']);
    }

    public function test_user_cannot_update_email_to_one_in_use(): void
    {
        $other = User::factory()->create(['email' => 'taken@example.com']);
        $user = User::factory()->create();

        $this->actingAs($user)
            ->putJson('/api/user', ['name' => $user->name, 'email' => 'taken@example.com'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('email');

        $this->assertDatabaseHas('users', ['id' => $user->id, 'email' => $user->email]);
    }

    public function test_user_can_upload_an_avatar(): void
    {
        Storage::fake('public');
        $user = User::factory()->create();

        $this->actingAs($user)
            ->postJson('/api/user/avatar', [
                'avatar' => UploadedFile::fake()->image('avatar.jpg', 100, 100),
            ], ['Content-Type' => 'multipart/form-data'])
            ->assertOk()
            ->assertJsonPath('user.avatar_url', fn ($value) => is_string($value) && str_contains($value, '/storage/avatars/'));

        $this->assertNotNull($user->fresh()->avatar_url);
        Storage::disk('public')->assertExists('avatars/'.basename($user->fresh()->avatar_url));
    }

    public function test_avatar_upload_rejects_invalid_files(): void
    {
        Storage::fake('public');
        $user = User::factory()->create();

        $this->actingAs($user)
            ->postJson('/api/user/avatar', [
                'avatar' => UploadedFile::fake()->create('notes.txt', 10),
            ], ['Content-Type' => 'multipart/form-data'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('avatar');

        Storage::disk('public')->assertDirectoryEmpty('avatars');
    }

    public function test_user_can_change_password(): void
    {
        $user = User::factory()->create(['password' => 'current-password']);

        $this->actingAs($user)
            ->postJson('/api/user/password', [
                'current_password' => 'current-password',
                'password' => 'new-password',
                'password_confirmation' => 'new-password',
            ])
            ->assertOk()
            ->assertJsonPath('message', 'Password updated.');

        $this->assertTrue(Hash::check('new-password', $user->fresh()->password));
    }

    public function test_password_change_requires_correct_current_password(): void
    {
        $user = User::factory()->create(['password' => 'current-password']);

        $this->actingAs($user)
            ->postJson('/api/user/password', [
                'current_password' => 'wrong-password',
                'password' => 'new-password',
                'password_confirmation' => 'new-password',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('current_password');

        $this->assertTrue(Hash::check('current-password', $user->fresh()->password));
    }

    public function test_settings_return_defaults_when_missing(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->getJson('/api/user/settings')
            ->assertOk()
            ->assertJsonPath('data.email_reminders', true)
            ->assertJsonPath('data.digest', true)
            ->assertJsonPath('data.marketing', false);
    }

    public function test_user_can_update_settings(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->putJson('/api/user/settings', [
                'email_reminders' => false,
                'digest' => true,
                'marketing' => true,
            ])
            ->assertOk()
            ->assertJsonPath('data.email_reminders', false)
            ->assertJsonPath('data.marketing', true);

        $this->assertDatabaseHas('user_settings', [
            'user_id' => $user->id,
            'email_reminders' => false,
            'marketing' => true,
        ]);
    }

    public function test_user_can_delete_account_with_password(): void
    {
        $user = User::factory()->create(['password' => 'current-password']);
        $user->settings()->create();

        $this->actingAs($user)
            ->deleteJson('/api/user', ['password' => 'current-password'])
            ->assertOk()
            ->assertJsonPath('message', 'Account deleted.');

        $this->assertDatabaseMissing('users', ['id' => $user->id]);
        $this->assertDatabaseMissing('user_settings', ['user_id' => $user->id]);
        $this->assertDatabaseMissing('personal_access_tokens', ['tokenable_id' => $user->id]);
    }

    public function test_delete_account_requires_current_password(): void
    {
        $user = User::factory()->create(['password' => 'current-password']);

        $this->actingAs($user)
            ->deleteJson('/api/user', ['password' => 'wrong-password'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('password');

        $this->assertDatabaseHas('users', ['id' => $user->id]);
    }

    public function test_user_endpoint_includes_settings_and_avatar(): void
    {
        $user = User::factory()->create();
        $user->settings()->create();

        $this->actingAs($user)
            ->getJson('/api/user')
            ->assertOk()
            ->assertJsonPath('user.email', $user->email)
            ->assertJsonPath('user.settings.digest', true)
            ->assertJsonPath('user.avatar_url', fn ($value) => $value === null);
    }
}
