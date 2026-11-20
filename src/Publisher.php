<?php

namespace ElChoco\Editorial;

use Flarum\Api\Client;
use Flarum\User\User;
use Psr\Http\Message\ServerRequestInterface;

class Publisher
{
    public function __construct(private readonly Client $client) {}

    public function publish(User $actor, object $draft, ServerRequestInterface $request): int
    {
        $data = ['type' => 'discussions', 'attributes' => ['title' => $draft->title, 'content' => $draft->content]];
        $tags = json_decode($draft->tags, true, 16, JSON_THROW_ON_ERROR);
        if ($tags) {
            $data['relationships']['tags']['data'] = array_map(fn ($id) => ['type' => 'tags', 'id' => (string) $id], $tags);
        }
        $response = $this->client->withParentRequest($request)->withActor($actor)
            ->withoutErrorHandling()->withBody(['data' => $data])->post('/discussions');
        if ($response->getStatusCode() >= 400) {
            throw new EditorialException('publish_failed');
        }
        $result = json_decode((string) $response->getBody(), true);
        $id = $result['data']['id'] ?? null;
        if (!is_scalar($id) || !ctype_digit((string) $id) || (int) $id < 1) {
            throw new EditorialException('publish_failed', 502);
        }
        return (int) $id;
    }
}
