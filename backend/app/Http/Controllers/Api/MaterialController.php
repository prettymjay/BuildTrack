<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Material;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MaterialController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Material::query();

        $search = trim((string) $request->query('search', ''));
        $category = trim((string) $request->query('category', ''));
        $date = trim((string) $request->query('date', ''));

        if ($search !== '') {
            $query->where(function ($builder) use ($search) {
                $builder->where('name', 'like', "%{$search}%")
                    ->orWhere('code', 'like', "%{$search}%");
            });
        }

        if ($category !== '' && $category !== 'All') {
            $query->where('category', $category);
        }

        if ($date !== '') {
            $query->whereDate('created_at', $date);
        }

        $page = max(1, (int) $request->query('page', 1));
        $perPage = max(1, (int) $request->query('perPage', 10));

        $paginator = $query->orderByDesc('id')->paginate($perPage, ['*'], 'page', $page);

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
            'name' => ['required', 'string'],
            'category' => ['nullable', 'string'],
            'quantity' => ['nullable', 'string'],
            'unit' => ['nullable', 'string'],
            'cost' => ['nullable', 'string'],
            'supplier' => ['nullable', 'string'],
            'supplier_category' => ['nullable', 'string'],
            'lowStock' => ['nullable', 'boolean'],
            'low_stock' => ['nullable', 'boolean'],
        ]);

        $material = Material::create([
            'code' => null,
            'name' => $data['name'],
            'category' => $data['category'] ?? null,
            'quantity' => $data['quantity'] ?? null,
            'unit' => $data['unit'] ?? null,
            'cost' => $data['cost'] ?? null,
            'supplier' => $data['supplier'] ?? null,
            'supplier_category' => $data['supplier_category'] ?? null,
            'low_stock' => (bool) ($data['low_stock'] ?? $data['lowStock'] ?? false),
        ]);

        $material->forceFill([
            'code' => 'MAT-'.str_pad((string) $material->id, 5, '0', STR_PAD_LEFT),
        ])->save();

        return response()->json($material->fresh(), 201);
    }

    public function update(Request $request, Material $material): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string'],
            'category' => ['nullable', 'string'],
            'quantity' => ['nullable', 'string'],
            'unit' => ['nullable', 'string'],
            'cost' => ['nullable', 'string'],
            'supplier' => ['nullable', 'string'],
            'supplier_category' => ['nullable', 'string'],
            'lowStock' => ['nullable', 'boolean'],
            'low_stock' => ['nullable', 'boolean'],
        ]);

        $material->update([
            'name' => $data['name'],
            'category' => $data['category'] ?? null,
            'quantity' => $data['quantity'] ?? null,
            'unit' => $data['unit'] ?? null,
            'cost' => $data['cost'] ?? null,
            'supplier' => $data['supplier'] ?? null,
            'supplier_category' => $data['supplier_category'] ?? null,
            'low_stock' => (bool) ($data['low_stock'] ?? $data['lowStock'] ?? false),
        ]);

        return response()->json($material->fresh());
    }

    public function destroy(Material $material): JsonResponse
    {
        $material->delete();

        return response()->json(['success' => true]);
    }
}
