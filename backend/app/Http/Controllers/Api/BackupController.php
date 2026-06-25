<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Expense;
use App\Models\Material;
use App\Models\Project;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class BackupController extends Controller
{
    private function backupsPath(): string
    {
        $path = storage_path('app/backups');
        File::ensureDirectoryExists($path);

        return $path;
    }

    public function store(Request $request): JsonResponse
    {
        $snapshot = [
            'created_at' => now()->toIso8601String(),
            'users' => User::query()->get(['id', 'username', 'email', 'name', 'created_at', 'updated_at'])->toArray(),
            'projects' => Project::query()->get()->toArray(),
            'materials' => Material::query()->get()->toArray(),
            'expenses' => Expense::query()->get()->toArray(),
        ];

        $filename = 'backup-'.now()->format('Y-m-d_His').'.json';
        File::put($this->backupsPath().DIRECTORY_SEPARATOR.$filename, json_encode($snapshot, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

        return response()->json([
            'ok' => true,
            'file' => $filename,
        ]);
    }

    public function downloadLatest(): BinaryFileResponse|JsonResponse
    {
        $files = collect(File::files($this->backupsPath()))
            ->filter(fn ($file) => $file->getExtension() === 'json')
            ->sortByDesc(fn ($file) => $file->getMTime());

        $latest = $files->first();

        if (! $latest) {
            return response()->json(['error' => 'No backups found'], 404);
        }

        return response()->download($latest->getPathname(), $latest->getFilename());
    }

    public function cleanup(Request $request): JsonResponse
    {
        $days = max(1, (int) $request->query('days', 30));
        $cutoff = now()->subDays($days)->timestamp;
        $removed = 0;

        foreach (File::files($this->backupsPath()) as $file) {
            if ($file->getMTime() < $cutoff) {
                File::delete($file->getPathname());
                $removed++;
            }
        }

        return response()->json([
            'ok' => true,
            'removed' => $removed,
        ]);
    }
}
