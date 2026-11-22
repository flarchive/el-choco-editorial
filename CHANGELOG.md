# Changelog

## 1.0.2 — 2026-11-22

- Publish approved manuscripts as discussions, FoF Blog articles or Link Robins Wiki articles.
- Configure destination names independently, including forums that renamed FoF Blog using Linguist.
- Include blog summary/cover image and wiki category/slug in revision snapshots and approval invalidation.
- Use native APIs and owner permissions; preserve additional blog moderation.
- Keep separate wiki publication IDs and preserve old discussion links during migration.

- Freigegebene Manuskripte als Diskussion, FoF-Blogartikel oder Link-Robins-Wikiartikel veröffentlichen.
- Zielnamen unabhängig und frei im Adminbereich festlegen.
- Blog-Kurzbeschreibung/Titelbild und Wiki-Kategorie/Adresse mit der Revision speichern; Änderungen benötigen neue Freigaben.
- Native APIs und Eigentümerrechte verwenden; zusätzliche Blog-Moderation bleibt wirksam.
- Wiki-Artikel-IDs getrennt speichern und vorhandene Diskussionslinks bei der Migration erhalten.

## 1.0.1 — 2026-11-21

- Add administrator-configurable homepage banner, texts, cards/list layout, default status filter and sorting.
- Compare saved text revisions with red/green line diffs, title and category changes, bounded rendering and full-text views.
- Add a separate direct-approval group permission that can bypass reviewer counts on accessible drafts, including own drafts.
- Record direct approvals in history, clear them on edits/reopening and recheck the approver’s current permissions before publishing.
- Add a non-destructive migration for revision-bound direct approvals and update English/German documentation.

## 1.0.0 — 2026-11-20

- Publish the tested collaborative drafting and review workflow as the first stable release.
- Update English and German installation and upgrade instructions.
- Keep the existing database schema and review permissions unchanged.
- Restore the manuscript editor background to `#eaebf0` for the standard and rich-text editors.

## 0.1.0-alpha.2 — 2026-11-19

- Use Flarum’s native TextEditor and extension-provided icon toolbar with an isolated composer state.
- Suggest usernames after three characters with debounce, stale-response protection and keyboard selection.
- Enlarge the category list, make the role dropdown arrow explicit and highlight workflow status.
- Add coloured participant roles and larger, left-aligned archive/delete buttons.
- Replace the promotional banner copy with a factual description.
- Retain Alpha 1’s database schema and workflow; add frontend regression coverage and an update guide.

## 0.1.0-alpha.1 — 2026-11-18

- Add private collaborative drafts, owners, invited editors and reviewers.
- Add saved text revisions, restoration and private revision-linked feedback.
- Add a review workflow with one to five required approvals and no self-approval.
- Reject stale writes and preserve local manuscript text on conflicts.
- Publish through Flarum's normal discussion API and prevent duplicate publication.
- Add scoped responsive styles, English and German translations, permissions and installation guides.
- Include compiled assets and isolated backend/frontend regression checks.
