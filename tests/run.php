<?php

require $argv[1] ?? throw new RuntimeException('Pass a Flarum 2 vendor/autoload.php path.');
spl_autoload_register(function (string $class): void {
    if (str_starts_with($class, 'ElChoco\\Editorial\\')) {
        require dirname(__DIR__).'/src/'.substr($class, strlen('ElChoco\\Editorial\\')).'.php';
    }
});

use ElChoco\Editorial\Controller;
use ElChoco\Editorial\DraftService;
use ElChoco\Editorial\EditorialException;
use ElChoco\Editorial\Publisher;
use Flarum\Api\Client;
use Flarum\Api\ClientMiddlewarePipe;
use Flarum\Http\RequestUtil;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\Access\Gate;
use Flarum\User\Exception\PermissionDeniedException;
use Flarum\User\User;
use Illuminate\Container\Container;
use Illuminate\Database\Capsule\Manager;
use Illuminate\Database\Schema\Blueprint;
use Laminas\Diactoros\Response\JsonResponse;
use Laminas\Diactoros\ServerRequest;
use Psr\Http\Message\ServerRequestInterface;

$checks = 0;
function check(bool $condition, string $message): void {
    global $checks;
    if (!$condition) throw new RuntimeException($message);
    $checks++;
}
function rejects(callable $callback, string $reason): void {
    try { $callback(); } catch (EditorialException $error) {
        check($error->reason === $reason, 'Expected '.$reason.', got '.$error->reason);
        return;
    }
    throw new RuntimeException('Expected rejection: '.$reason);
}
function forbidden(callable $callback): void {
    try { $callback(); } catch (PermissionDeniedException $error) { check(true, 'Permission enforced'); return; }
    throw new RuntimeException('Expected permission denial');
}

