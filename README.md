# Editorial

**Write together. Review with confidence. Publish when ready.**

Editorial is a private collaborative writing workspace for Flarum 2. Invite other members, keep saved revisions, discuss changes internally and publish an approved manuscript as a normal forum discussion.

**Package:** `el-choco/editorial` · **Version:** `1.0.1` · **License:** MIT

## Features

- A dedicated `/editorial` workspace with a permission-controlled sidebar link and an admin-configurable homepage: banner, title, description, welcome text, cards/list layout, default status filter and sorting.
- Private drafts with three roles: owner, editor and reviewer.
- Invitations by existing username, with suggestions after three characters; invited drafts appear in each participant's workspace.
- Flarum’s native TextEditor with its extension-provided icon toolbar and an isolated composer state. A larger category list is available when Flarum Tags is enabled.
- Explicit saves with permanent text snapshots. Compare each text revision with its preceding snapshot using red/green line changes, title changes and category IDs. Read complete texts and restore an older snapshot as a new revision.
- Internal plain-text feedback tied to the text revision being discussed.
- One to five approvals, configured in the administration panel and captured when a draft is created.
- Workflow: **Draft → In review → Approved → Published**.
- Review freezes the text. Requesting changes or returning to editing clears approvals. Normal owners cannot approve their own manuscript; a separate direct-approval group permission can override the reviewer count, including on own drafts.
- Publication through Flarum's standard discussion API as the owner, preserving normal permission, validation, formatting and extension checks.
- Version checks reject stale writes. Conflicting text remains in the editor for downloading and manual merging.
- Unsaved text is retained in memory when navigating within the same application tab. Closing or reloading the tab warns about unsaved text. No draft text is written to browser storage.
- Manuscript text downloads, read-only archives and permanent draft deletion.
- English and German interface and installation instructions.

## Requirements and installation

Flarum `^2.0.2`, PHP `^8.3` and Flarum's configured database. Flarum 1.8 is not supported by this version. FoF Drafts and Admin Console are not dependencies.

Install from Packagist using the commands below. Compiled JavaScript is included; Node.js is unnecessary on the forum server. Separate local ZIP installation guides use `/tmp` for transfers and persistent source directories for Composer.

Enabling the extension creates four database tables. No worker, scheduler, external service or API key is required.

## Installation through Packagist

After version 1.0.1 has been published on Packagist, run the following as the forum filesystem user inside the Flarum directory (inside the container for Docker):

```bash
composer require el-choco/editorial:"^1.0" --update-no-dev --minimal-changes --no-scripts --no-interaction
php flarum extension:enable el-choco-editorial
php flarum migrate --no-interaction
php flarum cache:clear --force
```

With CrazyMax, run `extension sync` after the successful Composer operation and before the Flarum commands. `"^1.0"` permits future 1.x updates; `"*"` also permits future major versions, subject to Composer stability settings. Exact version requirements remain pinned. For a move from a local path installation to Packagist, remove the old path repository entry from its project or global configuration and replace the pinned requirement with `"^1.0"`.

## Updating to 1.0.1

After the release is available on Packagist:

```bash
composer update el-choco/editorial
php flarum migrate
php flarum cache:clear
```

Run these as the forum filesystem user in the forum directory. With CrazyMax, run `extension sync` after the successful Composer operation, before the Flarum commands. If pinned to `1.0.0`, first use `composer require el-choco/editorial:"^1.0"` instead of `composer update`. This release requires a new migration adding two nullable columns for direct approvals. Existing drafts are preserved. Back up the database and Composer files before updating. Clear browser caches afterwards; reload PHP-FPM if OPcache keeps old code.

## Permissions and administration

Grant **Use Editorial and participate in invited drafts** to the groups that should use the workspace. Invitees also need this permission. Administrators have access through Flarum's normal permission system.

The separate **Read every private draft, comment, archive and permanently delete drafts** permission grants access to all Editorial drafts, including drafts where the manager was not invited. Give it only to trusted staff. It does not grant the right to edit or publish another owner's manuscript.

The required approval count applies to new drafts. Existing drafts keep the count they were created with. Editors may change text while a draft is editable; normal approvals can only be given by invited reviewers. The owner manages invitations, submits for review, returns to editing and publishes. Normal owners cannot self-approve. Members with the explicit **Approve drafts directly** permission can approve accessible, nonempty drafts without collecting the configured reviewer count, including their own drafts. Administrators have this permission through Flarum’s normal administrator access. Direct approval does not grant access to private drafts by itself; an invitation or the management permission is still required. The owner remains responsible for publication. Reviewers can request changes with a mandatory comment. Changes to the team are allowed only while editing and clear approvals.

### Homepage and change comparison

