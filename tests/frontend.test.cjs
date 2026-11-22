const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const { test } = require('node:test');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const mithril = require(path.join(root, 'js/node_modules/mithril'));

const fixture = {
  version: '1.0.1', draft: { id: 7, owner_id: 1, title: 'A useful guide', content: 'Saved text', tags: [1],
    status: 'draft', version: 4, content_version: 2, required_approvals: 1, updated_at: '2026-11-18 10:00:00', discussion_id: null },
  role: 'owner', canEdit: true, canApprove: false, canPublish: false, approvals: 0,
  members: [{ user_id: 2, role: 'reviewer', approved_version: null }], users: { 1: 'Owner', 2: 'Reviewer' }, history: [], comments: [],
};

function setup() {
  const modules = {}; const calls = []; const listeners = new Map(); const navigations = [];
  let confirmResult = true;
  const app = {
    session: { user: { id: () => '1' } }, store: { models: {} },
    forum: { attribute: (key) => key === 'apiUrl' ? 'https://forum.test/sub/api' : true },
    translator: { trans: (key) => key.split('.').pop(), getLocale: () => 'de' },
    route: (name, params = {}) => name === 'editorial' ? '/editorial' : '/editorial/' + params.id,
    initializers: { add: () => {} },
    request: async (options) => { calls.push(options); return structuredClone(fixture); },
  };
  class Page { oninit(vnode) { this.attrs = vnode.attrs; } onremove() {} }
  class TextEditor { buildEditorParams() { return { classNames: [] }; } onremove() {} }
  class ComposerState { constructor() { let content = ''; this.fields = { content: (...args) => args.length ? content = args[0] : content }; } }
  class Routes { add() { return this; } }
  class Link { view(vnode) { return mithril('a', vnode.attrs, vnode.children); } }
  class Sidebar {}
  const core = { 'forum/app': app, 'common/components/Page': Page, 'common/components/Link': Link,
    'common/components/LinkButton': Link, 'common/components/LoadingIndicator': Link, 'common/components/TextEditor': TextEditor, 'forum/states/ComposerState': ComposerState,
    'common/extenders/Routes': Routes, 'common/extend': { extend: () => {} }, 'forum/components/IndexSidebar': Sidebar };
  const m = (...args) => mithril(...args); m.redraw = () => {}; m.redraw.sync = () => {};
  m.route = { param: () => '7', set: (value) => navigations.push(value) };
  const window = { addEventListener: (name, handler) => listeners.set(name, handler), removeEventListener: (name) => listeners.delete(name), confirm: () => confirmResult };
  const context = { m, window, Blob, URL, setTimeout, clearTimeout, console, module: { exports: {} }, flarum: { reg: { get: (_, name) => core[name], add: (_, name, value) => { modules[name] = value; } } } };
  runInNewContext(readFileSync(path.join(root, 'js/dist/forum.js'), 'utf8'), context);
  const page = new modules.forum.EditorialDraft();
  page.oninit({ attrs: { id: '7' } });
  return { app, page, modules, calls, listeners, navigations, context, setConfirm: (value) => { confirmResult = value; } };
}
const tick = () => new Promise((resolve) => setImmediate(resolve));

test('draft route loads from the forum API base and renders with real Mithril', async () => {
  const { page, calls } = setup(); await tick();
  assert.equal(calls[0].url, 'https://forum.test/sub/api/editorial/7');
  assert.equal(page.title, fixture.draft.title);
  assert.doesNotThrow(() => page.view());
  assert.equal(page.dirty(), false);
});

test('save includes the server version and current manuscript', async () => {
  const { page, app, calls } = setup(); await tick();
  page.content = 'My edited text';
  app.request = async (options) => { calls.push(options); return { ...structuredClone(fixture), draft: { ...fixture.draft, version: 5, content: 'My edited text' } }; };
  await page.action('save', { title: page.title, content: page.content, tags: page.tags });
  assert.equal(calls.at(-1).method, 'POST');
  assert.equal(calls.at(-1).body.version, 4);
  assert.equal(calls.at(-1).body.content, 'My edited text');
  assert.equal(page.dirty(), false);
});

test('conflicts preserve the local manuscript and show recovery guidance', async () => {
  const { page, app } = setup(); await tick();
  page.content = 'Keep my unsaved work';
  app.request = async () => { throw { response: { errors: [{ code: 'conflict' }] } }; };
  await page.action('save', { title: page.title, content: page.content, tags: page.tags });
  assert.equal(page.content, 'Keep my unsaved work');
  assert.equal(page.error, 'conflict');
  assert.equal(page.busy, false);
  assert.doesNotThrow(() => page.view());
});

