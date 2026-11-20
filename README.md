# Editorial

**Write together. Review with confidence. Publish when ready.**

Editorial is a private collaborative writing workspace for Flarum 2. Invite other members, keep saved revisions, discuss changes internally and publish an approved manuscript as a normal forum discussion.

**Package:** `el-choco/editorial` · **Version:** `0.1.0-alpha.2` · **License:** MIT

## Features

- A dedicated `/editorial` workspace with a permission-controlled sidebar link.
- Private drafts with three roles: owner, editor and reviewer.
- Invitations by existing username, with suggestions after three characters; invited drafts appear in each participant's workspace.
- Flarum’s native TextEditor with its extension-provided icon toolbar and an isolated composer state. A larger category list is available when Flarum Tags is enabled.
- Explicit saves with permanent text snapshots. Older text revisions can be read and restored as new revisions.
- Internal plain-text feedback tied to the text revision being discussed.
- One to five approvals, configured in the administration panel and captured when a draft is created.
- Workflow: **Draft → In review → Approved → Published**.
- Review freezes the text. Requesting changes or returning to editing clears approvals. An owner cannot approve their own manuscript.
- Publication through Flarum's standard discussion API as the owner, preserving normal permission, validation, formatting and extension checks.
- Version checks reject stale writes. Conflicting text remains in the editor for downloading and manual merging.
- Unsaved text is retained in memory when navigating within the same application tab. Closing or reloading the tab warns about unsaved text. No draft text is written to browser storage.
- Manuscript text downloads, read-only archives and permanent draft deletion.
- English and German interface and installation instructions.

## Requirements and installation

Flarum `^2.0.2`, PHP `^8.3` and Flarum's configured database. Flarum 1.8 is not supported by this version. FoF Drafts and Admin Console are not dependencies.

This first test package is supplied as a ZIP. Follow [the English installation guide](INSTALL-EN.md) or [the German installation guide](INSTALL-DE.md). Both use `/tmp` for the transferred ZIP and a persistent source directory for Composer. Built JavaScript is included; Node.js is unnecessary on the forum server.

Enabling the extension creates four database tables. No worker, scheduler, external service or API key is required.

## Permissions and administration

Grant **Use Editorial and participate in invited drafts** to the groups that should use the workspace. Invitees also need this permission. Administrators have access through Flarum's normal permission system.

The separate **Read every private draft, comment, archive and permanently delete drafts** permission grants access to all Editorial drafts, including drafts where the manager was not invited. Give it only to trusted staff. It does not grant the right to edit or publish another owner's manuscript.

The required approval count applies to new drafts. Existing drafts keep the count they were created with. Editors may change text while a draft is editable; only invited reviewers may approve. The owner manages invitations, submits for review, returns to editing and publishes. Reviewers can request changes with a mandatory comment. Changes to the team are allowed only while editing and clear approvals.

## First workflow

1. Grant the Editorial use permission to the relevant groups.
2. Create a draft and write the manuscript. Save a revision.
3. Open **Team** and invite another existing member as a reviewer. Optionally invite editors as well.
4. Save your work and request review. The manuscript becomes read-only.
5. The reviewer opens Editorial under their own account and approves the current revision or requests changes with feedback.
6. After the required approvals, the owner publishes the manuscript as a discussion.

With multiple reviewers, each should refresh the draft before approving if another person has changed it. Comments and workflow changes also advance the concurrency version.

## Data and limits

Manuscripts, snapshots, comments and team roles are stored in the forum database. Feedback and revisions are not copied into the published discussion. A normal discussion uses the owner's account as author; coauthors are retained in Editorial's history and are not added as multiple public post authors.

Drafts are private to their participants, forum administrators and authorised managers. This is access control, not end-to-end encryption. Usernames and actor IDs are retained for attribution. Removed participants lose API access; information already downloaded or copied cannot be recalled. Deleting a user does not automatically delete their Editorial data in this first version.

Deleting a draft permanently deletes its team, comments and revision history. Deleting a published manuscript does not delete the resulting forum discussion. Disabling the extension preserves its tables; purging it removes all four Editorial tables. Include those tables in your normal database backups.

