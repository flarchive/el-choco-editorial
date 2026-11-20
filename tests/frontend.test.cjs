const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const { test } = require('node:test');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const mithril = require(path.join(root, 'js/node_modules/mithril'));

const fixture = {
  version: '0.1.0-alpha.2', draft: { id: 7, owner_id: 1, title: 'A useful guide', content: 'Saved text', tags: [1],
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
