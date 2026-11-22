<?php

namespace ElChoco\Editorial;

use Flarum\Api\Client;
use Flarum\User\User;
use Flarum\Settings\SettingsRepositoryInterface;
use Psr\Http\Message\ServerRequestInterface;

class Publisher
{
    public function __construct(private readonly Client $client, private readonly SettingsRepositoryInterface $settings) {}

    public function publish(User $actor, object $draft, ServerRequestInterface $request): int
    {
        (new PublicationSettings($this->settings))->assertReady($draft);
        $options = json_decode($draft->publication_options ?? '[]', true, 16, JSON_THROW_ON_ERROR);
        $client = $this->client->withParentRequest($request)->withActor($actor)->withoutErrorHandling();
        if ($draft->publication_type === 'wiki') {
            $actor->assertCan('createArticle');
            $data = ['type' => 'linkrobins-wiki-articles', 'attributes' => ['title' => $draft->title, 'content' => $draft->content, 'isDraft' => false]];
            if ($options['slug'] !== '') $data['attributes']['slug'] = $options['slug'];
            if ($options['category']) {
                try { $category = $client->get('/linkrobins-wiki-categories/'.$options['category']); }
                catch (\Throwable) { throw new EditorialException('wiki_category_invalid'); }
                if ($category->getStatusCode() >= 400) throw new EditorialException('wiki_category_invalid');
                $data['relationships']['category']['data'] = ['type' => 'linkrobins-wiki-categories', 'id' => (string) $options['category']];
            }
            return $this->result($client->withBody(['data' => $data])->post('/linkrobins-wiki-articles'));
        }
        $data = ['type' => 'discussions', 'attributes' => ['title' => $draft->title, 'content' => $draft->content]];
        if ($draft->publication_type === 'blog') {
            $actor->assertCan('blog.writeArticles');
            $data['attributes']['newBlogMeta'] = ['summary' => $options['summary'], 'featuredImage' => $options['image'] ?: null];
        }
        $tags = json_decode($draft->tags, true, 16, JSON_THROW_ON_ERROR);
        if ($tags) {
            $data['relationships']['tags']['data'] = array_map(fn ($id) => ['type' => 'tags', 'id' => (string) $id], $tags);
        }
        return $this->result($client->withBody(['data' => $data])->post('/discussions'));
    }

    private function result(\Psr\Http\Message\ResponseInterface $response): int
    {
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
