<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureApiToken
{
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken();

        if (! $token) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $user = User::query()
            ->whereNotNull('api_token_hash')
            ->where('api_token_hash', hash('sha256', $token))
            ->where(function ($query) {
                $query->whereNull('api_token_expires_at')
                    ->orWhere('api_token_expires_at', '>', now());
            })
            ->first();

        if (! $user) {
            return response()->json(['error' => 'Invalid token'], 401);
        }

        $request->setUserResolver(fn () => $user);
        $request->attributes->set('api_user', $user);

        return $next($request);
    }
}
