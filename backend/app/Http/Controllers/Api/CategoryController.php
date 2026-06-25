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
        return response()->json([
            'data' => Category::query()->orderBy('name')->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', 'unique:categories,name'],
            'description' => ['nullable', 'string'],
        ]);

        $category = Category::create($data);

        return response()->json($category, 201);
    }

    public function update(Request $request, Category $category): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique('categories', 'name')->ignore($category->id)],
            'description' => ['nullable', 'string'],
        ]);

        $previousName = $category->name;
        $category->update($data);

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
