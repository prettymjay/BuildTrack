<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('projects', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('location')->nullable();
            $table->unsignedSmallInteger('progress')->default(0);
            $table->date('start_date')->nullable();
            $table->date('target_date')->nullable();
            $table->unsignedBigInteger('cost')->default(0);
            $table->string('status')->default('Initializing');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('projects');
    }
};
