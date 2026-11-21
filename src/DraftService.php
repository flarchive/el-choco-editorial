<?php

namespace ElChoco\Editorial;

use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\User;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\Query\Builder;
use Psr\Http\Message\ServerRequestInterface;

final class DraftService
{
    public const VERSION = '1.0.1';

    public function __construct(
        private readonly ConnectionInterface $db,
        private readonly SettingsRepositoryInterface $settings,
        private readonly Publisher $publisher
    ) {}

    private function authenticate(User $actor): void
    {
        $actor->assertRegistered();
        $actor->assertCan('el-choco-editorial.use');
    }

    private function query(User $actor): Builder
    {
        $this->authenticate($actor);
        $query = $this->db->table('editorial_drafts');
        if (!$actor->can('el-choco-editorial.manage')) {
            $query->where(function (Builder $query) use ($actor): void {
                $query->where('owner_id', $actor->id)->orWhereIn('id',
                    $this->db->table('editorial_members')->select('draft_id')->where('user_id', $actor->id));
            });
        }
        return $query;
    }

    public function listing(User $actor, int $page, ?string $status = null, ?string $sort = null): array
    {
        $query = $this->query($actor);
        $home = (new HomeSettings($this->settings))->read();
        $status ??= $home['status'];
        $sort ??= $home['sort'];
        if (!in_array($status, HomeSettings::STATUSES, true) || !in_array($sort, HomeSettings::SORTS, true)) {
            throw new EditorialException('invalid');
        }
        if ($status !== 'all') {
            $query->where('status', $status);
        }
        $count = (clone $query)->count();
        if ($sort === 'title') {
            $query->orderBy('title');
        } elseif ($sort === 'oldest') {
            $query->orderBy('updated_at');
        } else {
            $query->orderByDesc('updated_at');
        }
        $rows = $query->orderByDesc('id')->offset(($page - 1) * 20)->limit(20)
            ->get(['id', 'owner_id', 'title', 'status', 'version', 'content_version', 'updated_at', 'discussion_id']);
        return ['version' => self::VERSION, 'items' => $rows, 'page' => $page, 'hasMore' => $page * 20 < $count,
            'total' => $count, 'home' => $home, 'status' => $status, 'sort' => $sort];
    }

    private function find(User $actor, int $id, bool $lock = false): object
    {
        $query = $this->query($actor)->where('id', $id);
        $draft = ($lock ? $query->lockForUpdate() : $query)->first();
        if (!$draft) {
            throw new EditorialException('not_found', 404);
        }
        return $draft;
    }

    private function role(User $actor, object $draft): string
    {
        if ((int) $draft->owner_id === (int) $actor->id) {
            return 'owner';
        }
        return $this->db->table('editorial_members')->where('draft_id', $draft->id)->where('user_id', $actor->id)->value('role') ?? 'manager';
    }

    public function detail(User $actor, int $id): array
    {
        $draft = $this->find($actor, $id);
        $role = $this->role($actor, $draft);
        $members = $this->db->table('editorial_members')->where('draft_id', $id)->orderBy('id')->get();
        $history = $this->db->table('editorial_revisions')->where('draft_id', $id)->orderByDesc('version')->limit(100)
            ->get(['id', 'actor_id', 'version', 'content_version', 'action', 'detail', 'created_at']);
        $comments = $this->db->table('editorial_comments')->where('draft_id', $id)->orderByDesc('id')->limit(100)->get()->reverse()->values();
        $ids = array_merge([(int) $draft->owner_id, (int) $draft->direct_approved_by], $members->pluck('user_id')->all(), $history->pluck('actor_id')->all(), $comments->pluck('user_id')->all());
        $users = $this->db->table('users')->whereIn('id', array_unique($ids))->pluck('username', 'id')->all();
        $approvals = $members->filter(fn ($member) => $member->role === 'reviewer' && (int) $member->approved_version === (int) $draft->content_version)->count();
        $directValid = $this->directApprovalValid($draft);
        $draft->tags = json_decode($draft->tags, true, 16, JSON_THROW_ON_ERROR);
        return ['version' => self::VERSION, 'draft' => $draft, 'role' => $role, 'members' => $members,
            'history' => $history, 'historyTruncated' => (int) $draft->version > 100,
            'comments' => $comments, 'commentsTruncated' => $this->db->table('editorial_comments')->where('draft_id', $id)->count() > 100,
            'users' => $users, 'approvals' => $approvals,
            'directApproval' => $draft->direct_approved_by ? ['userId' => (int) $draft->direct_approved_by,
                'revision' => (int) $draft->direct_approved_version, 'valid' => $directValid] : null,
            'canApproveDirectly' => $actor->can('el-choco-editorial.approveDirectly') && !$directValid
                && in_array($draft->status, ['draft', 'review', 'approved'], true) && trim($draft->content) !== '',
            'canEdit' => in_array($role, ['owner', 'editor'], true) && $draft->status === 'draft',
            'canApprove' => $role === 'reviewer' && $draft->status === 'review',
            'canPublish' => $role === 'owner' && $draft->status === 'approved' && ($directValid || $approvals >= $draft->required_approvals)];
    }

