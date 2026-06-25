<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Throwable;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'username' => ['required', 'string'],
            'password' => ['required', 'string'],
        ]);

        $user = User::query()
            ->where('username', $data['username'])
            ->orWhere('email', $data['username'])
            ->first();

        if (! $user) {
            return response()->json(['error' => 'Wrong username or email'], 401);
        }

        if (! Hash::check($data['password'], $user->password)) {
            return response()->json(['error' => 'Wrong password'], 401);
        }

        $token = Str::random(64);

        $user->forceFill([
            'api_token_hash' => hash('sha256', $token),
            'api_token_expires_at' => now()->addHours(8),
        ])->save();

        return response()->json([
            'token' => $token,
            'user' => [
                'username' => $user->username,
                'name' => $user->name,
            ],
        ]);
    }

    public function requestReset(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
        ]);

        $user = User::query()
            ->where('email', $data['email'])
            ->first();

        if (! $user) {
            return response()->json(['error' => 'No account was found for that email address'], 404);
        }

        if (! $user->email) {
            return response()->json(['error' => 'This account does not have an email address for password recovery'], 400);
        }

        $token = Str::random(48);
        $ttlMinutes = (int) env('RESET_TOKEN_TTL_MINUTES', 15);

        $user->forceFill([
            'reset_token_hash' => hash('sha256', $token),
            'reset_token_expires_at' => now()->addMinutes($ttlMinutes),
        ])->save();

        $recoveryMessage = "You requested account recovery for your ProBuild App account.\n\n".
            "Username: {$user->username}\n".
            "Reset code: {$token}\n".
            "This code will expire in {$ttlMinutes} minutes.\n\n".
            'If you did not request this reset, you can ignore this email.';

        $mailError = $this->validateMailConfiguration();
        if ($mailError !== null) {
            return response()->json(['error' => $mailError], 500);
        }

        try {
            Mail::raw(
                $recoveryMessage,
                function ($message) use ($user): void {
                    $message
                        ->to($user->email)
                        ->subject('ProBuild App account recovery');
                }
            );
        } catch (Throwable $exception) {
            report($exception);

            return response()->json([
                'error' => 'Unable to send reset email. Check your mail configuration and try again.',
            ], 500);
        }

        return response()->json([
            'ok' => true,
            'message' => 'Your username and reset code were sent to your Gmail address',
            'expiresInMinutes' => $ttlMinutes,
        ]);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'token' => ['required', 'string'],
            'password' => ['required', 'string', 'min:8'],
        ]);

        $user = User::query()
            ->where('email', $data['email'])
            ->first();

        if (! $user) {
            return response()->json(['error' => 'Invalid reset request'], 400);
        }

        $validToken = $user->reset_token_hash && hash('sha256', $data['token']) === $user->reset_token_hash;
        $notExpired = $user->reset_token_expires_at && Carbon::parse($user->reset_token_expires_at)->isFuture();

        if (! $validToken || ! $notExpired) {
            return response()->json(['error' => 'Invalid or expired reset token'], 400);
        }

        $user->forceFill([
            'password' => $data['password'],
            'reset_token_hash' => null,
            'reset_token_expires_at' => null,
            'api_token_hash' => null,
            'api_token_expires_at' => null,
        ])->save();

        return response()->json(['ok' => true]);
    }

    private function validateMailConfiguration(): ?string
    {
        $mailer = (string) config('mail.default', 'log');

        if ($mailer !== 'smtp') {
            return 'Reset email is not using SMTP yet. Set MAIL_MAILER=smtp in backend/.env.';
        }

        if (! filled(env('MAIL_HOST')) || ! filled(env('MAIL_PORT'))) {
            return 'Mail host or port is missing. Configure MAIL_HOST and MAIL_PORT in backend/.env.';
        }

        if (! filled(env('MAIL_USERNAME')) || ! filled(env('MAIL_PASSWORD'))) {
            return 'Gmail SMTP is not configured yet. Add MAIL_USERNAME and a Gmail app password to backend/.env.';
        }

        if (! filled(config('mail.from.address'))) {
            return 'MAIL_FROM_ADDRESS is missing. Add a sender Gmail address in backend/.env.';
        }

        return null;
    }
}
