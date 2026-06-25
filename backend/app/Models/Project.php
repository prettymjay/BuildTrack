<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Project extends Model
{
    protected $fillable = [
        'title',
        'location',
        'progress',
        'start_date',
        'target_date',
        'cost',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'progress' => 'integer',
            'cost' => 'integer',
            'start_date' => 'date',
            'target_date' => 'date',
        ];
    }
}
