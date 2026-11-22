<?php

namespace ElChoco\Editorial;

use Flarum\Settings\SettingsRepositoryInterface;

final class HomeSettings
{
    public const STATUSES = ['all', 'draft', 'review', 'approved', 'published', 'archived'];
    public const SORTS = ['latest', 'oldest', 'title'];

    public function __construct(private readonly SettingsRepositoryInterface $settings) {}

    private function text(string $key, int $limit): string
    {
        $value = $this->settings->get('el-choco-editorial.home_'.$key, '');
        return is_string($value) ? mb_substr($value, 0, $limit) : '';
    }

    public function read(): array
    {
        $status = $this->text('status', 20);
        $sort = $this->text('sort', 20);
        return [
            'banner' => in_array($this->settings->get('el-choco-editorial.home_banner', '1'), ['1', 1, true], true),
            'title' => $this->text('title', 120),
            'description' => $this->text('description', 500),
            'welcome' => $this->text('welcome', 1500),
            'layout' => $this->text('layout', 20) === 'list' ? 'list' : 'cards',
            'status' => in_array($status, self::STATUSES, true) ? $status : 'all',
            'sort' => in_array($sort, self::SORTS, true) ? $sort : 'latest',
        ];
    }
}
