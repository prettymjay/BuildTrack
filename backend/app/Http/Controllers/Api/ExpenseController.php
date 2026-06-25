<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Expense;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ExpenseController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Expense::query();

        $search = trim((string) $request->query('search', ''));
        $project = trim((string) $request->query('project', ''));
        $category = trim((string) $request->query('category', ''));
        $date = trim((string) $request->query('date', ''));

        if ($search !== '') {
            $query->where(function ($builder) use ($search) {
                $builder->where('description', 'like', "%{$search}%")
                    ->orWhere('project', 'like', "%{$search}%");
            });
        }

        if ($project !== '' && $project !== 'All') {
            $query->where('project', $project);
        }

        if ($category !== '' && $category !== 'All') {
            $query->where('category', $category);
        }

        if ($date !== '') {
            $query->whereDate('date', $date);
        }

        $page = max(1, (int) $request->query('page', 1));
        $perPage = max(1, (int) $request->query('perPage', 10));

        $paginator = $query->orderByDesc('id')->paginate($perPage, ['*'], 'page', $page);

        $rows = collect($paginator->items())->map(fn (Expense $expense) => [
            'id' => $expense->id,
            'date' => optional($expense->date)->format('Y-m-d'),
            'project' => $expense->project,
            'category' => $expense->category,
            'description' => $expense->description,
            'amount' => $expense->amount,
            'status' => $expense->status,
        ])->all();

        return response()->json([
            'data' => $rows,
            'total' => $paginator->total(),
            'page' => $paginator->currentPage(),
            'perPage' => $paginator->perPage(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'date' => ['nullable', 'date'],
            'project' => ['nullable', 'string'],
            'category' => ['nullable', 'string'],
            'description' => ['nullable', 'string'],
            'amount' => ['nullable', 'numeric'],
            'status' => ['nullable', 'string'],
        ]);

        $expense = Expense::create([
            'date' => $data['date'] ?? null,
            'project' => $data['project'] ?? null,
            'category' => $data['category'] ?? null,
            'description' => $data['description'] ?? null,
            'amount' => (int) round(((float) ($data['amount'] ?? 0)) * 100),
            'status' => $data['status'] ?? 'Unpaid',
        ]);

        return response()->json($expense, 201);
    }

    public function update(Request $request, Expense $expense): JsonResponse
    {
        $data = $request->validate([
            'date' => ['nullable', 'date'],
            'project' => ['nullable', 'string'],
            'category' => ['nullable', 'string'],
            'description' => ['nullable', 'string'],
            'amount' => ['nullable', 'numeric'],
            'status' => ['nullable', 'string'],
        ]);

        $expense->update([
            'date' => $data['date'] ?? null,
            'project' => $data['project'] ?? null,
            'category' => $data['category'] ?? null,
            'description' => $data['description'] ?? null,
            'amount' => (int) round(((float) ($data['amount'] ?? 0)) * 100),
            'status' => $data['status'] ?? 'Unpaid',
        ]);

        return response()->json([
            'id' => $expense->id,
            'date' => optional($expense->fresh()->date)->format('Y-m-d'),
            'project' => $expense->project,
            'category' => $expense->category,
            'description' => $expense->description,
            'amount' => $expense->amount,
            'status' => $expense->status,
        ]);
    }

    public function destroy(Expense $expense): JsonResponse
    {
        $expense->delete();

        return response()->json(['success' => true]);
    }
}