In Editorial’s admin settings, configure the banner, title, description, optional welcome/instruction text, cards or list layout and the default status filter and sorting. Blank title/description fields use the translated default. Custom text is plain text and not automatically translated. Status and sort controls in the workspace can override the defaults for the current visit. Filtering happens on the server before pagination and never expands draft access.

The History tab compares a saved text snapshot with the preceding saved text snapshot, skipping comment and workflow events. Red lines were removed, green lines were added; title and category-ID changes are shown separately. Long unchanged sections are collapsed. Large comparisons use replacement blocks and display at most 1,000 rows, with an explicit notice. Both complete texts remain available under **Read full text**.

### Direct approval

Grant **Approve drafts directly, bypassing the required reviewer count, including own drafts** only to trusted groups. An authorised member uses **Approve directly** on a draft they can access. A confirmation explains the bypass; the approval’s actor and revision are recorded in history. It is not automatic publication. The original owner still publishes through Flarum’s normal discussion API.

Reopening, editing, restoring text or changing the team clears direct approvals. Publication checks that the approver still exists and has both Editorial use and direct-approval permissions. Without a valid direct approval, the normal reviewer-count check applies.

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
- Uses Flarum’s native TextEditor. Its standard hooks allow active editor extensions to contribute their tools. Tools that assume the global composer or a specific discussion composer may need an additional integration. Compatibility with third-party editor tools depends on their composer-context assumptions. Uploaded media follows your upload extension’s visibility settings; private manuscripts do not make uploaded files private.
- No automatic saves, email invitations, unread notifications, inline comment threads, ownership transfer or scheduled publication.
- Archives are read-only. There is no unarchive action in this version.
- Flarum validates categories and publication permissions at publication time. A forum extension requiring additional discussion fields may require a later Editorial integration.
- Database rollback protects the manuscript and discussion records on publication failure. Side effects triggered by other extensions, such as external emails or webhooks, cannot necessarily be rolled back.

## Validation

Backend checks use real Flarum 2.0.2 classes, migrations, query builders and an isolated SQLite database. They cover roles, privacy, state transitions, revision restoration, stale writes, revoked reviewer access, rollback and duplicate publication prevention. The publisher adapter is exercised with the real Flarum API client and a controlled response handler. Browser checks use the built frontend, real Flarum TextEditor/BasicEditorDriver classes and representative data.

The maintainer reports successful testing of version 1.0.0 on the target forum without observed errors. Local regression checks cover the cases described above; this does not guarantee compatibility with every third-party composer tool. Version 1.0.1 adds the homepage, comparison and direct-approval features; these additions have local regression coverage and still need verification on the target forum.

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

**Paket:** `el-choco/editorial` · **Version:** `1.0.1` · **Lizenz:** MIT

## Funktionen

- Eigener Redaktionsbereich unter `/editorial` mit berechtigungsabhängigem Sidebar-Link. Die Startseite ist im Adminbereich anpassbar: Banner, Titel, Beschreibung, Begrüßungstext, Karten/Liste, Standardfilter und Sortierung.
- Private Entwürfe mit Eigentümer, Bearbeitern und Prüfern.
- Einladungen über bestehende Benutzernamen mit Vorschlägen ab drei Zeichen. Eingeladene Entwürfe erscheinen im Redaktionsbereich der Beteiligten.
- Flarums nativer TextEditor mit Symbol-Werkzeugleiste der aktiven Erweiterungen und eigenem Composer-Zustand. Eine höhere Kategorieauswahl steht bei aktiviertem Flarum Tags bereit.
- Bewusstes Speichern als neue Textrevision. Zeilenänderungen gegenüber dem vorherigen Textstand erscheinen rot/grün; Titeländerungen und Kategorie-IDs werden separat angezeigt. Vollständige Texte lassen sich lesen und ältere Stände als neue Revision wiederherstellen.
- Interne Textkommentare mit Bezug zur jeweiligen Textrevision.
- Eine bis fünf erforderliche Freigaben, im Adminbereich für neue Entwürfe einstellbar.
- Ablauf: **Entwurf → In Prüfung → Freigegeben → Veröffentlicht**.
- Während der Prüfung ist das Manuskript schreibgeschützt. Erneutes Öffnen oder angeforderte Änderungen heben Freigaben auf. Normale Eigentümer können sich nicht selbst freigeben; ein eigenes Gruppenrecht für die Direktfreigabe kann die Prüferzahl auch bei eigenen Entwürfen übergehen.
- Veröffentlichung über Flarums reguläre Schnittstelle unter dem Konto des Eigentümers. Schreibrechte, Kategorien, Formatierung und Erweiterungsprüfungen bleiben wirksam.
- Versionsprüfung gegen gegenseitiges Überschreiben. Bei einem Konflikt bleibt der lokale Text zum Herunterladen und manuellen Zusammenführen erhalten.
- Ungespeicherter Text bleibt bei interner Navigation im Speicher desselben Anwendungstabs. Vor dem Neuladen oder Schließen warnt der Browser. Es wird kein Entwurfstext im Browserspeicher abgelegt.
- Manuskript herunterladen, schreibgeschützt archivieren oder endgültig löschen.
- Deutsche und englische Oberfläche und Installationsanleitungen.

