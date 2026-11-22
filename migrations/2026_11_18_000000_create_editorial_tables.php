<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

return [
    'up' => function (Builder $schema): void {
        $schema->create('editorial_drafts', function (Blueprint $table): void {
            $table->increments('id');
            $table->unsignedInteger('owner_id')->index();
            $table->string('title', 80);
            $table->mediumText('content');
            $table->text('tags');
            $table->string('status', 16)->default('draft')->index();
            $table->unsignedInteger('version')->default(1);
            $table->unsignedInteger('content_version')->default(1);
            $table->unsignedInteger('required_approvals')->default(1);
            $table->unsignedInteger('discussion_id')->nullable();
            $table->dateTime('created_at');
            $table->dateTime('updated_at')->index();
        });
        $schema->create('editorial_members', function (Blueprint $table): void {
            $table->increments('id');
            $table->unsignedInteger('draft_id')->index();
            $table->unsignedInteger('user_id')->index();
            $table->string('role', 16);
            $table->unsignedInteger('approved_version')->nullable();
            $table->unique(['draft_id', 'user_id']);
        });
        $schema->create('editorial_revisions', function (Blueprint $table): void {
            $table->increments('id');
            $table->unsignedInteger('draft_id')->index();
            $table->unsignedInteger('actor_id');
            $table->unsignedInteger('version');
            $table->unsignedInteger('content_version');
            $table->string('action', 24);
            $table->string('detail', 120)->default('');
            $table->string('title', 80)->nullable();
            $table->mediumText('content')->nullable();
            $table->text('tags')->nullable();
            $table->dateTime('created_at');
            $table->unique(['draft_id', 'version']);
        });
        $schema->create('editorial_comments', function (Blueprint $table): void {
            $table->increments('id');
            $table->unsignedInteger('draft_id')->index();
            $table->unsignedInteger('user_id');
            $table->unsignedInteger('content_version');
            $table->text('content');
            $table->dateTime('created_at');
        });
    },
    'down' => function (Builder $schema): void {
        foreach (['editorial_comments', 'editorial_revisions', 'editorial_members', 'editorial_drafts'] as $table) {
            $schema->dropIfExists($table);
        }
    },
];
