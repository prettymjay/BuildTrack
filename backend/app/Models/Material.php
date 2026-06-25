<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Material extends Model
{
    protected $fillable = [
        'code',
        'name',
        'category',
        'quantity',
        'unit',
        'cost',
        'supplier',
        'supplier_category',
        'low_stock',
    ];

    protected function casts(): array
    {
        return [
            'low_stock' => 'boolean',
        ];
    }
}
