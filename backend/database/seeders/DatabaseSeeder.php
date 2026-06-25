<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        DB::table('users')->updateOrInsert(
            ['id' => 1],
            [
                'name' => env('ADMIN_NAME', 'Administrator'),
                'username' => env('ADMIN_USERNAME', 'admin'),
                'email' => env('ADMIN_EMAIL', 'admin@example.com'),
                'password' => Hash::make(env('ADMIN_INITIAL_PASSWORD', 'ChangeMe123!')),
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        DB::table('company_settings')->updateOrInsert(
            ['id' => 1],
            [
                'name' => env('APP_NAME', 'ProBuild App'),
                'address' => env('COMPANY_ADDRESS', ''),
                'contact' => env('COMPANY_CONTACT', ''),
                'email' => env('COMPANY_EMAIL', env('ADMIN_EMAIL', 'admin@gmail.com')),
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        $categories = config('probuild.materials_categories', []);

        DB::table('categories')
            ->whereNotIn('name', array_column($categories, 'name'))
            ->delete();

        foreach ($categories as $category) {
            DB::table('categories')->updateOrInsert(
                ['name' => $category['name']],
                [
                    'description' => $category['description'],
                    'status' => 'Active',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
        }

        foreach ([
            'daily_expense_categories',
            'project_statuses',
            'unit_categories',
        ] as $listKey) {
            DB::table('system_reference_lists')->updateOrInsert(
                ['key' => $listKey],
                [
                    'items' => json_encode(array_map(
                        fn ($name) => ['name' => $name, 'status' => 'Active'],
                        config("probuild.{$listKey}", [])
                    ), JSON_UNESCAPED_UNICODE),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
        }
    }
}
