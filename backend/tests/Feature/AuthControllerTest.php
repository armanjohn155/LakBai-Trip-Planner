<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AuthControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_registers_user_and_returns_token(): void
    {
        $response = $this->postJson('/api/register', [
            'name' => 'Jane Doe',
            'email' => 'jane@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
        ]);

        $response->assertCreated()
            ->assertJsonStructure(['user' => ['id', 'name', 'email'], 'token']);

        $this->assertDatabaseHas('users', ['email' => 'jane@example.com']);
        $this->assertTrue(Hash::check('password', User::where('email', 'jane@example.com')->value('password')));
    }

    public function test_registration_rejects_duplicate_email(): void
    {
        User::factory()->create(['email' => 'jane@example.com']);

        $this->postJson('/api/register', [
            'name' => 'Jane',
            'email' => 'jane@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('email');
    }

    public function test_registration_requires_password_confirmation(): void
    {
        $this->postJson('/api/register', [
            'name' => 'Jane',
            'email' => 'jane@example.com',
            'password' => 'password',
        ], )->assertUnprocessable()->assertJsonValidationErrors('password');
    }

    public function test_login_returns_token_for_valid_credentials(): void
    {
        $user = User::factory()->create([
            'email' => 'jane@example.com',
            'password' => Hash::make('password'),
        ]);

        $response = $this->postJson('/api/login', [
            'email' => 'jane@example.com',
            'password' => 'password',
        ]);

        $response->assertOk()
            ->assertJsonStructure(['user', 'token']);
    }

    public function test_login_rejects_invalid_credentials(): void
    {
        User::factory()->create([
            'email' => 'jane@example.com',
            'password' => Hash::make('password'),
        ]);

        $this->postJson('/api/login', [
            'email' => 'jane@example.com',
            'password' => 'wrong-password',
        ])->assertUnprocessable()->assertJsonValidationErrors('email');
    }

    public function test_user_endpoint_returns_401_when_no_token_is_provided(): void
    {
        $this->getJson('/api/user')->assertUnauthorized();
    }

    public function test_user_endpoint_returns_authenticated_user(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->getJson('/api/user')
            ->assertOk()
            ->assertJsonPath('user.email', $user->email);
    }

    public function test_logout_revokes_current_token(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('api')->plainTextToken;

        $this->withToken($token)
            ->postJson('/api/logout')
            ->assertOk();

        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_logout_returns_401_when_no_token_is_provided(): void
    {
        $this->postJson('/api/logout')->assertUnauthorized();
    }
}