$capsule = new Manager();
$capsule->addConnection(['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => 'ed_']);
$capsule->setAsGlobal();
$capsule->bootEloquent();
$db = $capsule->getConnection();
$schema = $db->getSchemaBuilder();
$schema->create('users', function (Blueprint $table): void { $table->increments('id'); $table->string('username'); });
$schema->create('discussions', function (Blueprint $table): void { $table->increments('id'); $table->string('title'); });
for ($i = 1; $i <= 7; $i++) $db->table('users')->insert(['id' => $i, 'username' => 'user'.$i]);
$migration = require dirname(__DIR__).'/migrations/2026_11_18_000000_create_editorial_tables.php';
$migration['up']($schema);
$upgradeId = $db->table('editorial_drafts')->insertGetId(['owner_id' => 1, 'title' => 'Existing 1.0.0 draft', 'content' => 'Keep this manuscript', 'tags' => '[]',
    'status' => 'draft', 'version' => 1, 'content_version' => 1, 'required_approvals' => 2, 'created_at' => gmdate('Y-m-d H:i:s'), 'updated_at' => gmdate('Y-m-d H:i:s')]);
$approvalMigration = require dirname(__DIR__).'/migrations/2026_11_21_000000_add_direct_approval.php';
$approvalMigration['up']($schema);
check($db->table('editorial_drafts')->where('id', $upgradeId)->value('content') === 'Keep this manuscript', 'Upgrade preserves existing 1.0.0 manuscript');
check($db->table('editorial_drafts')->where('id', $upgradeId)->value('direct_approved_by') === null, 'Existing manuscript does not acquire direct approval');
$db->table('editorial_drafts')->where('id', $upgradeId)->delete();
check($schema->hasTable('editorial_drafts'), 'Migration respects table prefix');

$gate = new class(new Container(), []) extends Gate {
    public array $revoked = [];
    public array $directUsers = [];
    public function allows(User $actor, string $ability, string|\Flarum\Database\AbstractModel|null $model): bool {
        if ($ability === 'el-choco-editorial.approveDirectly') return in_array((int) $actor->id, $this->directUsers, true);
        return $ability === 'el-choco-editorial.use' ? !in_array((int) $actor->id, array_merge([7], $this->revoked), true) : ($ability === 'el-choco-editorial.manage' && (int) $actor->id === 6);
    }
};
User::setGate($gate);
$settings = new class implements SettingsRepositoryInterface {
    public array $values = ['el-choco-editorial.approvals' => '2'];
    public function all(): array { return $this->values; }
    public function get(string $key, mixed $default = null): mixed { return $this->values[$key] ?? $default; }
    public function set(string $key, mixed $value): void { $this->values[$key] = $value; }
    public function delete(string $keyLike): void { unset($this->values[$keyLike]); }
};
$publisher = new class($db) extends Publisher {
    public bool $fail = false;
    public function __construct(private $db) {}
    public function publish(User $actor, object $draft, ServerRequestInterface $request): int {
        $id = $this->db->table('discussions')->insertGetId(['title' => $draft->title]);
        if ($this->fail) throw new EditorialException('publish_failed');
        return $id;
    }
};
$service = new DraftService($db, $settings, $publisher);
$owner = User::find(1); $reviewer = User::find(2); $editor = User::find(3); $stranger = User::find(4); $second = User::find(5); $manager = User::find(6); $denied = User::find(7);
$request = RequestUtil::withActor(new ServerRequest(), $owner);
$draft = $service->create($owner, ['title' => 'Team guide', 'content' => 'First version', 'tags' => [1, 1, 2]]);
$id = (int) $draft['draft']->id;
$act = function (User $actor, string $action, array $input = []) use ($service, $id, $request): array {
    $version = (int) $service->detail($actor, $id)['draft']->version;
    return $service->mutate($actor, $id, ['action' => $action, 'version' => $version] + $input, RequestUtil::withActor($request, $actor));
};
check($draft['draft']->tags === [1, 2], 'Unique validated category ids');
check((int) $draft['draft']->required_approvals === 2, 'Approval threshold captured on creation');
$settings->set('el-choco-editorial.approvals', '1');
check((int) $service->detail($owner, $id)['draft']->required_approvals === 2, 'Changing settings does not bypass existing review');
check($service->listing($stranger, 1)['total'] === 0, 'Private draft absent from stranger list');
rejects(fn () => $service->detail($stranger, $id), 'not_found');
rejects(fn () => $service->revision($stranger, $id, 1), 'not_found');
forbidden(fn () => $service->listing($denied, 1));
forbidden(fn () => $service->create($denied, ['title' => 'Blocked', 'content' => '']));
try { $service->listing(new \Flarum\User\Guest(), 1); throw new RuntimeException('Guest allowed'); }
catch (\Flarum\User\Exception\NotAuthenticatedException) { check(true, 'Guest blocked'); }
check($service->detail($manager, $id)['role'] === 'manager', 'Explicit manager can read private draft');
rejects(fn () => $act($owner, 'submit'), 'reviewers');
rejects(fn () => $act($owner, 'invite', ['username' => 'user1', 'role' => 'reviewer']), 'member');
rejects(fn () => $act($owner, 'invite', ['username' => 'user7', 'role' => 'reviewer']), 'member');
rejects(fn () => $act($owner, 'invite', ['username' => 'user2', 'role' => 'owner']), 'invalid');
$act($owner, 'invite', ['username' => 'user2', 'role' => 'reviewer']);
$act($owner, 'invite', ['username' => 'user3', 'role' => 'editor']);
$act($owner, 'invite', ['username' => 'user5', 'role' => 'reviewer']);
if (isset($argv[2])) {
    file_put_contents($argv[2], json_encode($service->detail($owner, $id), JSON_THROW_ON_ERROR));
}
check($service->listing($editor, 1)['total'] === 1, 'Invitation appears in editor workspace');
forbidden(fn () => $act($editor, 'invite', ['username' => 'user4', 'role' => 'reviewer']));
forbidden(fn () => $act($reviewer, 'save', ['title' => 'Bad edit', 'content' => 'Changed']));
forbidden(fn () => $act($manager, 'save', ['title' => 'Bad edit', 'content' => 'Changed']));
$oldVersion = (int) $service->detail($editor, $id)['draft']->version;
$act($owner, 'comment', ['content' => 'Internal <script>alert(1)</script>']);
rejects(fn () => $service->mutate($editor, $id, ['action' => 'save', 'version' => $oldVersion, 'title' => 'Stale edit', 'content' => 'Lost?'], $request), 'conflict');
check($service->detail($owner, $id)['draft']->content === 'First version', 'Stale save does not overwrite text');
$saved = $act($editor, 'save', ['title' => 'Team guide edited', 'content' => 'Edited version', 'tags' => [2]]);
check((int) $saved['draft']->content_version === 2, 'Editor creates text revision');
$savedRevisionId = $db->table('editorial_revisions')->where('draft_id', $id)->where('action', 'save')->value('id');
$comparison = $service->revision($reviewer, $id, $savedRevisionId);
check($comparison['previous']->content === 'First version', 'Comparison uses preceding text snapshot, skipping comments and invitations');
check($comparison['previous']->tags === [1, 2] && $comparison['revision']->tags === [2], 'Comparison includes old and new categories');
if (isset($argv[2])) file_put_contents($argv[2].'.comparison.json', json_encode($comparison, JSON_THROW_ON_ERROR));
$firstRevision = $db->table('editorial_revisions')->where('draft_id', $id)->where('action', 'create')->value('id');
check($service->revision($reviewer, $id, $firstRevision)['revision']->content === 'First version', 'Team can inspect old snapshot');
$restored = $act($editor, 'restore', ['revision' => $firstRevision]);
check($restored['draft']->content === 'First version' && (int) $restored['draft']->content_version === 3, 'Restore creates a new revision');
check($db->table('editorial_revisions')->where('draft_id', $id)->whereNotNull('content')->count() === 3, 'Restore preserves all snapshots');
$act($owner, 'submit');
check(!$service->detail($editor, $id)['canEdit'], 'Review freezes text');
rejects(fn () => $act($editor, 'save', ['title' => 'During review', 'content' => 'No']), 'state');
forbidden(fn () => $act($owner, 'approve'));
forbidden(fn () => $act($editor, 'approve'));
check($act($reviewer, 'approve')['draft']->status === 'review', 'One approval insufficient for two-reviewer draft');
check($act($reviewer, 'approve')['approvals'] === 1, 'Repeated approval cannot count twice');
$act($reviewer, 'changes', ['content' => 'Please clarify the instructions.']);
check($service->detail($owner, $id)['approvals'] === 0, 'Requested changes clear approvals');
check($service->detail($owner, $id)['draft']->status === 'draft', 'Requested changes reopen draft');
$act($owner, 'submit'); $act($reviewer, 'approve');
check($act($second, 'approve')['draft']->status === 'approved', 'Required approvals transition to approved');
forbidden(fn () => $act($editor, 'publish'));
$gate->revoked = [5];
rejects(fn () => $act($owner, 'publish'), 'reviewers');
check($db->table('discussions')->count() === 0, 'Revoked reviewer cannot authorize publication');
$gate->revoked = [];
$publisher->fail = true;
rejects(fn () => $act($owner, 'publish'), 'publish_failed');
check($db->table('discussions')->count() === 0, 'Publication failure rolls back database side effects');
check($service->detail($owner, $id)['draft']->status === 'approved', 'Failed publish retains approved draft');
$publisher->fail = false;
$published = $act($owner, 'publish');
check($published['draft']->status === 'published' && (int) $published['draft']->discussion_id > 0, 'Publish links discussion');
rejects(fn () => $act($owner, 'publish'), 'closed');
check($db->table('discussions')->count() === 1, 'Retry cannot create second discussion');
rejects(fn () => $act($editor, 'comment', ['content' => 'after publication']), 'closed');
forbidden(fn () => $act($reviewer, 'delete'));
$act($owner, 'delete');
check($db->table('discussions')->count() === 1, 'Deleting manuscript preserves published discussion');
foreach (['editorial_members', 'editorial_comments', 'editorial_revisions'] as $table) check($db->table($table)->where('draft_id', $id)->count() === 0, 'Delete removes '.$table);
rejects(fn () => $service->detail($owner, $id), 'not_found');

foreach ([['title' => 'ab', 'content' => ''], ['title' => 'Valid', 'content' => str_repeat('x', 63001)], ['title' => 'Valid', 'content' => '', 'tags' => ['1 OR 1=1']], ['title' => 'Valid', 'content' => [], 'tags' => []]] as $bad) rejects(fn () => $service->create($owner, $bad), 'invalid');
$next = $service->create($owner, ['title' => 'Another manuscript', 'content' => 'Text']);
$nextId = (int) $next['draft']->id;
$service->mutate($owner, $nextId, ['action' => 'invite', 'version' => 1, 'username' => 'user2', 'role' => 'reviewer'], $request);
$service->mutate($owner, $nextId, ['action' => 'remove', 'version' => 2, 'userId' => 2], $request);
rejects(fn () => $service->detail($reviewer, $nextId), 'not_found');
$controller = new Controller($service);
$response = $controller->handle($request->withQueryParams(['id' => $nextId])->withMethod('POST')->withParsedBody(['action' => 'archive', 'version' => 1]));
check($response->getStatusCode() === 409, 'Controller exposes concurrency conflict');
check(json_decode((string) $response->getBody(), true)['errors'][0]['code'] === 'conflict', 'Machine-readable conflict code');
check($response->getHeaderLine('Cache-Control') === 'no-store, private', 'Private API disables caching');
$response = $controller->handle($request->withQueryParams(['id' => '1 OR 1=1']));
check($response->getStatusCode() === 404, 'Invalid route id rejected');
$response = $controller->handle($request->withQueryParams(['page' => []]));
check($response->getStatusCode() === 422, 'Malformed pagination rejected');
$service->mutate($owner, $nextId, ['action' => 'archive', 'version' => 3], $request);
rejects(fn () => $service->mutate($owner, $nextId, ['action' => 'save', 'version' => 4, 'title' => 'Archived edit', 'content' => 'No'], $request), 'closed');

$settings->set('el-choco-editorial.approvals', '2');
$direct = $service->create($owner, ['title' => 'Direct approval manuscript', 'content' => 'Direct text']);
$directId = (int) $direct['draft']->id;
$directAction = function (User $actor, string $action, array $input = []) use ($service, $directId, $request): array {
    $version = (int) $service->detail($actor, $directId)['draft']->version;
    return $service->mutate($actor, $directId, ['action' => $action, 'version' => $version] + $input, RequestUtil::withActor($request, $actor));
};
forbidden(fn () => $directAction($owner, 'approve_directly'));
$gate->directUsers = [1, 4];
check($service->detail($owner, $directId)['canApproveDirectly'], 'Explicit group right permits owner direct approval');
rejects(fn () => $service->detail($stranger, $directId), 'not_found');
check($service->listing($stranger, 1)['total'] === 0, 'Direct approval right does not grant access to private drafts');
$direct = $directAction($owner, 'approve_directly');
check($direct['draft']->status === 'approved' && $direct['approvals'] === 0, 'Direct approval bypasses two-reviewer count without fake reviewer votes');
check($direct['directApproval']['valid'] && $direct['directApproval']['userId'] === 1 && $direct['canPublish'], 'Direct approval records actor and authorizes owner publication');
check($direct['history']->first()->action === 'approve_directly', 'Direct approval is visible in history');
$gate->directUsers = [4];
check(!$service->detail($owner, $directId)['canPublish'], 'Revoked direct approval no longer authorizes publication');
rejects(fn () => $directAction($owner, 'publish'), 'reviewers');
$gate->directUsers = [1];
$directAction($owner, 'reopen');
$reopened = $service->detail($owner, $directId);
check($reopened['directApproval'] === null && !$reopened['canPublish'], 'Reopening clears direct approval');
$directAction($owner, 'save', ['title' => 'Direct approval edited', 'content' => 'Changed text', 'tags' => []]);
check($service->detail($owner, $directId)['directApproval'] === null, 'Text changes cannot retain direct approval');
$oldDirectVersion = (int) $service->detail($owner, $directId)['draft']->version;
$directAction($owner, 'comment', ['content' => 'A concurrent comment']);
rejects(fn () => $service->mutate($owner, $directId, ['action' => 'approve_directly', 'version' => $oldDirectVersion], $request), 'conflict');
$gate->directUsers = [6];
forbidden(fn () => $directAction($owner, 'approve_directly'));
$direct = $directAction($manager, 'approve_directly');
check($direct['directApproval']['userId'] === 6, 'Authorised manager can directly approve an accessible draft');
forbidden(fn () => $directAction($manager, 'publish'));
$gate->revoked = [6];
rejects(fn () => $directAction($owner, 'publish'), 'reviewers');
$gate->revoked = [];
check($directAction($owner, 'publish')['draft']->status === 'published', 'Owner publishes draft approved by authorised manager');
$gate->directUsers = [];
$empty = $service->create($owner, ['title' => 'Empty direct draft', 'content' => '']);
$gate->directUsers = [1];
check(!$empty['canApproveDirectly'], 'Empty draft does not offer direct approval');
rejects(fn () => $service->mutate($owner, (int) $empty['draft']->id, ['action' => 'approve_directly', 'version' => 1], $request), 'state');
rejects(fn () => $service->revision($owner, $directId, $savedRevisionId), 'not_found');
$gate->directUsers = [];

$settings->set('el-choco-editorial.home_title', 'Our editorial desk');
$settings->set('el-choco-editorial.home_description', '<script>not executed</script>');
$settings->set('el-choco-editorial.home_welcome', 'Team instructions');
$settings->set('el-choco-editorial.home_banner', '0');
$settings->set('el-choco-editorial.home_layout', 'list');
$settings->set('el-choco-editorial.home_status', 'archived');
$settings->set('el-choco-editorial.home_sort', 'title');
$home = $service->listing($owner, 1);
check($home['home']['title'] === 'Our editorial desk' && !$home['home']['banner'] && $home['home']['layout'] === 'list', 'Homepage settings reach the API');
check($home['status'] === 'archived' && $home['sort'] === 'title' && $home['items']->every(fn ($row) => $row->status === 'archived'), 'Default homepage filter applies before pagination');
$filtered = $service->listing($owner, 1, 'published', 'latest');
check($filtered['total'] === 1 && $filtered['items']->first()->id == $directId, 'Member can override default filter within own access scope');
rejects(fn () => $service->listing($owner, 1, 'private'), 'invalid');
rejects(fn () => $service->listing($owner, 1, 'all', 'title; DROP TABLE users'), 'invalid');
$response = $controller->handle($request->withQueryParams(['status' => []]));
check($response->getStatusCode() === 422, 'Malformed status filter rejected');
$settings->set('el-choco-editorial.home_title', str_repeat('x', 300));
check(mb_strlen($service->listing($owner, 1)['home']['title']) === 120, 'Homepage text is bounded');

$container = new Container();
$capture = new class implements \Psr\Http\Server\MiddlewareInterface {
    public ?ServerRequestInterface $request = null;
    public function process(ServerRequestInterface $request, \Psr\Http\Server\RequestHandlerInterface $handler): \Psr\Http\Message\ResponseInterface {
        $this->request = $request;
        return new JsonResponse(['data' => ['type' => 'discussions', 'id' => '42']]);
    }
};
$container->instance('editorial.test.capture', $capture);
$pipe = new ClientMiddlewarePipe($container, ['editorial.test.capture']);
$realPublisher = new Publisher(new Client($pipe));
$publishedId = $realPublisher->publish($owner, (object) ['title' => 'API guide', 'content' => '**Body**', 'tags' => '[2,3]'], $request);
check($publishedId === 42, 'Publisher uses actual Flarum API client');
check($capture->request->getUri()->getPath() === '/discussions', 'Uses standard discussion endpoint');
check(RequestUtil::getActor($capture->request)->id === $owner->id, 'Publishing actor remains owner');
check($capture->request->getParsedBody()['data']['relationships']['tags']['data'][0]['id'] === '2', 'Tags use JSON:API relationship structure');
check($capture->request->getParsedBody()['data']['attributes']['content'] === '**Body**', 'Raw post markup preserved');
foreach (require dirname(__DIR__).'/extend.php' as $extender) {
    check($extender instanceof \Flarum\Extend\ExtenderInterface, 'Extension registers a real Flarum 2 extender');
}
$approvalMigration['down']($schema);
$migration['down']($schema);
check(!$schema->hasTable('editorial_drafts'), 'Purge migration removes editorial tables');
echo $checks." checks passed with real Flarum 2 dependencies and an isolated SQLite database.\n";
