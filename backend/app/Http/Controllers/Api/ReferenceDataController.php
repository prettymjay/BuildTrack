<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SystemReferenceList;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReferenceDataController extends Controller
{
    private const MUTABLE_GROUPS = [
        'daily_expense_categories',
        'project_statuses',
        'unit_categories',
    ];

    public function index(): JsonResponse
    {
        return response()->json([
            'materials_categories' => config('probuild.materials_categories', []),
            'daily_expense_categories' => $this->getList('daily_expense_categories'),
            'supplier_categories' => config('probuild.supplier_categories', []),
            'user_roles' => config('probuild.user_roles', []),
            'project_statuses' => $this->getList('project_statuses'),
            'payment_statuses' => config('probuild.payment_statuses', []),
            'unit_categories' => $this->getList('unit_categories'),
            'transaction_types' => config('probuild.transaction_types', []),
            'report_types' => config('probuild.report_types', []),
        ]);
    }

    public function storeItem(Request $request, string $group): JsonResponse
    {
        if (!in_array($group, self::MUTABLE_GROUPS, true)) {
            return response()->json(['error' => 'This category group is not editable.'], 422);
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]);

        $items = $this->getList($group);
        $name = trim($data['name']);

        foreach ($items as $item) {
            if (strcasecmp((string) $item, $name) === 0) {
                return response()->json(['error' => 'This category already exists.'], 422);
            }
        }

        $items[] = $name;
        sort($items, SORT_NATURAL | SORT_FLAG_CASE);
        $this->saveList($group, $items);

        return response()->json([
            'group' => $group,
            'items' => array_values($items),
        ], 201);
    }

    public function updateItem(Request $request, string $group, string $item): JsonResponse
    {
        if (!in_array($group, self::MUTABLE_GROUPS, true)) {
            return response()->json(['error' => 'This category group is not editable.'], 422);
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]);

        $items = $this->getList($group);
        $currentName = urldecode($item);
        $currentIndex = $this->findItemIndex($items, $currentName);
        if ($currentIndex === null) {
            return response()->json(['error' => 'Category item not found.'], 404);
        }

        $newName = trim($data['name']);
        foreach ($items as $index => $existing) {
            if ($index !== $currentIndex && strcasecmp((string) $existing, $newName) === 0) {
                return response()->json(['error' => 'This category already exists.'], 422);
            }
        }

        $items[$currentIndex] = $newName;
        sort($items, SORT_NATURAL | SORT_FLAG_CASE);
        $this->saveList($group, $items);

        return response()->json([
            'group' => $group,
            'items' => array_values($items),
        ]);
    }

    public function deleteItem(string $group, string $item): JsonResponse
    {
        if (!in_array($group, self::MUTABLE_GROUPS, true)) {
            return response()->json(['error' => 'This category group is not editable.'], 422);
        }

        $items = $this->getList($group);
        $currentName = urldecode($item);
        $currentIndex = $this->findItemIndex($items, $currentName);
        if ($currentIndex === null) {
            return response()->json(['error' => 'Category item not found.'], 404);
        }

        array_splice($items, $currentIndex, 1);
        $this->saveList($group, $items);

        return response()->json([
            'group' => $group,
            'items' => array_values($items),
        ]);
    }

    private function getList(string $key): array
    {
        $record = SystemReferenceList::query()->where('key', $key)->first();
        if ($record && is_array($record->items)) {
            return array_values($record->items);
        }

        return array_values(config("probuild.{$key}", []));
    }

    private function saveList(string $key, array $items): void
    {
        SystemReferenceList::query()->updateOrCreate(
            ['key' => $key],
            ['items' => array_values($items)]
        );
    }

    private function findItemIndex(array $items, string $needle): ?int
    {
        foreach ($items as $index => $item) {
            if (strcasecmp((string) $item, $needle) === 0) {
                return $index;
            }
        }

        return null;
    }
}
