<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Material;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CategoryController extends Controller
{
    public function index(): JsonResponse
    {
        $includeInactive = filter_var(request()->query('includeInactive', false), FILTER_VALIDATE_BOOLEAN);

        $query = Category::query()->orderBy('name');
        if (! $includeInactive) {
            $query->where('status', 'Active');
        }

        return response()->json([
            'data' => $query->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', 'unique:categories,name'],
            'description' => ['nullable', 'string'],
            'status' => ['nullable', Rule::in(['Active', 'Inactive'])],
        ]);

        $category = Category::create([
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
            'status' => $data['status'] ?? 'Active',
        ]);

        return response()->json($category, 201);
    }

    public function update(Request $request, Category $category): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique('categories', 'name')->ignore($category->id)],
            'description' => ['nullable', 'string'],
            'status' => ['nullable', Rule::in(['Active', 'Inactive'])],
        ]);

        $previousName = $category->name;
        $category->update([
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
            'status' => $data['status'] ?? $category->status,
        ]);

        if ($previousName !== $category->name) {
            Material::query()->where('category', $previousName)->update(['category' => $category->name]);
        }

        return response()->json($category->fresh());
    }

    public function destroy(Category $category): JsonResponse
    {
        $inUse = Material::query()->where('category', $category->name)->exists();

        if ($inUse) {
            return response()->json([
                'error' => 'This category is still used by materials. Reassign those materials first.',
            ], 422);
        }

        $category->delete();

        return response()->json(['success' => true]);
    }
}