test('unsaved changes block workflow actions and cancelling reload keeps text', async () => {
  const { page, calls, setConfirm } = setup(); await tick();
  page.content = 'Unsaved';
  const count = calls.length;
  await page.action('submit');
  assert.equal(page.error, 'unsaved');
  assert.equal(calls.length, count);
  setConfirm(false);
  await page.load(true);
  assert.equal(page.content, 'Unsaved');
  assert.equal(calls.length, count);
});

test('publication requires explicit confirmation and sends a versioned action', async () => {
  const { page, app, setConfirm } = setup(); await tick();
  let posts = 0;
  app.request = async (options) => { posts++; assert.equal(options.body.action, 'publish'); return structuredClone(fixture); };
  setConfirm(false); await page.action('publish'); assert.equal(posts, 0);
  setConfirm(true); await page.action('publish'); assert.equal(posts, 1);
});

test('draft buffers survive internal page navigation without browser storage', async () => {
  const { page, modules } = setup(); await tick();
  page.content = 'Unfinished manuscript'; page.comment = 'Unsent feedback';
  page.onremove({});
  const next = new modules.forum.EditorialDraft(); next.oninit({ attrs: { id: '7' } }); await tick();
  assert.equal(next.content, 'Unfinished manuscript');
  assert.equal(next.comment, 'Unsent feedback');
  assert.equal(next.recovered, true);
  next.onremove({});
});

test('restored buffers with a newer server version cannot silently overwrite it', async () => {
  const { page, modules, app } = setup(); await tick();
  page.content = 'Old local work'; page.onremove({});
  app.request = async () => ({ ...structuredClone(fixture), draft: { ...fixture.draft, version: 9, content: 'New work by teammate' } });
  const next = new modules.forum.EditorialDraft(); next.oninit({ attrs: { id: '7' } }); await tick();
  assert.equal(next.content, 'Old local work');
  assert.equal(next.error, 'conflict');
  assert.equal(next.data.draft.version, 4);
  next.onremove({});
});

test('late responses after leaving do not replace the previous state', async () => {
  const { page, app } = setup(); await tick();
  let resolve;
  app.request = () => new Promise((done) => { resolve = done; });
  const pending = page.load(); page.onremove({});
  resolve({ ...structuredClone(fixture), draft: { ...fixture.draft, content: 'Late replacement' } });
  await pending;
  assert.equal(page.content, 'Saved text');
});

test('reload and tab closing warn about unsaved manuscript and comments', async () => {
  const { page, listeners } = setup(); await tick();
  let prevented = false;
  page.comment = 'Pending feedback';
  const event = { preventDefault: () => { prevented = true; } };
  listeners.get('beforeunload')(event);
  assert.equal(prevented, true);
  page.onremove({}); assert.equal(listeners.has('beforeunload'), false);
});

