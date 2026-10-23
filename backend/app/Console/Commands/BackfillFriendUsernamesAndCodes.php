<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;

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
                $user->username = User::generateUsername($user->name, $user->id);
            }

            if (! $user->friend_code) {
                $user->friend_code = User::generateFriendCode($user->id);
            }

            $user->save();
        }

        $this->info('Backfilled usernames and friend codes.');

        return self::SUCCESS;
    }
}
