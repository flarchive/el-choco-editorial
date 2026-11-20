<?php

use ElChoco\Editorial\Controller;
use Flarum\Api\Context;
use Flarum\Api\Resource\ForumResource;
use Flarum\Api\Schema\Boolean;
use Flarum\Extend;

return [
    (new Extend\Frontend('forum'))
        ->route('/editorial', 'editorial')
        ->route('/editorial/{id}', 'editorial.draft')
        ->js(__DIR__.'/js/dist/forum.js')
        ->css(__DIR__.'/less/forum.less'),
    (new Extend\Frontend('admin'))->js(__DIR__.'/js/dist/admin.js'),
    (new Extend\ApiResource(ForumResource::class))->fields(fn () => [
        Boolean::make('canUseEditorial')->get(fn ($model, Context $context) =>
            !$context->getActor()->isGuest() && $context->getActor()->can('el-choco-editorial.use')),
    ]),
    (new Extend\Routes('api'))
        ->get('/editorial', 'editorial.index', Controller::class)
        ->post('/editorial', 'editorial.create', Controller::class)
        ->get('/editorial/{id}', 'editorial.show', Controller::class)
        ->post('/editorial/{id}', 'editorial.action', Controller::class)
        ->get('/editorial/{id}/revisions/{revision}', 'editorial.revision', Controller::class),
    (new Extend\Settings())->default('el-choco-editorial.approvals', '1'),
    new Extend\Locales(__DIR__.'/locale'),
];
