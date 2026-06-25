<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProjectController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Project::query();

        $search = trim((string) $request->query('search', ''));
        $status = trim((string) $request->query('status', ''));
        $sort = (string) $request->query('sort', 'recent');

        if ($search !== '') {
            $query->where(function ($builder) use ($search) {
                $builder->where('title', 'like', "%{$search}%")
                    ->orWhere('location', 'like', "%{$search}%");
            });
        }

        if ($status !== '' && $status !== 'All') {
            $query->where('status', $status);
        }

        $query->orderBy(match ($sort) {
            'cost' => 'cost',
            'progress' => 'progress',
            default => 'id',
        }, match ($sort) {
            'cost', 'progress' => 'desc',
            default => 'desc',
        });

        $page = max(1, (int) $request->query('page', 1));
        $perPage = max(1, (int) $request->query('perPage', 10));

        $paginator = $query->paginate($perPage, ['*'], 'page', $page);

        return response()->json([
            'data' => $paginator->items(),
            'total' => $paginator->total(),
            'page' => $paginator->currentPage(),
            'perPage' => $paginator->perPage(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string'],
            'location' => ['nullable', 'string'],
            'progress' => ['nullable', 'integer', 'min:0', 'max:100'],
            'start_date' => ['nullable', 'date'],
            'target_date' => ['nullable', 'date'],
            'cost' => ['nullable', 'numeric'],
            'status' => ['nullable', 'string'],
        ]);

        $project = Project::create([
            'title' => $data['title'],
            'location' => $data['location'] ?? null,
            'progress' => $data['progress'] ?? 0,
            'start_date' => $data['start_date'] ?? null,
            'target_date' => $data['target_date'] ?? null,
            'cost' => (int) ($data['cost'] ?? 0),
            'status' => $data['status'] ?? 'Planning',
        ]);

        return response()->json($project, 201);
    }

    public function update(Request $request, Project $project): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string'],
            'location' => ['nullable', 'string'],
            'progress' => ['nullable', 'integer', 'min:0', 'max:100'],
            'start_date' => ['nullable', 'date'],
            'target_date' => ['nullable', 'date'],
            'cost' => ['nullable', 'numeric'],
            'status' => ['nullable', 'string'],
        ]);

        $project->update([
            'title' => $data['title'],
            'location' => $data['location'] ?? null,
            'progress' => $data['progress'] ?? 0,
            'start_date' => $data['start_date'] ?? null,
            'target_date' => $data['target_date'] ?? null,
            'cost' => (int) ($data['cost'] ?? 0),
            'status' => $data['status'] ?? 'Planning',
        ]);

        return response()->json($project->fresh());
    }

    public function destroy(Project $project): JsonResponse
    {
        $project->delete();

        return response()->json(['success' => true]);
    }
}
