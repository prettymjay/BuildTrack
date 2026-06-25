<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BackupController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\ExpenseController;
use App\Http\Controllers\Api\MaterialController;
use App\Http\Controllers\Api\ProjectController;
use App\Http\Controllers\Api\ReferenceDataController;
use App\Http\Controllers\Api\SettingsController;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'login']);
Route::post('/password/forgot', [AuthController::class, 'requestReset']);
Route::post('/password/reset', [AuthController::class, 'resetPassword']);

Route::middleware('api.token')->group(function () {
    Route::get('/system/options', [ReferenceDataController::class, 'index']);
    Route::post('/system/options/{group}/items', [ReferenceDataController::class, 'storeItem']);
    Route::put('/system/options/{group}/items/{item}', [ReferenceDataController::class, 'updateItem']);
    Route::delete('/system/options/{group}/items/{item}', [ReferenceDataController::class, 'deleteItem']);

    Route::get('/projects', [ProjectController::class, 'index']);
    Route::post('/projects', [ProjectController::class, 'store']);
    Route::put('/projects/{project}', [ProjectController::class, 'update']);
    Route::delete('/projects/{project}', [ProjectController::class, 'destroy']);

    Route::get('/materials', [MaterialController::class, 'index']);
    Route::post('/materials', [MaterialController::class, 'store']);
    Route::put('/materials/{material}', [MaterialController::class, 'update']);
    Route::delete('/materials/{material}', [MaterialController::class, 'destroy']);

    Route::get('/categories', [CategoryController::class, 'index']);
    Route::post('/categories', [CategoryController::class, 'store']);
    Route::put('/categories/{category}', [CategoryController::class, 'update']);
    Route::delete('/categories/{category}', [CategoryController::class, 'destroy']);

    Route::get('/expenses', [ExpenseController::class, 'index']);
    Route::post('/expenses', [ExpenseController::class, 'store']);
    Route::put('/expenses/{expense}', [ExpenseController::class, 'update']);
    Route::delete('/expenses/{expense}', [ExpenseController::class, 'destroy']);

    Route::post('/backup', [BackupController::class, 'store'])->middleware('api.admin');
    Route::get('/backup/download', [BackupController::class, 'downloadLatest'])->middleware('api.admin');
    Route::post('/backup/cleanup', [BackupController::class, 'cleanup'])->middleware('api.admin');

    Route::get('/settings/company', [SettingsController::class, 'companyProfile']);
    Route::put('/settings/company', [SettingsController::class, 'updateCompanyProfile']);
    Route::get('/admin/account', [SettingsController::class, 'adminAccount'])->middleware('api.admin');
    Route::post('/admin/credentials', [SettingsController::class, 'updateAdminCredentials'])->middleware('api.admin');
});