test('text is rendered as text nodes and editorial styles are scoped', () => {
  const source = readFileSync(path.join(root, 'js/src/forum.js'), 'utf8');
  assert.doesNotMatch(source, /m\.trust|innerHTML|localStorage|sessionStorage/);
  assert.match(readFileSync(path.join(root, 'less/forum.less'), 'utf8'), /^\.Editorial\s*\{/);
});

test('member lookup starts after three characters and selects exact usernames', async () => {
  const { page, app } = setup(); await tick();
  const found = { id: () => '2', username: () => 'marcus', displayName: () => 'Marcus' };
  let lookups = 0;
  app.store.find = async (type, query) => { lookups++; assert.equal(type, 'users'); assert.equal(query.filter.q, 'mar'); return [found]; };
  page.searchMembers('ma');
  await new Promise((resolve) => setTimeout(resolve, 280));
  assert.equal(lookups, 0);
  page.searchMembers('mar');
  await new Promise((resolve) => setTimeout(resolve, 280));
  assert.equal(lookups, 1);
  assert.equal(page.suggestions[0].username(), 'marcus');
  let prevented = false;
  page.memberKey({ key: 'Enter', preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(page.username, 'marcus');
  assert.equal(page.suggestions.length, 0);
});

test('outdated member searches cannot replace newer results', async () => {
  const { page, app } = setup(); await tick();
  let finishOld;
  app.store.find = () => new Promise((resolve) => { finishOld = resolve; });
  page.searchMembers('old');
  await new Promise((resolve) => setTimeout(resolve, 280));
  page.searchMembers('ne');
  finishOld([{ id: () => '2', username: () => 'old-user' }]);
  await tick();
  assert.equal(page.suggestions.length, 0);
  assert.equal(page.username, 'ne');
});

test('native editor inherits core tools and remains isolated from the global composer', async () => {
  const { page, modules, app } = setup(); await tick();
  assert.equal(app.composer, undefined);
  assert.equal(page.composer.fields.content(), 'Saved text');
  const editor = new modules.forum.EditorialTextEditor();
  assert.equal(editor.buildEditorParams().classNames.includes('Editorial-content'), true);
  const source = readFileSync(path.join(root, 'js/src/forum.js'), 'utf8');
  assert.match(source, /extends TextEditor/);
  assert.doesNotMatch(source, /toolbarItems\(\)/);
});

test('line comparison marks additions, removals and unchanged line numbers', () => {
  const { modules } = setup();
  const diff = modules.forum.lineDiff('one\ntwo\nthree', 'one\nnew\nthree');
  assert.equal(diff.added, 1);
  assert.equal(diff.removed, 1);
  assert.equal(diff.rows.find((row) => row.kind === 'delete').text, 'two');
  assert.equal(diff.rows.find((row) => row.kind === 'add').text, 'new');
  assert.equal(diff.rows.at(-1).oldLine, 3);
  assert.equal(diff.rows.at(-1).newLine, 3);
  assert.equal(diff.coarse, false);
});

test('diff reconstruction preserves repeated lines and untrusted markup', () => {
  const { modules } = setup();
  let seed = 17;
  const random = () => { seed = (seed * 16807) % 2147483647; return seed; };
  const options = ['A', 'B', '<script>alert(1)</script>', ''];
  for (let count = 0; count < 100; count++) {
    const before = Array.from({ length: random() % 5 + 1 }, () => options[random() % options.length]).join('\n');
    const after = Array.from({ length: random() % 5 + 1 }, () => options[random() % options.length]).join('\n');
    const diff = modules.forum.lineDiff(before, after);
    assert.equal(diff.rows.filter((row) => row.kind !== 'add').map((row) => row.text).join('\n'), before);
    assert.equal(diff.rows.filter((row) => row.kind !== 'delete').map((row) => row.text).join('\n'), after);
  }
});

test('large comparisons are bounded and unchanged context is collapsed', () => {
  const { modules } = setup();
  const large = modules.forum.lineDiff('', 'A\n'.repeat(31000));
  assert.equal(large.rows.length, 1000);
  assert.equal(large.truncated, true);
  assert.equal(large.coarse, true);
  const unchanged = modules.forum.lineDiff('line\n'.repeat(100), 'line\n'.repeat(100));
  assert.equal(unchanged.added + unchanged.removed, 0);
  assert.equal(unchanged.rows.some((row) => row.kind === 'skip'), true);
});

test('history loads the previous snapshot and shows a text-only comparison', async () => {
  const { page, app } = setup(); await tick();
  page.tab = 'history';
  app.request = async () => ({ revision: { id: 9, content_version: 2, title: 'New title', content: 'one\n<script>new</script>', tags: [2] },
    previous: { id: 3, content_version: 1, title: 'Old title', content: 'one\nold', tags: [1] } });
  await page.showRevision(9);
  assert.equal(page.previousSnapshot.content_version, 1);
  assert.equal(page.comparison.added, 1);
  assert.equal(page.comparison.removed, 1);
  assert.doesNotThrow(() => page.view());
});

test('direct approval is a separate versioned action with explicit confirmation', async () => {
  const { page, app, setConfirm } = setup(); await tick();
  let posts = 0;
  app.request = async (options) => { posts++; assert.equal(options.body.action, 'approve_directly'); assert.equal(options.body.version, 4); return structuredClone(fixture); };
  setConfirm(false); await page.action('approve_directly'); assert.equal(posts, 0);
  setConfirm(true); await page.action('approve_directly'); assert.equal(posts, 1);
});

test('homepage applies server configuration and sends scoped sort/filter choices', async () => {
  const { app, modules, calls } = setup(); await tick();
  app.request = async (options) => { calls.push(options); return { home: { banner: false, title: '<b>Custom title</b>', welcome: 'Team instructions', layout: 'list' },
    items: [], page: 1, status: 'review', sort: 'title', hasMore: false, total: 0 }; };
  const index = new modules.forum.EditorialIndex(); index.oninit({ attrs: {} }); await tick();
  assert.equal(index.filter, 'review');
  assert.equal(index.sort, 'title');
  assert.equal(index.data.home.banner, false);
  assert.doesNotThrow(() => index.view());
  index.filter = 'draft'; await index.load();
  assert.equal(calls.at(-1).params.status, 'draft');
  assert.equal(calls.at(-1).params.sort, 'title');
  index.onremove({});
});

test('admin bundle registers homepage controls and a distinct direct-approval right', () => {
  const { app, context, modules } = setup();
  class Admin {
    constructor() { this.settings = []; this.permissions = []; }
    setting(factory) { this.settings.push(factory); return this; }
    permission(factory) { this.permissions.push(factory); return this; }
  }
  context.flarum.reg.get = (_, name) => ({ 'admin/app': app, 'common/extenders/Admin': Admin }[name]);
  runInNewContext(readFileSync(path.join(root, 'js/dist/admin.js'), 'utf8'), context);
  const admin = modules.admin.extend[0];
  assert.equal(admin.settings.length, 11);
  assert.equal(admin.settings.some((factory) => factory().setting === 'el-choco-editorial.label_blog'), true);
  assert.equal(admin.settings.some((factory) => factory().setting === 'el-choco-editorial.home_title'), true);
  assert.equal(admin.settings.some((factory) => factory().setting === 'el-choco-editorial.home_sort'), true);
  assert.equal(admin.permissions.some((factory) => factory().permission === 'el-choco-editorial.approveDirectly'), true);
});

test('Publication fields preserve technical targets and custom display names', async () => {
  const { page } = setup(); await tick();
  page.data.publication = { targets: [{ type: 'discussion', label: '', available: true }, { type: 'blog', label: 'Wiki', available: true },
    { type: 'wiki', label: 'Knowledge base', available: false }], blogTags: [1] };
  assert.equal(page.targetLabel('blog'), 'Wiki');
  const fields = page.publicationFields(true);
  const select = fields.children.find(node => node?.attrs?.id === 'editorial-publication-type');
  assert.deepEqual(select.children.map(node => node.attrs.value), ['discussion', 'blog']);
  select.attrs.onchange({ target: { value: 'blog' } });
  page.publicationOptions.summary = 'Shared summary'; page.publicationOptions.image = 'https://example.test/image.png';
  assert.equal(page.dirty(), true);
  const input = page.manuscriptInput();
  assert.equal(input.publication_type, 'blog'); assert.equal(input.publication_options.summary, 'Shared summary');
});

test('Target metadata is kept in navigation recovery buffers and versioned saves', async () => {
  const { page, modules } = setup(); await tick();
  page.publicationType = 'wiki'; page.publicationOptions = { category: 5, slug: 'team-guide' };
  page.onremove({});
  const next = new modules.forum.EditorialDraft(); next.oninit({ attrs: { id: '7' } }); await tick();
  assert.equal(next.publicationType, 'wiki'); assert.equal(next.publicationOptions.category, 5);
  assert.equal(next.dirty(), true); next.onremove({});
});

test('Wiki publication uses a wiki link and stays disabled when integration routes are absent', async () => {
  const { page, app } = setup(); await tick();
  const draft = { publication_type: 'wiki', publication_id: 41, discussion_id: null };
  app.routes = {};
  assert.equal(page.publicationLink(draft), null);
  app.routes['linkrobins-wiki.show'] = {};
  app.route = (name, params) => name + '/' + params.id;
  assert.equal(page.publicationLink(draft).attrs.href, 'linkrobins-wiki.show/41');
  app.routes['blog.post'] = {};
  assert.equal(page.publicationLink({ publication_type: 'blog', publication_id: 42 }).attrs.href, 'blog.post/42');
});

test('Wiki categories are loaded from their native API and malicious labels stay text', async () => {
  const { page, app, calls } = setup(); await tick();
  app.request = async (options) => { calls.push(options); return { data: [{ id: '5', attributes: { name: '<img onerror=alert(1)>' } }] }; };
  await page.loadWikiCategories();
  assert.equal(page.wikiCategories[0].id, '5');
  assert.equal(calls.at(-1).url, 'https://forum.test/sub/api/linkrobins-wiki-categories');
  page.publicationType = 'wiki'; page.publicationOptions = { category: 5, slug: '' };
  assert.doesNotThrow(() => page.publicationFields(false));
});

test('Publication confirmation names the configured target before sending a request', async () => {
  const { page, app, context, calls } = setup(); await tick();
  page.data.publication = { targets: [{ type: 'blog', label: 'My Wiki', available: true }] };
  page.data.draft.publication_type = 'blog'; page.publicationType = 'blog';
  let message;
  app.translator.trans = (key, values = {}) => key.endsWith('confirm_publish') ? 'Publish as ' + values.target : key;
  context.window.confirm = text => { message = text; return false; };
  const before = calls.length; await page.action('publish');
  assert.equal(message, 'Publish as My Wiki'); assert.equal(calls.length, before);
});