    public function revision(User $actor, int $id, int $revision): array
    {
        $this->find($actor, $id);
        $row = $this->db->table('editorial_revisions')->where('draft_id', $id)->where('id', $revision)->whereNotNull('content')->first();
        if (!$row) {
            throw new EditorialException('not_found', 404);
        }
        $row->tags = json_decode($row->tags, true, 16, JSON_THROW_ON_ERROR);
        $previous = $this->db->table('editorial_revisions')->where('draft_id', $id)->where('version', '<', $row->version)
            ->whereNotNull('content')->orderByDesc('version')->first();
        if ($previous) {
            $previous->tags = json_decode($previous->tags, true, 16, JSON_THROW_ON_ERROR);
        }
        return ['revision' => $row, 'previous' => $previous];
    }

    private function text(array $input, string $key, int $min, int $max): string
    {
        $value = $input[$key] ?? null;
        if (!is_string($value) || !mb_check_encoding($value, 'UTF-8') || mb_strlen(trim($value)) < $min || mb_strlen($value) > $max || str_contains($value, "\0")) {
            throw new EditorialException('invalid');
        }
        return $key === 'title' || $key === 'username' ? trim($value) : $value;
    }

    private function values(array $input): array
    {
        $title = $this->text($input, 'title', 3, 80);
        $content = $this->text($input, 'content', 0, 63000);
        $tags = $input['tags'] ?? [];
        if (!is_array($tags) || !array_is_list($tags) || count($tags) > 10) {
            throw new EditorialException('invalid');
        }
        foreach ($tags as $tag) {
            if ((!is_string($tag) && !is_int($tag)) || !ctype_digit((string) $tag) || (int) $tag < 1 || strlen((string) $tag) > 9) {
                throw new EditorialException('invalid');
            }
        }
        return ['title' => $title, 'content' => $content, 'tags' => json_encode(array_values(array_unique(array_map('intval', $tags))), JSON_THROW_ON_ERROR)];
    }

    public function create(User $actor, array $input): array
    {
        $this->authenticate($actor);
        $values = $this->values($input);
        $id = $this->db->transaction(function () use ($actor, $values): int {
            $this->db->table('users')->where('id', $actor->id)->lockForUpdate()->first();
            if ($this->db->table('editorial_drafts')->where('owner_id', $actor->id)->whereNotIn('status', ['published', 'archived'])->count() >= 50) {
                throw new EditorialException('limit');
            }
            $id = $this->db->table('editorial_drafts')->insertGetId($values + [
                'owner_id' => $actor->id, 'status' => 'draft', 'version' => 1, 'content_version' => 1,
                'required_approvals' => max(1, min(5, (int) $this->settings->get('el-choco-editorial.approvals', '1'))),
                'created_at' => gmdate('Y-m-d H:i:s'), 'updated_at' => gmdate('Y-m-d H:i:s'),
            ]);
            $draft = $this->db->table('editorial_drafts')->where('id', $id)->first();
            $this->record($draft, $actor, 'create', '', true);
            return $id;
        });
        return $this->detail($actor, $id);
    }

    private function record(object $draft, User $actor, string $action, string $detail = '', bool $snapshot = false): void
    {
        $this->db->table('editorial_revisions')->insert([
            'draft_id' => $draft->id, 'actor_id' => $actor->id, 'version' => $draft->version,
            'content_version' => $draft->content_version, 'action' => $action, 'detail' => $detail,
            'title' => $snapshot ? $draft->title : null, 'content' => $snapshot ? $draft->content : null,
            'tags' => $snapshot ? $draft->tags : null, 'created_at' => gmdate('Y-m-d H:i:s'),
        ]);
    }

