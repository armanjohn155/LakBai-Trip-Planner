<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use RuntimeException;

class AdminSeeder extends Seeder
{
    /**
     * Create the administrator account from the ADMIN_EMAIL / ADMIN_PASSWORD
     * environment variables. Credentials are never hardcoded.
     */
    public function run(): void
    {
        $email = config('admin.email');
        $password = config('admin.password');
        $name = config('admin.name');

        if (! is_string($email) || $email === '' || ! is_string($password) || $password === '') {
            throw new RuntimeException(
                'ADMIN_EMAIL and ADMIN_PASSWORD must be set before seeding the administrator account. '
                .'Add them to your .env file and run `php artisan config:clear`.'
            );
        }

        $user = User::firstOrNew(['email' => $email]);
        $user->forceFill([
            'name' => is_string($name) && $name !== '' ? $name : ($user->exists ? $user->name : 'Administrator'),
            'password' => $password,
            'role' => 'admin',
        ]);
        $user->save();

        $this->command?->info("Admin account ready: {$email}");
    }
}
