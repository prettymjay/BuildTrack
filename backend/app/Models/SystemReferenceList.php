<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SystemReferenceList extends Model
{
    protected $fillable = [
        'key',
        'items',
    ];

    protected function casts(): array
    {
        return [
            'items' => 'array',
        ];
    }
}
