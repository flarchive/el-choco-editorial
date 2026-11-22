import app from 'flarum/forum/app';
import Page from 'flarum/common/components/Page';
import Link from 'flarum/common/components/Link';
import LinkButton from 'flarum/common/components/LinkButton';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import TextEditor from 'flarum/common/components/TextEditor';
import ComposerState from 'flarum/forum/states/ComposerState';
import Routes from 'flarum/common/extenders/Routes';
import { extend as extendMethod } from 'flarum/common/extend';
import IndexSidebar from 'flarum/forum/components/IndexSidebar';
import { lineDiff } from './lineDiff';

export { lineDiff };

const tr = (key, values = {}) => app.translator.trans('el-choco-editorial.forum.' + key, values);
const txt = (key, values = {}) => { const value = tr(key, values); return Array.isArray(value) ? value.join('') : String(value); };
const endpoint = (path = '') => app.forum.attribute('apiUrl') + '/editorial' + path;
const icon = (name) => m('i', { className: 'fas fa-' + name, 'aria-hidden': 'true' });
const date = (value) => new Date(value.replace(' ', 'T') + (value.endsWith('Z') ? '' : 'Z')).toLocaleString(app.translator.getLocale().split(/[_@]/)[0]);
const status = (value) => m('span.Editorial-status', { 'data-status': value }, tr('status_' + value));
const pendingManuscripts = new Map();
const errorCode = (error) => {
  const code = error?.response?.errors?.[0]?.code;
  return ['conflict', 'not_found', 'invalid', 'limit', 'closed', 'state', 'member', 'reviewers', 'publish_failed', 'target_unavailable', 'blog_tag_required', 'blog_tag_discussion', 'wiki_category_invalid', 'permission_denied'].includes(code) ? code : 'request';
};
const button = (label, onclick, disabled = false, primary = false) => m('button.Button', {
  type: 'button', className: primary ? 'Button--primary' : '', onclick, disabled,
}, tr(label));

export class EditorialTextEditor extends TextEditor {
  buildEditorParams() {
    const params = super.buildEditorParams();
    params.classNames.push('Editorial-content');
    return params;
  }

  onbuild() {
    super.onbuild();
    this.editorDriver = this.attrs.composer.editor;
    const editor = this.$('.TextEditor-editor')[0];
    if (editor) {
      editor.id = 'editorial-content';
      editor.setAttribute('aria-label', txt('content'));
      if (editor.tagName === 'TEXTAREA') editor.maxLength = 63000;
    }
  }

  onremove(vnode) {
    super.onremove(vnode);
    this.editorDriver?.destroy();
    if (this.attrs.composer.editor === this.editorDriver) this.attrs.composer.editor = null;
  }
}

export class EditorialIndex extends Page {
  oninit(vnode) {
    super.oninit(vnode);
    this.page = 1;
    this.filter = null;
    this.sort = null;
    this.loadRevision = 0;
    this.title = '';
    this.active = true;
    this.load();
  }

  onremove(vnode) { this.active = false; super.onremove(vnode); }

  async load() {
    const revision = ++this.loadRevision;
    this.loading = true;
    this.error = '';
    const params = { page: this.page };
    if (this.filter !== null) params.status = this.filter;
    if (this.sort !== null) params.sort = this.sort;
    try {
      const data = await app.request({ url: endpoint(), params, errorHandler: () => {} });
      if (this.active && revision === this.loadRevision) { this.data = data; this.filter = data.status || 'all'; this.sort = data.sort || 'latest'; }
    } catch (error) { if (this.active && revision === this.loadRevision) this.error = errorCode(error); }
    finally { if (this.active && revision === this.loadRevision) { this.loading = false; m.redraw(); } }
  }

  async create() {
    this.busy = true;
    this.error = '';
    try {
      const data = await app.request({ method: 'POST', url: endpoint(), body: { title: this.title, content: '', tags: [] }, errorHandler: () => {} });
      if (this.active) m.route.set(app.route('editorial.draft', { id: data.draft.id }));
    } catch (error) { if (this.active) this.error = errorCode(error); }
    finally { if (this.active) { this.busy = false; m.redraw(); } }
  }

