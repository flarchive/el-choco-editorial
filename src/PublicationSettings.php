<?php

namespace ElChoco\Editorial;

use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\User;

final class PublicationSettings
{
    public function __construct(private readonly SettingsRepositoryInterface $settings) {}

    public function enabled(string $type): bool
    {
        $extensions = json_decode((string) $this->settings->get('extensions_enabled', '[]'), true);
        if (!is_array($extensions)) $extensions = [];
        return match ($type) {
            'discussion' => true,
            'blog' => in_array('fof-blog', $extensions, true),
            'wiki' => in_array('linkrobins-wiki', $extensions, true),
            default => false,
        };
    }

    public function blogTags(): array
    {
        return array_values(array_unique(array_map('intval', array_filter(explode('|', (string) $this->settings->get('blog_tags', '')), fn ($value) => ctype_digit($value) && (int) $value > 0))));
    }

    public function read(User $actor): array
    {
        $targets = [];
        foreach (['discussion', 'blog', 'wiki'] as $type) {
            $label = trim((string) $this->settings->get('el-choco-editorial.label_'.$type, ''));
            $targets[] = ['type' => $type, 'label' => mb_substr($label, 0, 60), 'available' => $this->enabled($type),
                'canPublish' => $this->enabled($type) && match ($type) {
                    'blog' => $actor->can('blog.writeArticles'), 'wiki' => $actor->can('createArticle'), default => true,
                }];
        }
        return ['targets' => $targets, 'blogTags' => $this->enabled('blog') ? $this->blogTags() : []];
    }

    public function values(array $input): array
    {
        $type = $input['publication_type'] ?? 'discussion';
        if (!is_string($type) || !in_array($type, ['discussion', 'blog', 'wiki'], true)) throw new EditorialException('invalid');
        if (!$this->enabled($type)) throw new EditorialException('target_unavailable');
        $options = $input['publication_options'] ?? [];
        if (!is_array($options)) throw new EditorialException('invalid');
        $text = static function (string $key, int $limit) use ($options): string {
            $value = $options[$key] ?? '';
            if (!is_string($value) || !mb_check_encoding($value, 'UTF-8') || mb_strlen($value) > $limit || str_contains($value, "\0")) throw new EditorialException('invalid');
            return trim($value);
        };
        $clean = [];
        if ($type === 'blog') {
            $clean = ['summary' => $text('summary', 1000), 'image' => $text('image', 2048)];
            if ($clean['image'] !== '' && (!filter_var($clean['image'], FILTER_VALIDATE_URL) || !in_array(strtolower(parse_url($clean['image'], PHP_URL_SCHEME) ?? ''), ['http', 'https'], true))) throw new EditorialException('invalid');
        } elseif ($type === 'wiki') {
            $category = $options['category'] ?? '';
            if ($category !== '' && $category !== null && (!is_scalar($category) || !ctype_digit((string) $category) || (int) $category < 1 || strlen((string) $category) > 9)) throw new EditorialException('invalid');
            $clean = ['category' => $category === '' || $category === null ? null : (int) $category, 'slug' => $text('slug', 191)];
            if ($clean['slug'] !== '' && !preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/D', $clean['slug'])) throw new EditorialException('invalid');
        }
        return ['publication_type' => $type, 'publication_options' => json_encode($clean, JSON_THROW_ON_ERROR)];
    }

    public function assertReady(object $draft): void
    {
        $type = $draft->publication_type;
        $this->values(['publication_type' => $type, 'publication_options' => json_decode($draft->publication_options ?? '[]', true, 16, JSON_THROW_ON_ERROR)]);
        $tags = json_decode($draft->tags, true, 16, JSON_THROW_ON_ERROR);
        $hasBlogTag = (bool) array_intersect($tags, $this->blogTags());
        if ($type === 'blog' && !$hasBlogTag) throw new EditorialException('blog_tag_required');
        if ($type === 'discussion' && $this->enabled('blog') && $hasBlogTag) throw new EditorialException('blog_tag_discussion');
    }
}