## Voraussetzungen und Installation

Flarum `^2.0.2`, PHP `^8.3` und Flarums eingerichtete Datenbank. Flarum 1.8 wird von dieser Ausgabe nicht unterstützt. FoF Drafts und Admin Console sind keine Voraussetzung.

Die Installation erfolgt über Packagist mit den unten stehenden Befehlen. Gebautes JavaScript liegt bei; Node.js wird auf dem Forumserver nicht benötigt. Separate lokale ZIP-Anleitungen verwenden `/tmp` für die Übertragung und einen dauerhaften Quellordner für Composer.

Beim Aktivieren entstehen vier Datenbanktabellen. Ein Worker, Cronjob, externer Dienst oder API-Schlüssel ist nicht erforderlich.

## Installation über Packagist

Nach Veröffentlichung der Version 1.0.1 auf Packagist als Dateisystembenutzer des Forums im Flarum-Verzeichnis ausführen (bei Docker im Container):

```bash
composer require el-choco/editorial:"^1.0" --update-no-dev --minimal-changes --no-scripts --no-interaction
php flarum extension:enable el-choco-editorial
php flarum migrate --no-interaction
php flarum cache:clear --force
```

Bei CrazyMax nach erfolgreichem Composer-Vorgang und vor den Flarum-Befehlen `extension sync` ausführen. `"^1.0"` erlaubt künftige 1.x-Updates; `"*"` erlaubt auch spätere Hauptversionen unter Beachtung von Composers Stabilitätseinstellungen. Exakte Versionsvorgaben bleiben festgelegt. Beim Wechsel von einer lokalen Path-Installation zu Packagist den bisherigen Repository-Eintrag aus der Projekt- oder globalen Konfiguration entfernen und die festgelegte Versionsvorgabe durch `"^1.0"` ersetzen.

## Update auf 1.0.1

Nach Verfügbarkeit des Releases auf Packagist:

```bash
composer update el-choco/editorial
php flarum migrate
php flarum cache:clear
```

Als Dateisystembenutzer des Forums im Flarum-Verzeichnis ausführen. Bei CrazyMax nach erfolgreichem Composer-Vorgang zuerst `extension sync` und danach die Flarum-Befehle ausführen. Bei einer festen Vorgabe `1.0.0` stattdessen zuerst `composer require el-choco/editorial:"^1.0"` verwenden. Dieses Release benötigt eine neue Migration für zwei nullable Spalten zur Direktfreigabe. Vorhandene Entwürfe bleiben erhalten. Vorher Datenbank und Composer-Dateien sichern. Anschließend Browsercache leeren; falls OPcache alten Code hält, PHP-FPM neu laden.

## Rechte und Einrichtung

Erlaube den gewünschten Gruppen **Editorial nutzen und an eingeladenen Entwürfen mitarbeiten**. Auch eingeladene Personen benötigen dieses Recht. Administratoren erhalten Zugriff über Flarums normales Rechtesystem.

Das zusätzliche Recht **Alle privaten Entwürfe lesen, kommentieren, archivieren und endgültig löschen** erlaubt Zugriff auf sämtliche Editorial-Entwürfe – auch ohne Einladung. Vergib es nur an vertrauenswürdige Mitarbeiter. Es erlaubt nicht, fremde Manuskripte zu bearbeiten oder unter einem anderen Eigentümer zu veröffentlichen.

Die Zahl erforderlicher Freigaben gilt für neue Entwürfe. Bestehende Entwürfe behalten ihre ursprüngliche Vorgabe. Bearbeiter ändern den Text im Entwurfszustand; reguläre Freigaben können nur eingeladene Prüfer erteilen. Der Eigentümer verwaltet das Team, fordert die Prüfung an, öffnet den Entwurf erneut und veröffentlicht ihn. Normale Eigentümer können sich nicht selbst freigeben. Mitglieder mit dem ausdrücklichen Recht **Entwürfe direkt freigeben** können zugängliche, nicht leere Entwürfe ohne die eingestellte Prüferzahl freigeben, auch eigene. Administratoren besitzen dieses Recht über Flarums normale Administratorberechtigung. Das Direktfreigaberecht gewährt allein keinen Zugriff auf private Entwürfe; dafür bleibt eine Einladung oder das Verwaltungsrecht erforderlich. Veröffentlichen darf weiterhin der Eigentümer. Prüfer können Änderungen mit einem verpflichtenden Kommentar anfordern. Teamänderungen sind nur während der Bearbeitung möglich und heben Freigaben auf.

### Startseite und Änderungsvergleich