Limits: 50 active drafts per owner, 20 invited members per draft, 80-character titles, 63,000-character manuscript text, 10 category IDs, 5,000-character comments, 500 comments and 1,000 history entries per draft. The workspace lists 20 drafts per page; a detail view shows the latest 100 comments and history entries and indicates truncation. A draft reaching its history limit can still be read, downloaded and deleted.

## First-version boundaries

- Saved revisions and manual conflict resolution, without live cursors or simultaneous text merging.
- Uses Flarum’s native TextEditor. Its standard hooks allow active editor extensions to contribute their tools. Tools that assume the global composer or a specific discussion composer may need an additional integration. The installed Rich Text/Upload/MagicBB combination still needs verification on the target forum. Uploaded media follows your upload extension’s visibility settings; private manuscripts do not make uploaded files private.
- No automatic saves, email invitations, unread notifications, inline comment threads, ownership transfer or scheduled publication.
- Archives are read-only. There is no unarchive action in this version.
- Flarum validates categories and publication permissions at publication time. A forum extension requiring additional discussion fields may require a later Editorial integration.
- Database rollback protects the manuscript and discussion records on publication failure. Side effects triggered by other extensions, such as external emails or webhooks, cannot necessarily be rolled back.

## Validation

Backend checks use real Flarum 2.0.2 classes, migrations, query builders and an isolated SQLite database. They cover roles, privacy, state transitions, revision restoration, stale writes, revoked reviewer access, rollback and duplicate publication prevention. The publisher adapter is exercised with the real Flarum API client and a controlled response handler. Browser checks use the built frontend, real Flarum TextEditor/BasicEditorDriver classes and representative data.

The maintainer installed Alpha 1 and confirmed its basic operation. Real publication and concurrent requests on the target CrazyMax/MySQL environment, and the new Alpha 2 editor integrations, still require testing. This is an initial alpha, not a stable release.

```bash
cd js
npm ci
npm run build
npm test
```

```bash
php tests/run.php /path/to/flarum/vendor/autoload.php
```

The backend tests require `pdo_sqlite` and `mbstring` in the test PHP runtime. They never connect to the forum's production database.

---

# Editorial

**Gemeinsam schreiben. Verlässlich prüfen. Bewusst veröffentlichen.**

Editorial ist ein privater Redaktionsbereich für Flarum 2. Lade Mitglieder ein, speichere Textrevisionen, sammle interne Rückmeldungen und veröffentliche ein freigegebenes Manuskript als normale Diskussion.

**Paket:** `el-choco/editorial` · **Version:** `0.1.0-alpha.2` · **Lizenz:** MIT

## Funktionen

- Eigener Redaktionsbereich unter `/editorial` mit berechtigungsabhängigem Sidebar-Link.
- Private Entwürfe mit Eigentümer, Bearbeitern und Prüfern.
- Einladungen über bestehende Benutzernamen mit Vorschlägen ab drei Zeichen. Eingeladene Entwürfe erscheinen im Redaktionsbereich der Beteiligten.
- Flarums nativer TextEditor mit Symbol-Werkzeugleiste der aktiven Erweiterungen und eigenem Composer-Zustand. Eine höhere Kategorieauswahl steht bei aktiviertem Flarum Tags bereit.
- Bewusstes Speichern als neue Textrevision. Ältere Stände lassen sich lesen und als neue Revision wiederherstellen.
- Interne Textkommentare mit Bezug zur jeweiligen Textrevision.
- Eine bis fünf erforderliche Freigaben, im Adminbereich für neue Entwürfe einstellbar.
- Ablauf: **Entwurf → In Prüfung → Freigegeben → Veröffentlicht**.
- Während der Prüfung ist das Manuskript schreibgeschützt. Erneutes Öffnen oder angeforderte Änderungen heben Freigaben auf. Eigentümer können ihre eigenen Entwürfe nicht freigeben.
- Veröffentlichung über Flarums reguläre Schnittstelle unter dem Konto des Eigentümers. Schreibrechte, Kategorien, Formatierung und Erweiterungsprüfungen bleiben wirksam.
- Versionsprüfung gegen gegenseitiges Überschreiben. Bei einem Konflikt bleibt der lokale Text zum Herunterladen und manuellen Zusammenführen erhalten.
- Ungespeicherter Text bleibt bei interner Navigation im Speicher desselben Anwendungstabs. Vor dem Neuladen oder Schließen warnt der Browser. Es wird kein Entwurfstext im Browserspeicher abgelegt.
- Manuskript herunterladen, schreibgeschützt archivieren oder endgültig löschen.
- Deutsche und englische Oberfläche und Installationsanleitungen.