  view() {
    const home = this.data?.home || {};
    return m('.Editorial', m('.container', [
      home.banner !== false && m('header.Editorial-hero', [m('span.Editorial-eyebrow', 'el-choco · Editorial'), m('h1', home.title || tr('heading')),
        m('p', home.description || tr('intro')), m('.Editorial-heroMark', { 'aria-hidden': 'true' }, icon('pen-nib'))]),
      home.welcome && m('section.Editorial-card.Editorial-welcome', home.welcome),
      !app.session.user ? m('.Editorial-card', tr('access')) : [
        m('form.Editorial-card.Editorial-create', { onsubmit: (event) => { event.preventDefault(); if (!this.busy && this.title.trim().length >= 3) this.create(); } }, [
          m('label', { for: 'editorial-new-title' }, tr('new_title')),
          m('input.FormControl', { id: 'editorial-new-title', value: this.title, maxlength: 80, minlength: 3, required: true,
            placeholder: txt('title_placeholder'), oninput: (event) => { this.title = event.target.value; } }),
          m('button.Button.Button--primary', { type: 'submit', disabled: this.busy || this.title.trim().length < 3 }, [icon('plus'), ' ', tr('create')]),
        ]),
        this.error && m('.Alert.Alert--error', { role: 'alert' }, tr('error_' + this.error)),
        m('.Editorial-toolbar', [m('h2', tr('workspace')), button('refresh', () => this.load(), this.loading)]),
        this.data && m('.Editorial-homeFilters', [
          m('label', [tr('filter_status'), m('select.FormControl', { value: this.filter, disabled: this.loading, onchange: (event) => { this.filter = event.target.value; this.page = 1; this.load(); } },
            ['all', 'draft', 'review', 'approved', 'published', 'archived'].map((state) => m('option', { value: state }, tr('status_' + state))))]),
          m('label', [tr('sort'), m('select.FormControl', { value: this.sort, disabled: this.loading, onchange: (event) => { this.sort = event.target.value; this.page = 1; this.load(); } },
            ['latest', 'oldest', 'title'].map((order) => m('option', { value: order }, tr('sort_' + order))))]),
        ]),
        this.loading ? m(LoadingIndicator) : this.data && [
          !this.data.items.length && m('.Editorial-card.Editorial-empty', [icon('feather'), m('h3', tr('empty')), m('p', tr('empty_help'))]),
          m('.Editorial-grid', { className: home.layout === 'list' ? 'Editorial-grid--list' : '' }, this.data.items.map((draft) => m(Link, { href: app.route('editorial.draft', { id: draft.id }), className: 'Editorial-card Editorial-draftCard' }, [
            status(draft.status), m('h3', draft.title), m('p', tr('revision_label', { number: draft.content_version })), m('small', date(draft.updated_at)), icon('arrow-right'),
          ]))),
          m('.Editorial-pagination', [button('previous', () => { this.page--; this.load(); }, this.page === 1), m('span', String(this.page)),
            button('next', () => { this.page++; this.load(); }, !this.data.hasMore)]),
        ],
      ],
    ]));
  }
}