    private function resetApprovals(object $draft): void
    {
        $this->db->table('editorial_members')->where('draft_id', $draft->id)->update(['approved_version' => null]);
        $draft->direct_approved_by = null;
        $draft->direct_approved_version = null;
    }

    private function directApprovalValid(object $draft): bool
    {
        if (!$draft->direct_approved_by || (int) $draft->direct_approved_version !== (int) $draft->content_version) {
            return false;
        }
        $user = User::find($draft->direct_approved_by);
        return $user && $user->can('el-choco-editorial.use') && $user->can('el-choco-editorial.approveDirectly');
    }

    public function mutate(User $actor, int $id, array $input, ServerRequestInterface $request): array
    {
        $this->authenticate($actor);
        $deleted = $this->db->transaction(function () use ($actor, $id, $input, $request): bool {
            $draft = $this->find($actor, $id, true);
            if (!isset($input['version']) || !is_int($input['version']) || $input['version'] !== (int) $draft->version) {
                throw new EditorialException('conflict', 409);
            }
            $role = $this->role($actor, $draft);
            $owner = $role === 'owner';
            $action = $input['action'] ?? '';
            if (!is_string($action)) {
                throw new EditorialException('invalid');
            }
            if ($action === 'delete') {
                $actor->assertPermission($owner || $actor->can('el-choco-editorial.manage'));
                foreach (['editorial_comments', 'editorial_revisions', 'editorial_members'] as $table) {
                    $this->db->table($table)->where('draft_id', $id)->delete();
                }
                $this->db->table('editorial_drafts')->where('id', $id)->delete();
                return true;
            }
            if (in_array($draft->status, ['published', 'archived'], true)) {
                throw new EditorialException('closed', 409);
            }
            if ((int) $draft->version >= 1000) {
                throw new EditorialException('limit');
            }
            $snapshot = false;
            $detail = '';
            if ($action === 'save' || $action === 'restore') {
                $actor->assertPermission(in_array($role, ['owner', 'editor'], true));
                if ($draft->status !== 'draft') {
                    throw new EditorialException('state', 409);
                }
                $values = $action === 'restore' ? $this->revision($actor, $id, (int) ($input['revision'] ?? 0))['revision'] : null;
                $values = $values ? ['title' => $values->title, 'content' => $values->content, 'tags' => json_encode($values->tags, JSON_THROW_ON_ERROR)] : $this->values($input);
                foreach ($values as $key => $value) {
                    $draft->$key = $value;
                }
                $draft->content_version++;
                $this->resetApprovals($draft);
                $snapshot = true;
            } elseif ($action === 'invite' || $action === 'remove') {
                $actor->assertPermission($owner);
                if ($draft->status !== 'draft') {
                    throw new EditorialException('state', 409);
                }
                if ($action === 'invite') {
                    $username = $this->text($input, 'username', 1, 100);
                    $memberRole = $input['role'] ?? '';
                    if (!in_array($memberRole, ['editor', 'reviewer'], true)) {
                        throw new EditorialException('invalid');
                    }
                    $user = User::where('username', $username)->first();
                    if (!$user || (int) $user->id === (int) $draft->owner_id || !$user->can('el-choco-editorial.use')) {
                        throw new EditorialException('member');
                    }
                    if ($this->db->table('editorial_members')->where('draft_id', $id)->count() >= 20 && !$this->db->table('editorial_members')->where('draft_id', $id)->where('user_id', $user->id)->exists()) {
                        throw new EditorialException('limit');
                    }
                    $this->db->table('editorial_members')->updateOrInsert(['draft_id' => $id, 'user_id' => $user->id], ['role' => $memberRole, 'approved_version' => null]);
                    $detail = (string) $user->id.' · '.$memberRole;
                } else {
                    $userId = filter_var($input['userId'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
                    if (!$userId) {
                        throw new EditorialException('invalid');
                    }
                    $this->db->table('editorial_members')->where('draft_id', $id)->where('user_id', $userId)->delete();
                    $detail = (string) $userId;
                }
                $this->resetApprovals($draft);
            } elseif ($action === 'submit') {
                $actor->assertPermission($owner);
                if ($draft->status !== 'draft' || trim($draft->content) === '') {
                    throw new EditorialException('state', 409);
                }
                $reviewers = $this->db->table('editorial_members')->where('draft_id', $id)->where('role', 'reviewer')->pluck('user_id');
                $eligible = 0;
                foreach ($reviewers as $userId) {
                    $user = User::find($userId);
                    $eligible += $user && $user->can('el-choco-editorial.use') ? 1 : 0;
                }
                if ($eligible < $draft->required_approvals) {
                    throw new EditorialException('reviewers');
                }
                $this->resetApprovals($draft);
                $draft->status = 'review';
            } elseif ($action === 'reopen' || $action === 'changes') {
                $actor->assertPermission($action === 'reopen' ? $owner : $role === 'reviewer');
                if (!in_array($draft->status, ['review', 'approved'], true)) {
                    throw new EditorialException('state', 409);
                }
                if ($action === 'changes') {
                    $this->comment($draft, $actor, $this->text($input, 'content', 1, 5000));
                }
                $this->resetApprovals($draft);
                $draft->status = 'draft';
            } elseif ($action === 'approve_directly') {
                $actor->assertCan('el-choco-editorial.approveDirectly');
                if (!in_array($draft->status, ['draft', 'review', 'approved'], true) || trim($draft->content) === '') {
                    throw new EditorialException('state', 409);
                }
                $draft->direct_approved_by = $actor->id;
                $draft->direct_approved_version = $draft->content_version;
                $draft->status = 'approved';
            } elseif ($action === 'approve') {
                $actor->assertPermission($role === 'reviewer');
                if ($draft->status !== 'review') {
                    throw new EditorialException('state', 409);
                }
                $this->db->table('editorial_members')->where('draft_id', $id)->where('user_id', $actor->id)->update(['approved_version' => $draft->content_version]);
                if ($this->db->table('editorial_members')->where('draft_id', $id)->where('role', 'reviewer')->where('approved_version', $draft->content_version)->count() >= $draft->required_approvals) {
                    $draft->status = 'approved';
                }
            } elseif ($action === 'comment') {
                $actor->assertPermission($role !== 'manager' || $actor->can('el-choco-editorial.manage'));
                $this->comment($draft, $actor, $this->text($input, 'content', 1, 5000));
            } elseif ($action === 'publish') {
                $actor->assertPermission($owner);
                if ($draft->status !== 'approved') {
                    throw new EditorialException('state', 409);
                }
                $members = $this->db->table('editorial_members')->where('draft_id', $id)->where('role', 'reviewer')->where('approved_version', $draft->content_version)->pluck('user_id');
                $eligible = 0;
                foreach ($members as $userId) {
                    $user = User::find($userId);
                    $eligible += $user && $user->can('el-choco-editorial.use') ? 1 : 0;
                }
                if (!$this->directApprovalValid($draft) && $eligible < $draft->required_approvals) {
                    throw new EditorialException('reviewers');
                }
                $draft->discussion_id = $this->publisher->publish($actor, $draft, $request);
                $draft->status = 'published';
            } elseif ($action === 'archive') {
                $actor->assertPermission($owner || $actor->can('el-choco-editorial.manage'));
                $draft->status = 'archived';
                $this->resetApprovals($draft);
            } else {
                throw new EditorialException('invalid');
            }
            $draft->version++;
            $draft->updated_at = gmdate('Y-m-d H:i:s');
            $this->db->table('editorial_drafts')->where('id', $id)->update((array) $draft);
            $this->record($draft, $actor, $action, $detail, $snapshot);
            return false;
        });
        return $deleted ? ['deleted' => true] : $this->detail($actor, $id);
    }

    private function comment(object $draft, User $actor, string $content): void
    {
        if ($this->db->table('editorial_comments')->where('draft_id', $draft->id)->count() >= 500) {
            throw new EditorialException('limit');
        }
        $this->db->table('editorial_comments')->insert(['draft_id' => $draft->id, 'user_id' => $actor->id,
            'content_version' => $draft->content_version, 'content' => $content, 'created_at' => gmdate('Y-m-d H:i:s')]);
    }
}
