<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

class BackfillFriendUsernamesAndCodes extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'friends:backfill';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Backfill unique usernames and friend codes for existing users';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $users = User::query()->where(function ($q) {
            $q->whereNull('username')->orWhereNull('friend_code');
        })->get();

        foreach ($users as $user) {
            if (! $user->username) {
                $base = Str::slug($user->name, '_');
                $base = strtolower(preg_replace('/[^a-z0-9_]/', '', $base) ?: 'user');
                if (strlen($base) < 3) {
                    $base = $base.'user';
                }
                $base = substr($base, 0, 12);

                $username = $base;
                $i = 0;
                while (User::where('username', $username)->where('id', '!=', $user->id)->exists()) {
                    $i++;
                    $username = substr($base, 0, 12 - strlen((string) $i)) . $i;
                }
                $user->username = $username;
            }

            if (! $user->friend_code) {
                $user->friend_code = $this->generateFriendCode($user->id);
            }

            $user->save();
        }

        $this->info('Backfilled usernames and friend codes.');

        return self::SUCCESS;
    }

    private function generateFriendCode(int $userId): string
    {
        $chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
        do {
            $code = 'LAKBAI-';
            for ($i = 0; $i < 6; $i++) {
                $code .= $chars[random_int(0, strlen($chars) - 1)];
            }
        } while (User::where('friend_code', $code)->exists());

        return $code;
    }
}
