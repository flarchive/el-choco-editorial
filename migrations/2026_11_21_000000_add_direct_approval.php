<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

return [
    'up' => function (Builder $schema): void {
        $schema->table('editorial_drafts', function (Blueprint $table): void {
            $table->unsignedInteger('direct_approved_by')->nullable();
            $table->unsignedInteger('direct_approved_version')->nullable();
        });
    },
    'down' => function (Builder $schema): void {
        $schema->table('editorial_drafts', function (Blueprint $table): void {
            $table->dropColumn(['direct_approved_by', 'direct_approved_version']);
        });
    },
];