## Voraussetzungen und Installation

Flarum `^2.0.2`, PHP `^8.3` und Flarums eingerichtete Datenbank. Flarum 1.8 wird von dieser Ausgabe nicht unterstützt. FoF Drafts und Admin Console sind keine Voraussetzung.

Die erste Testversion wird als ZIP geliefert. Verwende [die deutsche Anleitung](INSTALL-DE.md) oder [die englische Anleitung](INSTALL-EN.md). Die ZIP wird nach `/tmp` übertragen und für Composer in einen dauerhaften Quellordner entpackt. Gebautes JavaScript liegt bei; Node.js wird auf dem Forumserver nicht benötigt.

Beim Aktivieren entstehen vier Datenbanktabellen. Ein Worker, Cronjob, externer Dienst oder API-Schlüssel ist nicht erforderlich.

## Rechte und Einrichtung

Erlaube den gewünschten Gruppen **Editorial nutzen und an eingeladenen Entwürfen mitarbeiten**. Auch eingeladene Personen benötigen dieses Recht. Administratoren erhalten Zugriff über Flarums normales Rechtesystem.

Das zusätzliche Recht **Alle privaten Entwürfe lesen, kommentieren, archivieren und endgültig löschen** erlaubt Zugriff auf sämtliche Editorial-Entwürfe – auch ohne Einladung. Vergib es nur an vertrauenswürdige Mitarbeiter. Es erlaubt nicht, fremde Manuskripte zu bearbeiten oder unter einem anderen Eigentümer zu veröffentlichen.

Die Zahl erforderlicher Freigaben gilt für neue Entwürfe. Bestehende Entwürfe behalten ihre ursprüngliche Vorgabe. Bearbeiter ändern den Text im Entwurfszustand; ausschließlich eingeladene Prüfer dürfen freigeben. Der Eigentümer verwaltet das Team, fordert die Prüfung an, öffnet den Entwurf erneut und veröffentlicht ihn. Prüfer können Änderungen mit einem verpflichtenden Kommentar anfordern. Teamänderungen sind nur während der Bearbeitung möglich und heben Freigaben auf.

## Erster Durchlauf

1. Das Editorial-Nutzungsrecht für die gewünschten Gruppen vergeben.
2. Einen Entwurf erstellen, das Manuskript schreiben und eine Revision speichern.
3. Unter **Team** ein anderes bestehendes Mitglied als Prüfer einladen. Bei Bedarf Bearbeiter hinzufügen.
4. Eigene Änderungen speichern und den Entwurf zur Prüfung einreichen. Der Text wird schreibgeschützt.
5. Der Prüfer öffnet Editorial unter seinem eigenen Konto und gibt die Revision frei oder fordert mit einer Rückmeldung Änderungen an.
6. Nach den erforderlichen Freigaben veröffentlicht der Eigentümer die Diskussion.

Bei mehreren Prüfern vor der eigenen Freigabe aktualisieren, falls zwischenzeitlich jemand etwas geändert hat. Auch Kommentare und Statusänderungen erhöhen die Version für die Konfliktprüfung.

## Daten und Grenzen

Manuskripte, Revisionen, Kommentare und Teamrollen liegen in der Forumdatenbank. Interne Rückmeldungen und Revisionen werden nicht in die veröffentlichte Diskussion übernommen. Als öffentlicher Autor wird der Eigentümer verwendet; Mitautoren bleiben im Editorial-Verlauf nachvollziehbar und werden nicht zu zusätzlichen öffentlichen Beitragsautoren.