In den Editorial-Einstellungen Banner, Titel, Beschreibung, optionalen Begrüßungs-/Hinweistext, Karten- oder Listenansicht sowie Standardfilter und Sortierung festlegen. Leere Titel- und Beschreibungsfelder verwenden den übersetzten Standard. Eigene Texte sind reiner Text und werden nicht automatisch übersetzt. In der Übersicht können Mitglieder Statusfilter und Sortierung für den aktuellen Besuch ändern. Die Filterung erfolgt vor der Seiteneinteilung auf dem Server und erweitert keine Zugriffsrechte.

Im Verlauf wird eine Textrevision mit dem vorherigen gespeicherten Textstand verglichen; Kommentare und Statusereignisse werden dabei übersprungen. Entfernte Zeilen sind rot, neue grün. Titeländerungen und Kategorie-IDs erscheinen separat. Lange unveränderte Abschnitte werden zusammengefasst. Bei großen Vergleichen werden ersetzte Blöcke und höchstens 1.000 Zeilen mit entsprechendem Hinweis angezeigt. Unter **Vollständigen Text lesen** bleiben beide Texte vollständig verfügbar.

### Direktfreigabe

Das Recht **Entwürfe direkt freigeben und die erforderliche Prüferzahl übergehen, auch bei eigenen Entwürfen** gezielt an vertrauenswürdige Gruppen vergeben. Berechtigte Mitglieder wählen bei einem zugänglichen Entwurf **Direkt freigeben**. Eine Bestätigung erklärt die Ausnahme; Person und Revision werden im Verlauf festgehalten. Dies veröffentlicht noch keine Diskussion. Der ursprüngliche Eigentümer veröffentlicht weiterhin über Flarums reguläre Schnittstelle.

Erneutes Öffnen, Bearbeiten, Wiederherstellen oder eine Teamänderung hebt Direktfreigaben auf. Vor der Veröffentlichung wird geprüft, ob die freigebende Person noch existiert und sowohl das Editorial-Nutzungsrecht als auch das Direktfreigaberecht besitzt. Ohne gültige Direktfreigabe gilt weiterhin die normale Prüferzahl.

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
- Flarums nativer TextEditor verwendet seine normalen Erweiterungspunkte für Editor-Werkzeuge. Werkzeuge, die den globalen Composer oder einen bestimmten Diskussions-Composer voraussetzen, können eine zusätzliche Anbindung benötigen. Die Verträglichkeit weiterer Editor-Werkzeuge hängt von deren Anforderungen an den Composer-Kontext ab. Hochgeladene Medien unterliegen den Sichtbarkeitseinstellungen der Upload-Erweiterung; ein privates Manuskript macht Upload-Dateien nicht automatisch privat.
- Kein automatisches Speichern, keine Einladungs-E-Mails, Benachrichtigungen über ungelesene Entwürfe, verankerten Kommentarthreads, Eigentümerwechsel oder zeitgesteuerten Veröffentlichungen.
- Archive sind schreibgeschützt. Eine Wiederöffnung archivierter Entwürfe gibt es in dieser Version nicht.
- Flarum prüft Kategorien und Veröffentlichungsrechte beim Veröffentlichen. Erweiterungen mit zusätzlichen verpflichtenden Diskussionsfeldern können eine spätere Editorial-Anbindung benötigen.
- Bei fehlgeschlagener Veröffentlichung werden Datenbankänderungen an Entwurf und Diskussion zurückgerollt. Nebenwirkungen anderer Erweiterungen, etwa externe E-Mails oder Webhooks, lassen sich nicht zwingend zurücknehmen.

## Prüfung

Die Backend-Prüfungen verwenden echte Klassen aus Flarum 2.0.2, die Migrationen, Datenbankabfragen und eine isolierte SQLite-Datenbank. Sie prüfen Rollen, Privatsphäre, Statuswechsel, Wiederherstellen, veraltete Speicherstände, entzogene Prüferrechte, Rückabwicklung und Schutz vor doppelter Veröffentlichung. Der Veröffentlichungsadapter wird mit Flarums echtem API-Client und einer kontrollierten Antwort geprüft. Browserprüfungen verwenden den gebauten Frontend-Code, Flarums echte TextEditor-/BasicEditorDriver-Klassen und Beispieldaten.

Der Betreiber meldet erfolgreiche Tests der Version 1.0.0 im Ziel-Forum ohne beobachtete Fehler. Die lokalen Prüfungen decken die oben beschriebenen Fälle ab; eine Kompatibilitätsgarantie für sämtliche Editor-Werkzeuge anderer Anbieter ergibt sich daraus nicht. Version 1.0.1 ergänzt Startseite, Vergleich und Direktfreigabe. Diese Ergänzungen sind lokal geprüft und müssen noch im Ziel-Forum bestätigt werden.
