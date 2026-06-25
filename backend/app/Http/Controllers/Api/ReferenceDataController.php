<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SystemReferenceList;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ReferenceDataController extends Controller
{
    private const MUTABLE_GROUPS = [
        'daily_expense_categories',
        'project_statuses',
        'unit_categories',
    ];

    public function index(): JsonResponse
    {
        $expenseRecords = $this->getListRecords('daily_expense_categories');
        $projectStatusRecords = $this->getListRecords('project_statuses');
        $unitRecords = $this->getListRecords('unit_categories');

        return response()->json([
            'materials_categories' => config('probuild.materials_categories', []),
            'daily_expense_categories' => $this->activeNames($expenseRecords),
            'daily_expense_category_records' => $expenseRecords,
            'supplier_categories' => config('probuild.supplier_categories', []),
            'user_roles' => config('probuild.user_roles', []),
            'project_statuses' => $this->activeNames($projectStatusRecords),
            'project_status_records' => $projectStatusRecords,
            'payment_statuses' => config('probuild.payment_statuses', []),
            'unit_categories' => $this->activeNames($unitRecords),
            'unit_category_records' => $unitRecords,
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
            'status' => ['nullable', Rule::in(['Active', 'Inactive'])],
        ]);

        $items = $this->getListRecords($group);
        $name = trim($data['name']);

        foreach ($items as $item) {
            if (strcasecmp((string) $item['name'], $name) === 0) {
                return response()->json(['error' => 'This category already exists.'], 422);
            }
        }

        $items[] = [
            'name' => $name,
            'status' => $data['status'] ?? 'Active',
        ];
        $items = $this->sortRecords($items);
        $this->saveList($group, $items);

        return response()->json([
            'group' => $group,
            'items' => $this->activeNames($items),
            'records' => array_values($items),
        ], 201);
    }

    public function updateItem(Request $request, string $group, string $item): JsonResponse
    {
        if (!in_array($group, self::MUTABLE_GROUPS, true)) {
            return response()->json(['error' => 'This category group is not editable.'], 422);
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'status' => ['nullable', Rule::in(['Active', 'Inactive'])],
        ]);

        $items = $this->getListRecords($group);
        $currentName = urldecode($item);
        $currentIndex = $this->findItemIndex($items, $currentName);
        if ($currentIndex === null) {
            return response()->json(['error' => 'Category item not found.'], 404);
        }

        $newName = trim($data['name']);
        foreach ($items as $index => $existing) {
            if ($index !== $currentIndex && strcasecmp((string) $existing['name'], $newName) === 0) {
                return response()->json(['error' => 'This category already exists.'], 422);
            }
        }

        $items[$currentIndex] = [
            'name' => $newName,
            'status' => $data['status'] ?? ($items[$currentIndex]['status'] ?? 'Active'),
        ];
        $items = $this->sortRecords($items);
        $this->saveList($group, $items);

        return response()->json([
            'group' => $group,
            'items' => $this->activeNames($items),
            'records' => array_values($items),
        ]);
    }

    public function deleteItem(string $group, string $item): JsonResponse
    {
        if (!in_array($group, self::MUTABLE_GROUPS, true)) {
            return response()->json(['error' => 'This category group is not editable.'], 422);
        }

        $items = $this->getListRecords($group);
        $currentName = urldecode($item);
        $currentIndex = $this->findItemIndex($items, $currentName);
        if ($currentIndex === null) {
            return response()->json(['error' => 'Category item not found.'], 404);
        }

        array_splice($items, $currentIndex, 1);
        $this->saveList($group, $items);

        return response()->json([
            'group' => $group,
            'items' => $this->activeNames($items),
            'records' => array_values($items),
        ]);
    }

    private function getListRecords(string $key): array
    {
        $record = SystemReferenceList::query()->where('key', $key)->first();
        if ($record && is_array($record->items)) {
            return $this->normalizeRecords($record->items);
        }

        return $this->normalizeRecords(array_values(config("probuild.{$key}", [])));
    }

    private function saveList(string $key, array $items): void
    {
        SystemReferenceList::query()->updateOrCreate(
            ['key' => $key],
            ['items' => array_values($this->normalizeRecords($items))]
        );
    }

    private function findItemIndex(array $items, string $needle): ?int
    {
        foreach ($items as $index => $item) {
            if (strcasecmp((string) ($item['name'] ?? ''), $needle) === 0) {
                return $index;
            }
        }

        return null;
    }

    private function normalizeRecords(array $items): array
    {
        $records = [];

        foreach ($items as $item) {
            if (is_array($item)) {
                $name = trim((string) ($item['name'] ?? ''));
                if ($name === '') {
                    continue;
                }

                $records[] = [
                    'name' => $name,
                    'status' => ($item['status'] ?? 'Active') === 'Inactive' ? 'Inactive' : 'Active',
                ];
                continue;
            }

            $name = trim((string) $item);
            if ($name === '') {
                continue;
            }

            $records[] = [
                'name' => $name,
                'status' => 'Active',
            ];
        }

        return $this->sortRecords($records);
    }

    private function sortRecords(array $records): array
    {
        usort($records, fn (array $left, array $right) => strnatcasecmp($left['name'], $right['name']));

        return array_values($records);
    }

    private function activeNames(array $records): array
    {
        return array_values(array_map(
            fn (array $record) => $record['name'],
            array_filter($records, fn (array $record) => ($record['status'] ?? 'Active') === 'Active')
        ));
    }
}
