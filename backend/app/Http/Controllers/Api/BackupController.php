<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Expense;
use App\Models\Material;
use App\Models\Project;
use App\Models\SystemReferenceList;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
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
            'version' => 2,
            'created_at' => now()->toIso8601String(),
            'company_settings' => DB::table('company_settings')->get()->map(fn ($row) => (array) $row)->all(),
            'users' => DB::table('users')->get()->map(fn ($row) => (array) $row)->all(),
            'projects' => Project::query()->get()->toArray(),
            'materials' => Material::query()->get()->toArray(),
            'expenses' => Expense::query()->get()->toArray(),
            'categories' => Category::query()->get()->toArray(),
            'system_reference_lists' => SystemReferenceList::query()->get()->toArray(),
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

    public function restore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'backup_file' => ['required', 'file', 'mimes:json,txt'],
        ]);

        $contents = File::get($data['backup_file']->getRealPath());
        $snapshot = json_decode($contents, true);

        if (! is_array($snapshot)) {
            return response()->json(['error' => 'Invalid backup file format.'], 422);
        }

        foreach (['users', 'projects', 'materials', 'expenses'] as $key) {
            if (! array_key_exists($key, $snapshot) || ! is_array($snapshot[$key])) {
                return response()->json(['error' => 'Backup file is missing required data.'], 422);
            }
        }

        DB::transaction(function () use ($snapshot): void {
            DB::table('expenses')->delete();
            DB::table('materials')->delete();
            DB::table('projects')->delete();
            DB::table('categories')->delete();
            DB::table('system_reference_lists')->delete();
            DB::table('company_settings')->delete();
            DB::table('users')->delete();

            $this->restoreTable('users', $snapshot['users'] ?? []);
            $this->restoreTable('company_settings', $snapshot['company_settings'] ?? []);
            $this->restoreTable('projects', $snapshot['projects'] ?? []);
            $this->restoreTable('materials', $snapshot['materials'] ?? []);
            $this->restoreTable('expenses', $snapshot['expenses'] ?? []);
            $this->restoreTable('categories', $snapshot['categories'] ?? []);
            $this->restoreTable('system_reference_lists', $snapshot['system_reference_lists'] ?? []);
        });

        return response()->json([
            'ok' => true,
            'message' => 'Backup restored successfully. The system now reflects the uploaded snapshot.',
            'restored_at' => now()->toIso8601String(),
        ]);
    }

    private function restoreTable(string $table, array $rows): void
    {
        if ($rows === []) {
            return;
        }

        DB::table($table)->insert(array_map(function ($row) {
            return is_array($row) ? $row : (array) $row;
        }, $rows));
    }
}
