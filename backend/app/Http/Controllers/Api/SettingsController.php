<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SettingsController extends Controller
{
    public function companyProfile(): JsonResponse
    {
        $settings = DB::table('company_settings')->where('id', 1)->first();

        if (! $settings) {
            return response()->json([
                'name' => 'ProBuild App',
                'address' => '',
                'contact' => '',
                'email' => '',
            ]);
        }

        return response()->json([
            'name' => $settings->name,
            'address' => $settings->address,
            'contact' => $settings->contact,
            'email' => $settings->email,
        ]);
    }

    public function updateCompanyProfile(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string'],
            'address' => ['nullable', 'string'],
            'contact' => ['nullable', 'string'],
            'email' => ['nullable', 'email'],
        ]);

        DB::table('company_settings')->updateOrInsert(
            ['id' => 1],
            [
                'name' => $data['name'],
                'address' => $data['address'] ?? null,
                'contact' => $data['contact'] ?? null,
                'email' => $data['email'] ?? null,
                'updated_at' => now(),
                'created_at' => now(),
            ]
        );

        return response()->json(['ok' => true]);
    }

    public function adminAccount(): JsonResponse
    {
        $user = User::query()->find(1);

        if (! $user) {
            return response()->json(['error' => 'Admin user not found'], 404);
        }

        return response()->json([
            'username' => $user->username,
            'email' => $user->email,
            'name' => $user->name,
        ]);
    }

    public function updateAdminCredentials(Request $request): JsonResponse
    {
        $user = User::query()->find(1);

        if (! $user) {
            return response()->json(['error' => 'Admin user not found'], 404);
        }

        $data = $request->validate([
            'username' => ['required', 'string', Rule::unique('users', 'username')->ignore($user->id)],
            'email' => ['required', 'email', Rule::unique('users', 'email')->ignore($user->id)],
            'password' => ['nullable', 'string', 'min:8'],
        ]);

        $payload = [
            'username' => $data['username'],
            'email' => $data['email'],
            'api_token_hash' => null,
            'api_token_expires_at' => null,
        ];

        if (! empty($data['password'])) {
            $payload['password'] = $data['password'];
        }

        $user->forceFill($payload)->save();

        return response()->json(['ok' => true]);
    }
}
