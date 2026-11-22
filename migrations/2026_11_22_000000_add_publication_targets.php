<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

return [
    'up' => function (Builder $schema): void {
        foreach (['editorial_drafts', 'editorial_revisions'] as $name) {
            $schema->table($name, function (Blueprint $table) use ($name): void {
                $table->string('publication_type', 16)->default('discussion');
                $table->text('publication_options')->nullable();
                if ($name === 'editorial_drafts') $table->unsignedInteger('publication_id')->nullable();
            });
        }
        $db = $schema->getConnection();
        $db->table('editorial_drafts')->whereNotNull('discussion_id')->update(['publication_id' => $db->raw('discussion_id')]);
    },
    'down' => function (Builder $schema): void {
        $schema->table('editorial_revisions', fn (Blueprint $table) => $table->dropColumn(['publication_type', 'publication_options']));
        $schema->table('editorial_drafts', fn (Blueprint $table) => $table->dropColumn(['publication_type', 'publication_options', 'publication_id']));
    },
];