Zugriff haben Beteiligte, Forumadministratoren und berechtigte Verwalter. Dies ist eine Zugriffskontrolle, keine Ende-zu-Ende-Verschlüsselung. Benutzernamen und Benutzer-IDs dienen der Zuordnung. Entfernte Beteiligte verlieren ihren API-Zugriff; bereits heruntergeladene oder kopierte Informationen lassen sich nicht zurückrufen. Das Löschen eines Benutzerkontos entfernt dessen Editorial-Daten in dieser ersten Ausgabe nicht automatisch.

Das Löschen eines Entwurfs entfernt Team, Kommentare und Verlauf endgültig. Eine bereits daraus veröffentlichte Diskussion bleibt bestehen. Deaktivieren erhält die Tabellen; die Datenlöschfunktion beim Entfernen der Erweiterung löscht alle vier Editorial-Tabellen. Die Tabellen gehören in deine normalen Datenbanksicherungen.

Grenzen: 50 aktive Entwürfe pro Eigentümer, 20 eingeladene Mitglieder pro Entwurf, Titel bis 80 Zeichen, Manuskript bis 63.000 Zeichen, höchstens zehn Kategorie-IDs, Kommentare bis 5.000 Zeichen, 500 Kommentare und 1.000 Verlaufseinträge pro Entwurf. Die Übersicht zeigt 20 Entwürfe pro Seite. Die Detailansicht zeigt die neuesten 100 Kommentare und Verlaufseinträge und kennzeichnet einen begrenzten Ausschnitt. Nach Erreichen der Verlaufsgrenze bleiben Lesen, Herunterladen und Löschen möglich.

## Umfang der ersten Version

- Gespeicherte Revisionen und manuelles Zusammenführen bei Konflikten; keine Live-Cursor oder automatische Zusammenführung gleichzeitiger Texteingaben.
- Flarums nativer TextEditor verwendet seine normalen Erweiterungspunkte für Editor-Werkzeuge. Werkzeuge, die den globalen Composer oder einen bestimmten Diskussions-Composer voraussetzen, können eine zusätzliche Anbindung benötigen. Die installierte Kombination aus Rich Text, Upload und MagicBB muss noch im Ziel-Forum geprüft werden. Hochgeladene Medien unterliegen den Sichtbarkeitseinstellungen der Upload-Erweiterung; ein privates Manuskript macht Upload-Dateien nicht automatisch privat.
- Kein automatisches Speichern, keine Einladungs-E-Mails, Benachrichtigungen über ungelesene Entwürfe, verankerten Kommentarthreads, Eigentümerwechsel oder zeitgesteuerten Veröffentlichungen.
- Archive sind schreibgeschützt. Eine Wiederöffnung archivierter Entwürfe gibt es in dieser Version nicht.
- Flarum prüft Kategorien und Veröffentlichungsrechte beim Veröffentlichen. Erweiterungen mit zusätzlichen verpflichtenden Diskussionsfeldern können eine spätere Editorial-Anbindung benötigen.
- Bei fehlgeschlagener Veröffentlichung werden Datenbankänderungen an Entwurf und Diskussion zurückgerollt. Nebenwirkungen anderer Erweiterungen, etwa externe E-Mails oder Webhooks, lassen sich nicht zwingend zurücknehmen.

## Prüfung

Die Backend-Prüfungen verwenden echte Klassen aus Flarum 2.0.2, die Migrationen, Datenbankabfragen und eine isolierte SQLite-Datenbank. Sie prüfen Rollen, Privatsphäre, Statuswechsel, Wiederherstellen, veraltete Speicherstände, entzogene Prüferrechte, Rückabwicklung und Schutz vor doppelter Veröffentlichung. Der Veröffentlichungsadapter wird mit Flarums echtem API-Client und einer kontrollierten Antwort geprüft. Browserprüfungen verwenden den gebauten Frontend-Code, Flarums echte TextEditor-/BasicEditorDriver-Klassen und Beispieldaten.

Der Betreiber hat Alpha 1 installiert und den grundsätzlichen Betrieb bestätigt. Echte Veröffentlichung, parallele Zugriffe im CrazyMax-/MySQL-Zielsystem und die neuen Editor-Anbindungen von Alpha 2 müssen noch praktisch geprüft werden. Dies ist eine erste Alpha-Version.

[Update from Alpha 1 / Update von Alpha 1](UPDATE-DE.md)
