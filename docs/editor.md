---
title: Lernjournal-Editor
description: Markdown- und WYSIWYG-Editor mit MkDocs-Lernblöcken, Mermaid und draw.io
hide:
  - toc
---

# Lernjournal-Editor

Erstelle Lernskripte direkt in der Wissensdatenbank. Der Inhalt wird automatisch
im Browser gespeichert und kann als Markdown-Datei heruntergeladen werden.

!!! info "Lokale Speicherung"

    Entwürfe und draw.io-Diagramme bleiben in diesem Browser auf diesem Gerät.
    Es gibt in dieser Version keine KI-, Word-Import- oder direkte
    GitHub-Veröffentlichungsfunktion.

<noscript>
  <p class="ke-load-error">
    Für den Lernjournal-Editor muss JavaScript im Browser aktiviert sein.
  </p>
</noscript>

<div id="knowledge-editor-app" class="knowledge-editor" hidden>
  <section class="ke-document-bar" aria-label="Dokumenteinstellungen">
    <div class="ke-field ke-field--wide">
      <label for="ke-document-title">Dokumenttitel</label>
      <input
        id="ke-document-title"
        type="text"
        autocomplete="off"
        placeholder="z. B. Virtual Local Area Network"
      >
    </div>

    <div class="ke-field">
      <label for="ke-target-folder">Zielbereich</label>
      <select id="ke-target-folder">
        <option value="">Startbereich</option>
        <option value="netzwerktechnik">Netzwerktechnik</option>
        <option value="betriebssysteme">Betriebssysteme</option>
        <option value="programmierung">Programmierung</option>
        <option value="datenbanken">Datenbanken</option>
        <option value="mathematik-und-logik">Mathematik und Logik</option>
        <option value="allgemein">Allgemein</option>
      </select>
    </div>

    <div class="ke-field">
      <label for="ke-filename">Dateiname</label>
      <div class="ke-filename-control">
        <input
          id="ke-filename"
          type="text"
          autocomplete="off"
          spellcheck="false"
          placeholder="vlan"
        >
        <span aria-hidden="true">.md</span>
      </div>
    </div>

    <div class="ke-document-actions">
      <button id="ke-new-document" type="button" class="md-button">
        Neues Dokument
      </button>
      <button id="ke-restore-draft" type="button" class="md-button">
        Entwurf wiederherstellen
      </button>
      <button
        id="ke-download-markdown"
        type="button"
        class="md-button md-button--primary"
      >
        Markdown herunterladen
      </button>
    </div>
  </section>

  <div class="ke-path-line">
    Vorgesehener Zielpfad:
    <code id="ke-target-path">docs/lernskript.md</code>
  </div>

  <div
    id="ke-save-status"
    class="ke-save-status"
    role="status"
    aria-live="polite"
  >
    Editor wird geladen …
  </div>

  <div id="ke-editor-host" aria-label="Markdown-Editor"></div>

  <section class="ke-diagram-library" aria-labelledby="ke-diagram-heading">
    <div class="ke-section-heading">
      <div>
        <h2 id="ke-diagram-heading">draw.io-Diagramme</h2>
        <p>
          Netzpläne, Flussdiagramme und Relationenmodelle bleiben als
          bearbeitbare XML-Daten im lokalen Entwurf gespeichert.
        </p>
      </div>
      <button
        id="ke-new-diagram"
        type="button"
        class="md-button md-button--primary"
      >
        Neues draw.io-Diagramm
      </button>
    </div>

    <div id="ke-diagram-list" class="ke-diagram-list"></div>
  </section>

  <details class="ke-help">
    <summary>So verwendest du den Editor</summary>
    <ol>
      <li>Schreibe im Markdown- oder WYSIWYG-Modus.</li>
      <li>
        Nutze die zusätzlichen Schaltflächen für Definition, Merksatz,
        Beispiel, Prüfungsfrage, SQL, C#, Mermaid und draw.io.
      </li>
      <li>
        Speichere draw.io im eingebetteten Fenster über
        <strong>Speichern &amp; schließen</strong>.
      </li>
      <li>
        Lade Markdown sowie benötigte SVG- und .drawio-Dateien aus der
        Diagrammbibliothek herunter.
      </li>
    </ol>
  </details>

  <p class="ke-legacy-note">
    Die frühere Einzeldatei-Version bleibt im Repository als
    <a
      href="https://github.com/Lexxi11/judgement/blob/main/docs/editor/index.html"
      target="_blank"
      rel="noopener"
    >Legacy-Editor</a>
    erhalten, wird aber nicht mehr in die Website gebaut.
  </p>
</div>

<div
  id="ke-drawio-modal"
  class="ke-modal"
  role="dialog"
  aria-modal="true"
  aria-labelledby="ke-drawio-title"
  hidden
>
  <div class="ke-modal__panel">
    <header class="ke-modal__header">
      <div class="ke-modal__title-group">
        <label for="ke-diagram-name">Diagrammname</label>
        <input
          id="ke-diagram-name"
          type="text"
          autocomplete="off"
          placeholder="z. B. VLAN-Netzplan"
        >
      </div>
      <button
        id="ke-close-drawio"
        type="button"
        class="ke-icon-button"
        aria-label="draw.io schließen"
      >
        ×
      </button>
    </header>

    <div class="ke-modal__body">
      <div id="ke-drawio-loading" class="ke-drawio-loading">
        diagrams.net wird geladen …
      </div>
      <iframe
        id="ke-drawio-frame"
        title="Eingebetteter diagrams.net-Editor"
        referrerpolicy="no-referrer"
      ></iframe>
    </div>

    <footer class="ke-modal__footer">
      <span id="ke-drawio-status" role="status" aria-live="polite">
        Zum Übernehmen im diagrams.net-Fenster „Speichern &amp; schließen“
        wählen.
      </span>
      <button id="ke-cancel-drawio" type="button" class="md-button">
        Abbrechen
      </button>
    </footer>
  </div>
</div>

<div id="ke-toast" class="ke-toast" role="status" aria-live="polite" hidden></div>