export class EditorialDraft extends Page {
  oninit(vnode) {
    super.oninit(vnode);
    this.id = vnode.attrs.id ?? m.route.param('id');
    this.active = true;
    this.tab = 'write';
    this.username = '';
    this.inviteRole = 'reviewer';
    this.suggestions = [];
    this.searchRevision = 0;
    this.suggestionIndex = 0;
    this.editorKey = 0;
    this.composer = new ComposerState();
    this.comment = '';
    this.tags = [];
    this.publicationType = 'discussion';
    this.publicationOptions = {};
    this.wikiCategories = [];
    this.tagOptions = [];
    this.bufferKey = (app.session.user?.id() || 'guest') + ':' + this.id;
    this.recoverPending = true;
    this.beforeUnload = (event) => { if (this.dirty() || this.comment) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', this.beforeUnload);
    this.load();
    if (app.store.models.tags) {
      app.store.find('tags').then((tags) => { if (this.active) { this.tagOptions = tags; m.redraw(); } }).catch(() => {});
    }
  }

  onremove(vnode) {
    clearTimeout(this.searchTimer);
    this.searchRevision++;
    if (this.dirty() || this.comment) {
      pendingManuscripts.set(this.bufferKey, { ...this.manuscriptInput(), comment: this.comment, version: this.data.draft.version });
    }
    this.active = false;
    window.removeEventListener('beforeunload', this.beforeUnload);
    super.onremove(vnode);
  }

  dirty() {
    return !!this.data && (this.title !== this.data.draft.title || this.content !== this.data.draft.content || JSON.stringify(this.tags) !== JSON.stringify(this.data.draft.tags)
      || this.publicationType !== (this.data.draft.publication_type || 'discussion') || JSON.stringify(this.publicationOptions) !== JSON.stringify({ ...this.data.draft.publication_options }));
  }

  accept(data) {
    this.data = data;
    this.title = data.draft.title;
    this.content = data.draft.content;
    this.tags = [...data.draft.tags];
    this.publicationType = data.draft.publication_type || 'discussion';
    this.publicationOptions = { ...data.draft.publication_options };
    if (data.publication?.targets.some(target => target.type === 'wiki' && target.available)) this.loadWikiCategories();
    this.editorKey++;
    this.composer.fields.content(this.content);
    this.snapshot = null;
    this.previousSnapshot = null;
    this.comparison = null;
  }

  async load(confirm = false) {
    if (confirm && (this.dirty() || this.comment) && !window.confirm(txt('reload_confirm'))) return;
    this.loading = true;
    this.error = '';
    try {
      const data = await app.request({ url: endpoint('/' + this.id), errorHandler: () => {} });
      if (this.active) {
        this.accept(data); this.comment = '';
        const pending = this.recoverPending && pendingManuscripts.get(this.bufferKey);
        if (pending) {
          this.title = pending.title; this.content = pending.content; this.tags = [...pending.tags]; this.comment = pending.comment;
          this.publicationType = pending.publication_type || 'discussion'; this.publicationOptions = { ...pending.publication_options };
          this.composer.fields.content(this.content);
          this.recovered = true;
          if (Number(pending.version) !== Number(data.draft.version)) {
            this.data.draft.version = pending.version;
            this.error = 'conflict';
          }
        }
        this.recoverPending = false;
        pendingManuscripts.delete(this.bufferKey);
      }
    } catch (error) { if (this.active) this.error = errorCode(error); }
    finally { if (this.active) { this.loading = false; m.redraw(); } }
  }

  async action(action, extra = {}) {
    if (this.busy || !this.data) return;
    if (action !== 'save' && this.dirty()) { this.error = 'unsaved'; return; }
    if (['publish', 'delete', 'restore', 'archive', 'approve_directly'].includes(action)
      && !window.confirm(txt('confirm_' + action, action === 'publish' ? { target: this.targetLabel(this.publicationType) } : {}))) return;
    this.busy = true;
    this.error = '';
    try {
      const data = await app.request({ method: 'POST', url: endpoint('/' + this.id),
        body: { action, version: Number(this.data.draft.version), ...extra }, errorHandler: () => {} });
      if (!this.active) return;
      if (data.deleted) {
        this.data = null;
        this.comment = '';
        this.busy = false;
        m.route.set(app.route('editorial'));
        return;
      }
      this.accept(data);
      if (action === 'comment' || action === 'changes') this.comment = '';
      if (action === 'invite') this.searchMembers('');
    } catch (error) { if (this.active) this.error = errorCode(error); }
    finally { if (this.active) { this.busy = false; m.redraw(); } }
  }

  manuscriptInput() {
    return { title: this.title, content: this.content, tags: [...this.tags], publication_type: this.publicationType,
      publication_options: { ...this.publicationOptions } };
  }

  targetLabel(type) {
    return this.data?.publication?.targets.find(target => target.type === type)?.label || txt('target_' + type);
  }

  async loadWikiCategories() {
    if (this.wikiCategoriesLoaded) return;
    this.wikiCategoriesLoaded = true;
    this.wikiCategoriesError = false;
    try {
      const categories = [];
      for (let offset = 0; offset < 1000; offset += 100) {
        const result = await app.request({ url: app.forum.attribute('apiUrl') + '/linkrobins-wiki-categories',
          params: { 'page[limit]': 100, 'page[offset]': offset }, errorHandler: () => {} });
        if (!this.active) return;
        const rows = Array.isArray(result.data) ? result.data : [];
        categories.push(...rows.map(row => ({ id: String(row.id), name: row.attributes?.name || '#' + row.id })));
        if (rows.length < 100) break;
      }
      this.wikiCategories = categories;
    } catch { if (this.active) this.wikiCategoriesError = true; }
    if (this.active) m.redraw();
  }

  publicationFields(canEdit) {
    const disabled = !canEdit || this.busy;
    const targets = this.data.publication?.targets || [{ type: 'discussion', available: true }];
    const field = (key, label, tag = 'input', attrs = {}) => [m('label', { for: 'editorial-pub-' + key }, tr(label)),
      m(tag + '.FormControl', { id: 'editorial-pub-' + key, value: this.publicationOptions[key] || '', disabled,
        oninput: event => { this.publicationOptions[key] = event.target.value; }, ...attrs })];
    return m('section.Editorial-publication', [
      m('label', { for: 'editorial-publication-type' }, tr('publication_target')),
      m('select.FormControl', { id: 'editorial-publication-type', value: this.publicationType, disabled,
        onchange: event => { this.publicationType = event.target.value; this.publicationOptions = this.publicationType === 'blog' ? { summary: '', image: '' }
          : this.publicationType === 'wiki' ? { category: null, slug: '' } : {}; if (this.publicationType === 'wiki') this.tags = []; } },
      targets.filter(target => target.available || target.type === this.publicationType).map(target => m('option', { value: target.type, disabled: !target.available }, this.targetLabel(target.type)))),
      m('p.Editorial-muted', tr('publication_help')),
      targets.some(target => target.type === this.publicationType && !target.available) && m('.Alert', tr('error_target_unavailable')),
      this.publicationType === 'blog' && [m('p.Editorial-muted', tr('blog_help')), ...field('summary', 'blog_summary', 'textarea', { rows: 3, maxlength: 1000 }),
        ...field('image', 'blog_image', 'input', { type: 'url', maxlength: 2048, placeholder: 'https://…' })],
      this.publicationType === 'wiki' && [
        m('label', { for: 'editorial-wiki-category' }, tr('wiki_category')),
        m('select.FormControl', { id: 'editorial-wiki-category', value: String(this.publicationOptions.category || ''), disabled,
          onchange: event => { this.publicationOptions.category = event.target.value ? Number(event.target.value) : null; } }, [
          m('option', { value: '' }, tr('wiki_uncategorized')),
          ...this.wikiCategories.map(category => m('option', { value: category.id }, category.name)),
          this.publicationOptions.category && !this.wikiCategories.some(category => category.id === String(this.publicationOptions.category))
            && m('option', { value: String(this.publicationOptions.category) }, '#' + this.publicationOptions.category),
        ]),
        this.wikiCategoriesError && m('p.Editorial-muted', tr('wiki_categories_failed')),
        ...field('slug', 'wiki_slug', 'input', { maxlength: 191, placeholder: 'docker-einstieg' }),
        m('p.Editorial-muted', tr('wiki_help')),
      ],
    ]);
  }

  publicationLink(draft) {
    const id = draft.publication_id || draft.discussion_id;
    if (!id) return null;
    const route = draft.publication_type === 'wiki' ? 'linkrobins-wiki.show' : draft.publication_type === 'blog' && app.routes?.['blog.post'] ? 'blog.post' : 'discussion';
    if (!app.routes?.[route]) return null;
    return m(Link, { href: app.route(route, { id }), className: 'Button Button--primary' }, tr('open_publication'));
  }

  async showRevision(id) {
    const request = this.revisionRequest = (this.revisionRequest || 0) + 1;
    this.error = '';
    try {
      const data = await app.request({ url: endpoint('/' + this.id + '/revisions/' + id), errorHandler: () => {} });
      if (this.active && request === this.revisionRequest) {
        this.snapshot = data.revision; this.previousSnapshot = data.previous || null; this.revisionView = 'diff';
        this.comparison = lineDiff(data.previous?.content || '', data.revision.content);
      }
    } catch (error) { if (this.active && request === this.revisionRequest) this.error = errorCode(error); }
    finally { if (this.active) m.redraw(); }
  }

  download() {
    const url = URL.createObjectURL(new Blob([this.title + '\n\n' + this.content], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'editorial-' + this.id + '.txt';
    document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  searchMembers(value) {
    this.username = value;
    this.suggestions = [];
    this.searchError = false;
    this.searchLoading = false;
    clearTimeout(this.searchTimer);
    const revision = ++this.searchRevision;
    const query = value.trim();
    if (Array.from(query).length < 3) return;
    this.searchLoading = true;
    this.searchTimer = setTimeout(async () => {
      try {
        const users = await app.store.find('users', { filter: { q: query }, page: { limit: 6 } });
        if (!this.active || revision !== this.searchRevision) return;
        this.suggestions = users.filter((user) => Number(user.id()) !== Number(this.data.draft.owner_id)).slice(0, 6);
        this.suggestionIndex = 0;
      } catch {
        if (this.active && revision === this.searchRevision) this.searchError = true;
      } finally {
        if (this.active && revision === this.searchRevision) { this.searchLoading = false; m.redraw(); }
      }
    }, 250);
  }

  chooseMember(user) {
    clearTimeout(this.searchTimer);
    this.searchRevision++;
    this.username = user.username();
    this.suggestions = [];
    this.searchLoading = false;
  }

  memberKey(event) {
    if (event.key === 'Escape') { clearTimeout(this.searchTimer); this.searchRevision++; this.suggestions = []; this.searchLoading = false; return; }
    if (!this.suggestions.length) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.suggestionIndex = (this.suggestionIndex + (event.key === 'ArrowDown' ? 1 : -1) + this.suggestions.length) % this.suggestions.length;
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.chooseMember(this.suggestions[this.suggestionIndex]);
    }
  }

  user(id) { return this.data.users[id] || txt('deleted_user'); }

  view() {
    return m('.Editorial', m('.container', [
      m(Link, { href: app.route('editorial'), className: 'Editorial-back' }, [icon('arrow-left'), ' ', tr('back')]),
      this.error && m('.Alert.Alert--error.Editorial-alert', { role: 'alert' }, [tr('error_' + this.error),
        this.error === 'conflict' && m('.Editorial-actions', [button('download', () => this.download()), button('reload', () => this.load(true), this.busy)])]),
      this.loading ? m(LoadingIndicator) : this.data && this.workspace(),
    ]));
  }

  workspace() {
    const { draft, role, canEdit, canApprove, canPublish } = this.data;
    const owner = role === 'owner';
    const closed = ['published', 'archived'].includes(draft.status);
    const disabled = this.busy || this.dirty();
    return [
      this.recovered && m('.Alert.Editorial-alert', tr('recovered')),
      m('header.Editorial-heading', [m('div', [m('span.Editorial-eyebrow', 'Editorial · ' + txt('role_' + role)), m('h1', draft.title),
        m('p', [tr('by'), ' ', this.user(draft.owner_id), ' · ', tr('revision_label', { number: draft.content_version }), ' · ', date(draft.updated_at)])]), status(draft.status)]),
      m('nav.Editorial-steps', { 'aria-label': txt('workflow') }, ['draft', 'review', 'approved', 'published'].map((step, i) =>
        m('span', { className: step === draft.status ? 'is-current' : '' }, [m('b', String(i + 1).padStart(2, '0')), ' ', tr('status_' + step)]))),
      m('.Editorial-workspace', [
        m('main.Editorial-main', [
          m('section.Editorial-card.Editorial-editor', [
            m('.Editorial-toolbar', [m('h2', tr('manuscript')), m('span', this.dirty() ? tr('unsaved') : tr('saved'))]),
            m('.Editorial-tabs', ['write', 'team', 'history'].map((tab) => m('button.Button', { type: 'button', 'aria-pressed': this.tab === tab,
              className: this.tab === tab ? 'Button--primary' : '', onclick: () => { this.tab = tab; } }, tr('tab_' + tab)))),
            this.tab === 'write' && [
              this.publicationFields(canEdit),
              m('label', { for: 'editorial-title' }, tr('title')),
              m('input.FormControl', { id: 'editorial-title', value: this.title, maxlength: 80, disabled: !canEdit || this.busy, oninput: (event) => { this.title = event.target.value; } }),
              m('label', { for: 'editorial-content' }, tr('content')),
              canEdit ? m('fieldset.Editorial-nativeEditor', { disabled: this.busy, 'aria-busy': !!this.busy }, m(EditorialTextEditor, {
                key: this.editorKey, composer: this.composer, value: this.content,
                submitLabel: txt('save'), disabled: this.busy,
                onchange: (value) => { this.content = value; this.composer.fields.content(value); m.redraw(); },
                onsubmit: () => { if (!this.busy && this.dirty()) this.action('save', this.manuscriptInput()); },
              })) : m('textarea.FormControl.Editorial-content', { id: 'editorial-content', value: this.content, rows: 18, readonly: true }),
              m('small.Editorial-muted', tr('format_help')),
              this.publicationType !== 'wiki' && this.tagOptions.length > 0 && [m('label', { for: 'editorial-tags' }, tr('tags')),
                m('select.FormControl', { id: 'editorial-tags', multiple: true, size: 6, disabled: !canEdit || this.busy,
                  onchange: (event) => { this.tags = Array.from(event.target.selectedOptions, (option) => Number(option.value)); } },
                  [...this.tagOptions.map((tag) => ({ id: Number(tag.id()), name: tag.name() + (this.publicationType === 'blog' && this.data.publication?.blogTags.includes(Number(tag.id())) ? ' · ' + this.targetLabel('blog') : '') })), ...this.tags.filter((id) => !this.tagOptions.some((tag) => Number(tag.id()) === id)).map((id) => ({ id, name: '#' + id }))]
                    .map((tag) => m('option', { value: tag.id, selected: this.tags.includes(tag.id) }, tag.name)))],
              m('.Editorial-actions', [canEdit && button('save', () => this.action('save', this.manuscriptInput()), this.busy || !this.dirty(), true),
                button('download', () => this.download()), button('refresh', () => this.load(true), this.busy)]),
            ],
            this.tab === 'team' && this.team(owner, disabled),
            this.tab === 'history' && this.history(canEdit, disabled),
          ]),
          m('section.Editorial-card.Editorial-comments', [m('h2', tr('comments')), m('p.Editorial-muted', tr('private_help')),
            this.data.commentsTruncated && m('p.Alert', tr('comments_limit')),
            !this.data.comments.length && m('p.Editorial-muted', tr('no_comments')),
            ...this.data.comments.map((comment) => m('article.Editorial-comment', [
              m('header', [m('strong', this.user(comment.user_id)), m('small', [date(comment.created_at), ' · ', tr('revision_label', { number: comment.content_version })])]),
              m('p', comment.content),
            ])),
            !closed && [m('label', { for: 'editorial-comment' }, tr('comment_label')),
              m('textarea.FormControl', { id: 'editorial-comment', rows: 3, maxlength: 5000, value: this.comment, disabled: this.busy, oninput: (event) => { this.comment = event.target.value; } }),
              m('.Editorial-actions', [button('comment', () => this.action('comment', { content: this.comment }), disabled || !this.comment.trim()),
                role === 'reviewer' && ['review', 'approved'].includes(draft.status) && button('request_changes', () => this.action('changes', { content: this.comment }), disabled || !this.comment.trim())])],
          ]),
        ]),
        m('aside.Editorial-side', [
          m('section.Editorial-card.Editorial-review', [icon('clipboard-check'), m('h2', tr('review_title')),
            this.data.directApproval && m('.Editorial-directApproval', [icon('check-double'), ' ', tr(this.data.directApproval.valid ? 'direct_approved' : 'direct_invalid'), m('small', this.user(this.data.directApproval.userId))]),
            !this.data.directApproval?.valid && m('strong.Editorial-approvalCount', this.data.approvals + ' / ' + draft.required_approvals), m('p', tr(this.data.directApproval?.valid ? 'direct_approval_help' : 'approval_help')),
            m('.Editorial-actions', [owner && draft.status === 'draft' && button('submit', () => this.action('submit'), disabled, true),
              this.data.canApproveDirectly && button('approve_directly', () => this.action('approve_directly'), disabled, true),
              canApprove && button('approve', () => this.action('approve'), disabled, true),
              owner && ['review', 'approved'].includes(draft.status) && button('reopen', () => this.action('reopen'), disabled),
              canPublish && button('publish', () => this.action('publish'), disabled, true)]),
            m('p.Editorial-muted', [tr('publication_target'), ': ', this.targetLabel(draft.publication_type || 'discussion')]),
            owner && draft.status === 'approved' && this.data.publication?.targets.some(target => target.type === draft.publication_type && target.available && !target.canPublish)
              && m('p.Editorial-muted', tr('error_permission_denied')),
            this.publicationLink(draft),
            draft.publication_type === 'blog' && draft.status === 'published' && m('p.Editorial-muted', tr('blog_moderation_help')),
          ]),
          m('section.Editorial-card.Editorial-people', [m('h3', tr('team')),
            this.person(draft.owner_id, 'owner'),
            ...this.data.members.map((member) => this.person(member.user_id, member.role, Number(member.approved_version) === Number(draft.content_version)))]),
          m('section.Editorial-card.Editorial-note', [icon('lock'), m('h3', tr('private_title')), m('p', tr('privacy'))]),
          owner && m('.Editorial-actions.Editorial-danger', [!closed && button('archive', () => this.action('archive'), disabled), button('delete', () => this.action('delete'), disabled)]),
        ]),
      ]),
    ];
  }

  person(id, role, approved = false) {
    return m('.Editorial-person', [m('span.Editorial-personIcon', { 'data-role': role, 'aria-hidden': 'true' }, icon(role === 'owner' ? 'crown' : role === 'reviewer' ? 'clipboard-check' : 'pen')),
      m('div', [m('strong', this.user(id)), m('span.Editorial-roleBadge', { 'data-role': role }, tr('role_' + role))]), approved && m('span', { title: txt('status_approved') }, icon('check-circle'))]);
  }

  team(owner, disabled) {
    return m('.Editorial-team', [
      m('p', tr('team_help')),
      ...this.data.members.map((member) => m('.Editorial-member', [m('div', [m('strong', this.user(member.user_id)), m('small', tr('role_' + member.role))]),
        owner && this.data.draft.status === 'draft' && button('remove', () => this.action('remove', { userId: Number(member.user_id) }), disabled)])),
      owner && this.data.draft.status === 'draft' && [
        m('label', { for: 'editorial-username' }, tr('username')),
        m('.Editorial-userSearch', [
          m('input.FormControl', { id: 'editorial-username', value: this.username, maxlength: 100, disabled: this.busy,
            role: 'combobox', autocomplete: 'off', 'aria-autocomplete': 'list', 'aria-expanded': this.suggestions.length > 0,
            'aria-controls': 'editorial-user-options', 'aria-describedby': 'editorial-user-help',
            'aria-activedescendant': this.suggestions.length ? 'editorial-user-option-' + this.suggestionIndex : undefined,
            oninput: (event) => this.searchMembers(event.target.value), onkeydown: (event) => this.memberKey(event) }),
          this.suggestions.length > 0 && m('ul.Editorial-suggestions', { id: 'editorial-user-options', role: 'listbox', 'aria-label': txt('suggestions') },
            this.suggestions.map((user, index) => m('li', { role: 'option', id: 'editorial-user-option-' + index, 'aria-selected': index === this.suggestionIndex,
              onmousedown: (event) => { event.preventDefault(); this.chooseMember(user); } }, [m('strong', user.username()), user.displayName() !== user.username() && m('small', user.displayName())]))),
          m('small.Editorial-muted', { id: 'editorial-user-help', role: 'status' }, this.searchLoading ? tr('searching') : this.searchError ? tr('search_failed') : tr('search_help')),
        ]),
        m('label', { for: 'editorial-role' }, tr('role')),
        m('.Editorial-select', [m('select.FormControl', { id: 'editorial-role', value: this.inviteRole, disabled: this.busy, onchange: (event) => { this.inviteRole = event.target.value; } },
          ['reviewer', 'editor'].map((role) => m('option', { value: role }, tr('role_' + role)))), icon('chevron-down')]),
        m('.Editorial-actions', button('invite', () => this.action('invite', { username: this.username, role: this.inviteRole }), disabled || !this.username.trim(), true)),
      ],
    ]);
  }

  revisionPanel(canEdit, disabled) {
    const snapshot = this.snapshot;
    const previous = this.previousSnapshot;
    const comparison = this.comparison;
    return m('.Editorial-snapshot', [
      m('h3', [tr('revision_label', { number: snapshot.content_version }), ' · ', snapshot.title]),
      m('p.Editorial-diffMeta', [tr('publication_target'), ': ', previous ? this.targetLabel(previous.publication_type || 'discussion') + ' → ' : '', this.targetLabel(snapshot.publication_type || 'discussion')]),
      m('dl.Editorial-diffMeta', Object.entries(snapshot.publication_options || {}).map(([key, value]) => [
        m('dt', tr(({ summary: 'blog_summary', image: 'blog_image', category: 'wiki_category', slug: 'wiki_slug' })[key] || 'publication_target')),
        m('dd', value == null || value === '' ? '—' : String(value)),
      ])),
      previous && JSON.stringify(previous.publication_options) !== JSON.stringify(snapshot.publication_options) && m('p.Editorial-diffMeta', tr('publication_details_changed')),
      m('p', previous ? tr('changes_from', { number: previous.content_version }) : tr('initial_revision')),
      m('.Editorial-tabs', [button('show_diff', () => { this.revisionView = 'diff'; }), button('show_text', () => { this.revisionView = 'text'; })]),
      this.revisionView === 'text' ? [previous && m('details', [m('summary', tr('previous_text')), m('pre', previous.content)]), m('pre', snapshot.content)] : [
        previous && previous.title !== snapshot.title && m('p.Editorial-diffMeta', [tr('title'), ': ', m('del', previous.title), ' → ', m('ins', snapshot.title)]),
        JSON.stringify(previous?.tags || []) !== JSON.stringify(snapshot.tags) && m('p.Editorial-diffMeta', [tr('tag_ids'), ': ', (previous?.tags || []).join(', ') || '—', ' → ', snapshot.tags.join(', ') || '—']),
        comparison && [
          m('p', tr('diff_summary', { added: comparison.added, removed: comparison.removed })),
          !comparison.added && !comparison.removed && m('p', tr('no_text_changes')),
          comparison.coarse && m('p.Alert', tr('diff_coarse')),
          comparison.truncated && m('p.Alert', tr('diff_truncated')),
          m('.Editorial-diff', { role: 'region', 'aria-label': txt('show_diff'), tabindex: 0 }, comparison.rows.map((row) => row.kind === 'skip' ?
            m('.Editorial-diffSkip', tr('diff_skipped', { count: row.count })) :
            m('.Editorial-diffRow', { 'data-kind': row.kind }, [m('span', { 'aria-hidden': 'true' }, row.oldLine || ''), m('span', { 'aria-hidden': 'true' }, row.newLine || ''),
              m('b', row.kind === 'add' ? '+' : row.kind === 'delete' ? '−' : ' '), m('code', row.text || ' ')]))),
        ],
      ],
      m('p', tr('restore_help')),
      canEdit && button('restore', () => this.action('restore', { revision: Number(snapshot.id) }), disabled),
    ]);
  }

  history(canEdit, disabled) {
    return m('.Editorial-history', [
      this.data.historyTruncated && m('p.Alert', tr('history_limit')),
      this.snapshot && this.revisionPanel(canEdit, disabled),
      ...this.data.history.map((item) => m('article.Editorial-event', [
        m('div', [m('strong', tr('action_' + item.action)), m('small', [this.user(item.actor_id), ' · ', date(item.created_at), ' · ', tr('revision_label', { number: item.content_version })]),
          item.detail && m('small', item.detail)]),
        ['create', 'save', 'restore'].includes(item.action) && button('view_revision', () => this.showRevision(item.id), this.busy),
      ])),
    ]);
  }
}

export const extend = [new Routes().add('editorial', '/editorial', EditorialIndex).add('editorial.draft', '/editorial/:id', EditorialDraft)];

app.initializers.add('el-choco-editorial', () => {
  extendMethod(IndexSidebar.prototype, 'navItems', function (items) {
    if (app.forum.attribute('canUseEditorial')) {
      items.add('editorial', m(LinkButton, { href: app.route('editorial'), icon: 'fas fa-pen-nib' }, 'Editorial'), -9);
    }
  });
});
