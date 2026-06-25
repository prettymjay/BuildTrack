<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return redirect()->away(rtrim(env('FRONTEND_URL', 'http://localhost:5173'), '/').'/login');
});
