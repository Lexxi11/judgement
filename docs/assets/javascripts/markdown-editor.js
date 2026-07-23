(function () {
  "use strict";

  const STORAGE_KEY = "judgement.knowledge-editor.draft.v1";
  const DRAWIO_ORIGIN = "https://embed.diagrams.net";
  const DRAWIO_URL =
    DRAWIO_ORIGIN +
    "/?embed=1&proto=json&spin=1&ui=min&libraries=1&lang=de";
  const AUTOSAVE_DELAY = 700;

  let editor = null;
  let elements = null;
  let diagrams = {};
  let activeDiagram = null;
  let filenameTouched = false;
  let autosaveTimer = 0;
  let previewTimer = 0;
  let toastTimer = 0;
  let mermaidCounter = 0;
  let previewObserver = null;

  function byId(id) {
    return document.getElementById(id);
  }

  function isDarkMode() {
    return document.body.getAttribute("data-md-color-scheme") === "slate";
  }

  function slugify(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ß/g, "ss")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 80);
  }

  function createId(prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return prefix + "-" + window.crypto.randomUUID();
    }

    return (
      prefix +
      "-" +
      Date.now().toString(36) +
      "-" +
      Math.random().toString(36).slice(2, 10)
    );
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function escapeMarkdownLabel(value) {
    return String(value || "").replace(/([\\[\]])/g, "\\$1");
  }

  function formatTime(value) {
    const date = value ? new Date(value) : new Date();

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return new Intl.DateTimeFormat("de-DE", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(date);
  }

  function showToast(message, kind) {
    if (!elements || !elements.toast) {
      return;
    }

    window.clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.dataset.kind = kind || "info";
    elements.toast.hidden = false;

    toastTimer = window.setTimeout(function () {
      elements.toast.hidden = true;
    }, 4200);
  }

  function setSaveStatus(message, state) {
    elements.saveStatus.textContent = message;
    elements.saveStatus.dataset.state = state || "idle";
  }

  function readDraft() {
    try {
      const value = window.localStorage.getItem(STORAGE_KEY);

      if (!value) {
        return null;
      }

      return normalizeDraft(JSON.parse(value));
    } catch (error) {
      console.warn("Der lokale Entwurf konnte nicht gelesen werden.", error);
      return null;
    }
  }

  function normalizeDraft(value) {
    if (!value || typeof value !== "object") {
      return null;
    }

    const normalizedDiagrams = {};
    const diagramValues = Array.isArray(value.diagrams)
      ? value.diagrams
      : Object.values(value.diagrams || {});

    diagramValues.forEach(function (diagram) {
      if (!diagram || !diagram.id || !diagram.xml) {
        return;
      }

      normalizedDiagrams[String(diagram.id)] = {
        id: String(diagram.id),
        name: String(diagram.name || "Diagramm"),
        slug: slugify(diagram.slug || diagram.name || "diagramm") || "diagramm",
        xml: String(diagram.xml),
        svgData: String(diagram.svgData || ""),
        updatedAt: String(diagram.updatedAt || new Date().toISOString()),
      };
    });

    return {
      version: 1,
      title: String(value.title || ""),
      folder: String(value.folder || ""),
      filename: slugify(value.filename || ""),
      markdown: String(value.markdown || ""),
      diagrams: normalizedDiagrams,
      updatedAt: String(value.updatedAt || ""),
    };
  }

  function collectDraft() {
    return {
      version: 1,
      title: elements.documentTitle.value.trim(),
      folder: elements.targetFolder.value,
      filename: slugify(elements.filename.value),
      markdown: editor ? editor.getMarkdown() : "",
      diagrams: diagrams,
      updatedAt: new Date().toISOString(),
    };
  }

  function writeDraft() {
    window.clearTimeout(autosaveTimer);

    try {
      const draft = collectDraft();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
      elements.restoreDraft.disabled = false;
      setSaveStatus(
        "Lokal gespeichert um " +
          new Intl.DateTimeFormat("de-DE", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }).format(new Date()),
        "saved"
      );
    } catch (error) {
      console.error("Der Entwurf konnte nicht gespeichert werden.", error);
      setSaveStatus(
        "Lokales Speichern fehlgeschlagen. Der Browser-Speicher ist möglicherweise voll.",
        "error"
      );
      showToast(
        "Der Entwurf konnte nicht lokal gespeichert werden. Große Diagramme können den Browser-Speicher füllen.",
        "error"
      );
    }
  }

  function scheduleAutosave() {
    window.clearTimeout(autosaveTimer);
    setSaveStatus("Ungespeicherte Änderungen …", "idle");
    autosaveTimer = window.setTimeout(writeDraft, AUTOSAVE_DELAY);
  }

  function targetDiagramPath(diagram, includeEditorId) {
    const prefix = elements.targetFolder.value
      ? "../assets/diagrams/"
      : "assets/diagrams/";
    const suffix = includeEditorId ? "#drawio=" + diagram.id : "";
    return prefix + diagram.slug + ".svg" + suffix;
  }

  function diagramMarkdown(diagram, includeEditorId) {
    return (
      "![" +
      escapeMarkdownLabel(diagram.name) +
      "](" +
      targetDiagramPath(diagram, includeEditorId) +
      ")"
    );
  }

  function updateTargetPath() {
    const name =
      slugify(elements.filename.value) ||
      slugify(elements.documentTitle.value) ||
      "lernskript";
    const folder = elements.targetFolder.value
      ? elements.targetFolder.value + "/"
      : "";

    elements.targetPath.textContent = "docs/" + folder + name + ".md";
  }

  function applyDraft(draft, announce) {
    if (!draft) {
      return;
    }

    elements.documentTitle.value = draft.title;
    elements.targetFolder.value = draft.folder;
    elements.filename.value = draft.filename;
    filenameTouched = Boolean(draft.filename);
    diagrams = draft.diagrams || {};
    editor.setMarkdown(draft.markdown || "", false);
    updateTargetPath();
    renderDiagramLibrary();
    schedulePreviewRendering();

    if (announce) {
      setSaveStatus(
        draft.updatedAt
          ? "Entwurf vom " + formatTime(draft.updatedAt) + " wiederhergestellt."
          : "Entwurf wiederhergestellt.",
        "saved"
      );
      showToast("Der lokale Entwurf wurde wiederhergestellt.");
    }
  }

  function createToolbarButton(name, label, tooltip, handler, modifierClass) {
    const button = document.createElement("button");
    button.type = "button";
    button.className =
      "ke-toolbar-button" + (modifierClass ? " " + modifierClass : "");
    button.textContent = label;
    button.setAttribute("aria-label", tooltip);
    button.title = tooltip;
    button.addEventListener("click", function (event) {
      event.preventDefault();
      handler();
    });

    return {
      name: name,
      tooltip: tooltip,
      el: button,
    };
  }

  function indentMarkdown(text, spaces) {
    const indentation = " ".repeat(spaces || 4);
    return String(text || "")
      .split(/\r?\n/)
      .map(function (line) {
        return indentation + line;
      })
      .join("\n");
  }

  function insertSnippet(type) {
    if (!editor) {
      return;
    }

    let selected = "";

    try {
      selected = editor.getSelectedText() || "";
    } catch (error) {
      selected = "";
    }

    const snippets = {
      definition:
        '!!! info "Definition"\n\n' +
        indentMarkdown(selected || "Begriff und Definition eintragen.", 4),
      merksatz:
        '!!! tip "Merksatz"\n\n' +
        indentMarkdown(selected || "Den wichtigsten Merksatz eintragen.", 4),
      beispiel:
        '!!! example "Beispiel"\n\n' +
        indentMarkdown(selected || "Ein konkretes Beispiel eintragen.", 4),
      frage:
        '??? question "Prüfungsfrage"\n\n' +
        indentMarkdown(
          "**Frage:** " +
            (selected || "Frage eintragen.") +
            '\n\n??? success "Lösung"\n\n' +
            indentMarkdown("Lösung eintragen.", 4),
          4
        ),
      sql:
        "```sql\n" +
        (selected || "SELECT spalte\nFROM tabelle\nWHERE bedingung;") +
        "\n```",
      csharp:
        "```csharp\n" +
        (selected ||
          'bool istAktiv = true;\n\nif (istAktiv)\n{\n    Console.WriteLine("Aktiv");\n}') +
        "\n```",
      mermaid:
        "```mermaid\n" +
        (selected ||
          "flowchart TD\n    A[Start] --> B{Entscheidung}\n    B -->|Ja| C[Aktion]\n    B -->|Nein| D[Alternative]\n    C --> E[Ende]\n    D --> E") +
        "\n```",
    };

    const snippet = snippets[type];

    if (!snippet) {
      return;
    }

    if (!editor.isMarkdownMode()) {
      editor.changeMode("markdown", true);
    }

    window.requestAnimationFrame(function () {
      editor.focus();
      editor.insertText("\n\n" + snippet + "\n\n");
      scheduleAutosave();
      schedulePreviewRendering();
    });
  }

  function createToolbarItems() {
    return [
      ["heading", "bold", "italic", "strike"],
      ["hr", "quote"],
      ["ul", "ol", "task", "indent", "outdent"],
      ["table", "image", "link"],
      ["code", "codeblock"],
      [
        createToolbarButton(
          "keDefinition",
          "Def",
          "Definition einfügen",
          function () {
            insertSnippet("definition");
          }
        ),
        createToolbarButton(
          "keMerksatz",
          "Merk",
          "Merksatz einfügen",
          function () {
            insertSnippet("merksatz");
          }
        ),
        createToolbarButton(
          "keBeispiel",
          "Bsp",
          "Beispiel einfügen",
          function () {
            insertSnippet("beispiel");
          }
        ),
        createToolbarButton(
          "keFrage",
          "Frage",
          "Prüfungsfrage mit Lösung einfügen",
          function () {
            insertSnippet("frage");
          }
        ),
      ],
      [
        createToolbarButton("keSql", "SQL", "SQL-Codeblock einfügen", function () {
          insertSnippet("sql");
        }),
        createToolbarButton("keCsharp", "C#", "C#-Codeblock einfügen", function () {
          insertSnippet("csharp");
        }),
        createToolbarButton(
          "keMermaid",
          "Mermaid",
          "Mermaid-Diagramm einfügen",
          function () {
            insertSnippet("mermaid");
          },
          "ke-toolbar-button--diagram"
        ),
        createToolbarButton(
          "keDrawio",
          "draw.io",
          "Grafisches Diagramm mit draw.io erstellen",
          function () {
            openDrawio();
          },
          "ke-toolbar-button--drawio"
        ),
      ],
    ];
  }

  function schedulePreviewRendering() {
    window.clearTimeout(previewTimer);
    previewTimer = window.setTimeout(function () {
      enhanceDrawioPreviews();
      renderMermaidPreviews();
    }, 160);
  }

  function extractDiagramId(source) {
    const match = String(source || "").match(/#drawio=([a-zA-Z0-9_-]+)/);
    return match ? match[1] : "";
  }

  function enhanceDrawioPreviews() {
    if (!elements || !elements.editorHost) {
      return;
    }

    const images = elements.editorHost.querySelectorAll(
      ".toastui-editor-md-preview img"
    );

    images.forEach(function (image) {
      const id =
        image.dataset.drawioId ||
        extractDiagramId(image.getAttribute("src")) ||
        extractDiagramId(image.dataset.originalSrc);
      const diagram = diagrams[id];

      if (!diagram || !diagram.svgData) {
        return;
      }

      image.dataset.drawioId = id;

      if (!image.dataset.originalSrc) {
        image.dataset.originalSrc = image.getAttribute("src") || "";
      }

      image.setAttribute("src", diagram.svgData);
      image.setAttribute("alt", diagram.name);

      let wrapper = image.closest(".ke-drawio-preview");

      if (!wrapper) {
        wrapper = document.createElement("div");
        wrapper.className = "ke-drawio-preview";
        wrapper.dataset.diagramId = id;
        wrapper.tabIndex = 0;
        wrapper.setAttribute("role", "button");
        wrapper.setAttribute(
          "aria-label",
          diagram.name + " im draw.io-Editor bearbeiten"
        );
        image.parentNode.insertBefore(wrapper, image);
        wrapper.appendChild(image);
      } else {
        wrapper.dataset.diagramId = id;
      }
    });
  }

  async function renderMermaidPreviews() {
    if (
      !window.mermaid ||
      typeof window.mermaid.render !== "function" ||
      !elements
    ) {
      return;
    }

    const codeBlocks = elements.editorHost.querySelectorAll(
      ".toastui-editor-md-preview pre.lang-mermaid code, " +
        '.toastui-editor-md-preview pre code[data-language="mermaid"], ' +
        ".toastui-editor-md-preview pre code.language-mermaid, " +
        ".toastui-editor-md-preview pre code.lang-mermaid"
    );

    for (const code of codeBlocks) {
      const pre = code.closest("pre");

      if (!pre || pre.dataset.keMermaidPending === "true") {
        continue;
      }

      const source = code.textContent || "";
      pre.dataset.keMermaidPending = "true";

      try {
        const result = await window.mermaid.render(
          "ke-mermaid-" + ++mermaidCounter,
          source
        );
        const wrapper = document.createElement("div");
        wrapper.className = "ke-mermaid-preview";
        wrapper.setAttribute("aria-label", "Mermaid-Diagrammvorschau");
        wrapper.innerHTML = result.svg;
        pre.replaceWith(wrapper);
      } catch (error) {
        pre.dataset.keMermaidPending = "false";

        if (
          !pre.nextElementSibling ||
          !pre.nextElementSibling.classList.contains("ke-mermaid-error")
        ) {
          const message = document.createElement("div");
          message.className = "ke-mermaid-error";
          message.textContent =
            "Mermaid konnte dieses Diagramm noch nicht darstellen. Bitte die Syntax prüfen.";
          pre.insertAdjacentElement("afterend", message);
        }
      }
    }
  }

  function blankDiagramXml(id) {
    return (
      '<mxfile host="embed.diagrams.net">' +
      '<diagram id="' +
      id +
      '" name="Seite-1">' +
      '<mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" ' +
      'tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" ' +
      'pageWidth="1169" pageHeight="827" math="0" shadow="0">' +
      '<root><mxCell id="0"/><mxCell id="1" parent="0"/></root>' +
      "</mxGraphModel></diagram></mxfile>"
    );
  }

  function uniqueDiagramSlug(name, currentId) {
    const base = slugify(name) || "diagramm";
    const used = new Set(
      Object.values(diagrams)
        .filter(function (diagram) {
          return diagram.id !== currentId;
        })
        .map(function (diagram) {
          return diagram.slug;
        })
    );

    if (!used.has(base)) {
      return base;
    }

    let counter = 2;
    let candidate = base + "-" + counter;

    while (used.has(candidate)) {
      counter += 1;
      candidate = base + "-" + counter;
    }

    return candidate;
  }

  function openDrawio(id) {
    const existing = id ? diagrams[id] : null;
    const diagramId = existing ? existing.id : createId("diagram");

    activeDiagram = {
      id: diagramId,
      isNew: !existing,
      xml: existing ? existing.xml : blankDiagramXml(diagramId),
      exporting: false,
    };

    elements.diagramName.value = existing
      ? existing.name
      : "Neues Diagramm";
    elements.drawioStatus.textContent =
      "Zum Übernehmen im diagrams.net-Fenster „Speichern & schließen“ wählen.";
    elements.drawioLoading.hidden = false;
    elements.drawioModal.hidden = false;
    document.body.classList.add("ke-modal-open");
    elements.drawioFrame.src = DRAWIO_URL;
    elements.diagramName.focus();
    elements.diagramName.select();
  }

  function closeDrawio() {
    elements.drawioModal.hidden = true;
    elements.drawioFrame.src = "about:blank";
    elements.drawioLoading.hidden = false;
    document.body.classList.remove("ke-modal-open");
    activeDiagram = null;
  }

  function postToDrawio(message) {
    if (
      !elements ||
      !elements.drawioFrame ||
      !elements.drawioFrame.contentWindow
    ) {
      return;
    }

    elements.drawioFrame.contentWindow.postMessage(
      JSON.stringify(message),
      DRAWIO_ORIGIN
    );
  }

  function parseDrawioMessage(value) {
    if (typeof value === "string") {
      try {
        return JSON.parse(value);
      } catch (error) {
        return null;
      }
    }

    return value && typeof value === "object" ? value : null;
  }

  function handleDrawioMessage(event) {
    if (
      !activeDiagram ||
      event.origin !== DRAWIO_ORIGIN ||
      event.source !== elements.drawioFrame.contentWindow
    ) {
      return;
    }

    const message = parseDrawioMessage(event.data);

    if (!message || !message.event) {
      return;
    }

    if (message.event === "init") {
      postToDrawio({
        action: "load",
        autosave: 1,
        saveAndExit: "1",
        modified: "unsavedChanges",
        xml: activeDiagram.xml,
        title: elements.diagramName.value.trim() || "Diagramm",
      });
      elements.drawioLoading.hidden = true;
      elements.drawioStatus.textContent =
        "Diagramm bearbeiten und anschließend „Speichern & schließen“ wählen.";
      return;
    }

    if (message.event === "autosave" && message.xml) {
      activeDiagram.xml = String(message.xml);
      elements.drawioStatus.textContent =
        "Änderungen im Diagramm wurden zwischengespeichert.";
      return;
    }

    if (message.event === "save") {
      if (message.xml) {
        activeDiagram.xml = String(message.xml);
      }

      if (message.exit) {
        requestDrawioExport();
      } else {
        elements.drawioStatus.textContent =
          "Diagramm gespeichert. Zum Übernehmen „Speichern & schließen“ wählen.";
        postToDrawio({
          action: "status",
          messageKey: "allChangesSaved",
          modified: false,
        });
      }
      return;
    }

    if (message.event === "exit") {
      if (message.xml) {
        activeDiagram.xml = String(message.xml);
      }

      if (message.modified === false && !message.xml) {
        closeDrawio();
      } else {
        requestDrawioExport();
      }
      return;
    }

    if (message.event === "export") {
      if (!message.data) {
        activeDiagram.exporting = false;
        elements.drawioStatus.textContent =
          "SVG-Export fehlgeschlagen. Bitte erneut speichern.";
        return;
      }

      saveDrawioResult(String(message.data));
    }
  }

  function requestDrawioExport() {
    if (!activeDiagram || activeDiagram.exporting) {
      return;
    }

    activeDiagram.exporting = true;
    elements.drawioStatus.textContent = "SVG-Vorschau wird erstellt …";
    postToDrawio({
      action: "export",
      format: "svg",
      xml: activeDiagram.xml,
      spinKey: "export",
    });
  }

  function replaceDiagramReference(markdown, diagram) {
    const id = escapeRegExp(diagram.id);
    const pattern = new RegExp(
      "!\\[[^\\]]*\\]\\([^\\n)]*#drawio=" + id + "\\)",
      "g"
    );
    return markdown.replace(pattern, diagramMarkdown(diagram, true));
  }

  function hasDiagramReference(markdown, id) {
    return new RegExp("#drawio=" + escapeRegExp(id) + "(?:\\)|\\s)").test(
      markdown
    );
  }

  function saveDrawioResult(svgData) {
    const previous = diagrams[activeDiagram.id];
    const name =
      elements.diagramName.value.trim() ||
      (previous && previous.name) ||
      "Diagramm";
    const diagram = {
      id: activeDiagram.id,
      name: name,
      slug: uniqueDiagramSlug(name, activeDiagram.id),
      xml: activeDiagram.xml,
      svgData: svgData,
      updatedAt: new Date().toISOString(),
    };
    const markdown = editor.getMarkdown();

    diagrams[diagram.id] = diagram;

    if (hasDiagramReference(markdown, diagram.id)) {
      editor.setMarkdown(replaceDiagramReference(markdown, diagram), false);
    } else {
      insertDiagramReference(diagram);
    }

    renderDiagramLibrary();
    writeDraft();
    schedulePreviewRendering();
    closeDrawio();
    showToast("„" + diagram.name + "“ wurde in die Notiz übernommen.");
  }

  function insertDiagramReference(diagram) {
    if (!editor.isMarkdownMode()) {
      editor.changeMode("markdown", true);
    }

    window.requestAnimationFrame(function () {
      editor.focus();
      editor.insertText("\n\n" + diagramMarkdown(diagram, true) + "\n\n");
      scheduleAutosave();
      schedulePreviewRendering();
    });
  }

  function createActionButton(label, action, className) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;

    if (className) {
      button.className = className;
    }

    button.addEventListener("click", action);
    return button;
  }

  function renderDiagramLibrary() {
    elements.diagramList.replaceChildren();
    const values = Object.values(diagrams).sort(function (left, right) {
      return String(right.updatedAt).localeCompare(String(left.updatedAt));
    });

    if (!values.length) {
      const empty = document.createElement("p");
      empty.className = "ke-diagram-empty";
      empty.textContent =
        "Noch keine draw.io-Diagramme vorhanden. Erstelle das erste Diagramm über die Toolbar oder die Schaltfläche oben.";
      elements.diagramList.appendChild(empty);
      return;
    }

    values.forEach(function (diagram) {
      const card = document.createElement("article");
      card.className = "ke-diagram-card";

      const preview = document.createElement("div");
      preview.className = "ke-diagram-card__preview";

      if (diagram.svgData) {
        const image = document.createElement("img");
        image.src = diagram.svgData;
        image.alt = diagram.name;
        preview.appendChild(image);
      } else {
        preview.textContent = "Noch keine SVG-Vorschau";
      }

      const content = document.createElement("div");
      content.className = "ke-diagram-card__content";

      const heading = document.createElement("h3");
      heading.textContent = diagram.name;
      heading.title = diagram.name;

      const meta = document.createElement("p");
      meta.className = "ke-diagram-card__meta";
      meta.textContent =
        diagram.slug + ".svg · geändert " + formatTime(diagram.updatedAt);

      const actions = document.createElement("div");
      actions.className = "ke-diagram-card__actions";
      actions.append(
        createActionButton("Einfügen", function () {
          insertDiagramReference(diagram);
        }),
        createActionButton("Bearbeiten", function () {
          openDrawio(diagram.id);
        }),
        createActionButton("SVG", function () {
          downloadSvg(diagram);
        }),
        createActionButton(".drawio", function () {
          downloadFile(
            diagram.xml,
            diagram.slug + ".drawio",
            "application/vnd.jgraph.mxfile;charset=utf-8"
          );
        }),
        createActionButton(
          "Löschen",
          function () {
            deleteDiagram(diagram);
          },
          "ke-danger"
        )
      );

      content.append(heading, meta, actions);
      card.append(preview, content);
      elements.diagramList.appendChild(card);
    });
  }

  function deleteDiagram(diagram) {
    if (
      !window.confirm(
        "Diagramm „" +
          diagram.name +
          "“ löschen? Die Referenz wird auch aus der aktuellen Notiz entfernt."
      )
    ) {
      return;
    }

    delete diagrams[diagram.id];

    const pattern = new RegExp(
      "^\\s*!\\[[^\\]]*\\]\\([^\\n)]*#drawio=" +
        escapeRegExp(diagram.id) +
        "\\)\\s*$",
      "gm"
    );
    editor.setMarkdown(editor.getMarkdown().replace(pattern, ""), false);
    renderDiagramLibrary();
    writeDraft();
    schedulePreviewRendering();
    showToast("Das Diagramm wurde aus dem lokalen Entwurf gelöscht.");
  }

  function dataUrlToBlob(dataUrl) {
    if (!dataUrl.startsWith("data:")) {
      return new Blob([dataUrl], { type: "image/svg+xml;charset=utf-8" });
    }

    const comma = dataUrl.indexOf(",");

    if (comma < 0) {
      return new Blob([dataUrl], { type: "image/svg+xml;charset=utf-8" });
    }

    const metadata = dataUrl.slice(0, comma);
    const payload = dataUrl.slice(comma + 1);
    const mimeMatch = metadata.match(/^data:([^;,]+)/);
    const mime = mimeMatch ? mimeMatch[1] : "image/svg+xml";

    if (/;base64/i.test(metadata)) {
      const binary = window.atob(payload);
      const bytes = new Uint8Array(binary.length);

      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }

      return new Blob([bytes], { type: mime });
    }

    return new Blob([decodeURIComponent(payload)], { type: mime });
  }

  function downloadSvg(diagram) {
    if (!diagram.svgData) {
      showToast("Für dieses Diagramm ist noch keine SVG-Vorschau vorhanden.", "error");
      return;
    }

    downloadBlob(dataUrlToBlob(diagram.svgData), diagram.slug + ".svg");
  }

  function downloadFile(content, filename, mime) {
    downloadBlob(new Blob([content], { type: mime }), filename);
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function markdownForDownload() {
    let markdown = editor.getMarkdown();

    Object.values(diagrams).forEach(function (diagram) {
      const id = escapeRegExp(diagram.id);
      const pattern = new RegExp(
        "!\\[[^\\]]*\\]\\([^\\n)]*#drawio=" + id + "\\)",
        "g"
      );
      markdown = markdown.replace(pattern, diagramMarkdown(diagram, false));
    });

    return markdown.replace(/\r\n/g, "\n").trimEnd() + "\n";
  }

  function downloadMarkdown() {
    const markdown = markdownForDownload();

    if (!markdown.trim()) {
      showToast("Das Dokument ist noch leer.", "error");
      return;
    }

    const filename =
      slugify(elements.filename.value) ||
      slugify(elements.documentTitle.value) ||
      "lernskript";

    downloadFile(
      markdown,
      filename + ".md",
      "text/markdown;charset=utf-8"
    );
    writeDraft();
    showToast(
      filename +
        ".md wurde heruntergeladen. Benötigte SVG- und .drawio-Dateien findest du in der Diagrammbibliothek."
    );
  }

  function newDocument() {
    const hasContent =
      editor.getMarkdown().trim() || Object.keys(diagrams).length > 0;

    if (
      hasContent &&
      !window.confirm(
        "Ein neues Dokument beginnen? Der aktuelle lokale Entwurf wird dadurch ersetzt."
      )
    ) {
      return;
    }

    diagrams = {};
    filenameTouched = false;
    elements.documentTitle.value = "";
    elements.targetFolder.value = "";
    elements.filename.value = "";
    editor.setMarkdown("", false);
    updateTargetPath();
    renderDiagramLibrary();
    writeDraft();
    schedulePreviewRendering();
    editor.focus();
    showToast("Ein neues leeres Dokument wurde angelegt.");
  }

  function restoreDraft() {
    const draft = readDraft();

    if (!draft) {
      elements.restoreDraft.disabled = true;
      showToast("Es ist noch kein lokaler Entwurf vorhanden.", "error");
      return;
    }

    if (
      editor.getMarkdown().trim() &&
      !window.confirm("Aktuellen Inhalt durch den gespeicherten Entwurf ersetzen?")
    ) {
      return;
    }

    applyDraft(draft, true);
  }

  function bindControls() {
    elements.documentTitle.addEventListener("input", function () {
      if (!filenameTouched || !elements.filename.value.trim()) {
        elements.filename.value = slugify(elements.documentTitle.value);
      }

      updateTargetPath();
      scheduleAutosave();
    });

    elements.targetFolder.addEventListener("change", function () {
      updateTargetPath();
      scheduleAutosave();
    });

    elements.filename.addEventListener("input", function () {
      filenameTouched = true;
      const selectionStart = elements.filename.selectionStart;
      const normalized = slugify(elements.filename.value);
      elements.filename.value = normalized;

      if (selectionStart !== null) {
        const position = Math.min(selectionStart, normalized.length);
        elements.filename.setSelectionRange(position, position);
      }

      updateTargetPath();
      scheduleAutosave();
    });

    elements.newDocument.addEventListener("click", newDocument);
    elements.restoreDraft.addEventListener("click", restoreDraft);
    elements.downloadMarkdown.addEventListener("click", downloadMarkdown);
    elements.newDiagram.addEventListener("click", function () {
      openDrawio();
    });
    elements.closeDrawio.addEventListener("click", closeDrawio);
    elements.cancelDrawio.addEventListener("click", closeDrawio);

    elements.editorHost.addEventListener("click", function (event) {
      const preview = event.target.closest(".ke-drawio-preview");

      if (preview && preview.dataset.diagramId) {
        openDrawio(preview.dataset.diagramId);
      }
    });

    elements.editorHost.addEventListener("keydown", function (event) {
      const preview = event.target.closest(".ke-drawio-preview");

      if (
        preview &&
        preview.dataset.diagramId &&
        (event.key === "Enter" || event.key === " ")
      ) {
        event.preventDefault();
        openDrawio(preview.dataset.diagramId);
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !elements.drawioModal.hidden) {
        closeDrawio();
      }
    });

    window.addEventListener("message", handleDrawioMessage);
  }

  function syncEditorTheme() {
    if (!elements || !elements.editorHost) {
      return;
    }

    const editorUi = elements.editorHost.querySelector(
      ".toastui-editor-defaultUI"
    );

    if (editorUi) {
      editorUi.classList.toggle("toastui-editor-dark", isDarkMode());
    }
  }

  function initializeMermaid() {
    if (!window.mermaid || window.__judgementMermaidInitialized) {
      return;
    }

    window.mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: isDarkMode() ? "dark" : "default",
    });
    window.__judgementMermaidInitialized = true;
  }

  window.addEventListener("judgement:mermaid-ready", function () {
    initializeMermaid();
    schedulePreviewRendering();
  });

  function mapElements(root) {
    return {
      root: root,
      documentTitle: byId("ke-document-title"),
      targetFolder: byId("ke-target-folder"),
      filename: byId("ke-filename"),
      newDocument: byId("ke-new-document"),
      restoreDraft: byId("ke-restore-draft"),
      downloadMarkdown: byId("ke-download-markdown"),
      targetPath: byId("ke-target-path"),
      saveStatus: byId("ke-save-status"),
      editorHost: byId("ke-editor-host"),
      newDiagram: byId("ke-new-diagram"),
      diagramList: byId("ke-diagram-list"),
      drawioModal: byId("ke-drawio-modal"),
      diagramName: byId("ke-diagram-name"),
      closeDrawio: byId("ke-close-drawio"),
      cancelDrawio: byId("ke-cancel-drawio"),
      drawioFrame: byId("ke-drawio-frame"),
      drawioLoading: byId("ke-drawio-loading"),
      drawioStatus: byId("ke-drawio-status"),
      toast: byId("ke-toast"),
    };
  }

  function showDependencyError(root) {
    root.hidden = false;
    root.innerHTML =
      '<p class="ke-load-error">' +
      "TOAST UI Editor konnte nicht geladen werden. Bitte die Seite neu laden " +
      "und prüfen, ob der Browser externe Skripte von uicdn.toast.com blockiert." +
      "</p>";
  }

  function initializeEditor(root) {
    if (root.dataset.keInitialized === "true") {
      return;
    }

    root.dataset.keInitialized = "true";
    elements = mapElements(root);
    const savedDraft = readDraft();

    if (savedDraft) {
      elements.documentTitle.value = savedDraft.title;
      elements.targetFolder.value = savedDraft.folder;
      elements.filename.value = savedDraft.filename;
      filenameTouched = Boolean(savedDraft.filename);
      diagrams = savedDraft.diagrams || {};
    }

    const options = {
      el: elements.editorHost,
      height: "42rem",
      minHeight: "28rem",
      initialEditType: "markdown",
      previewStyle: "vertical",
      initialValue: savedDraft ? savedDraft.markdown : "",
      placeholder: "Beginne hier mit deinem Lernskript …",
      usageStatistics: false,
      autofocus: false,
      frontMatter: true,
      toolbarItems: createToolbarItems(),
      events: {
        change: function () {
          scheduleAutosave();
          schedulePreviewRendering();
        },
        load: function () {
          syncEditorTheme();
          schedulePreviewRendering();
        },
      },
    };

    if (isDarkMode()) {
      options.theme = "dark";
    }

    initializeMermaid();
    editor = new window.toastui.Editor(options);
    bindControls();
    updateTargetPath();
    renderDiagramLibrary();
    elements.restoreDraft.disabled = !savedDraft;
    root.hidden = false;

    if (savedDraft) {
      setSaveStatus(
        "Lokaler Entwurf vom " + formatTime(savedDraft.updatedAt) + " geladen.",
        "saved"
      );
    } else {
      setSaveStatus(
        "Bereit. Änderungen werden automatisch in diesem Browser gespeichert.",
        "idle"
      );
    }

    previewObserver = new MutationObserver(schedulePreviewRendering);
    previewObserver.observe(elements.editorHost, {
      childList: true,
      subtree: true,
    });

    const themeObserver = new MutationObserver(function () {
      syncEditorTheme();
      schedulePreviewRendering();
    });
    themeObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-md-color-scheme"],
    });

    schedulePreviewRendering();
  }

  function waitForToastEditor(root, attempt) {
    if (
      window.toastui &&
      typeof window.toastui.Editor === "function"
    ) {
      initializeEditor(root);
      return;
    }

    if (attempt >= 80) {
      showDependencyError(root);
      return;
    }

    window.setTimeout(function () {
      waitForToastEditor(root, attempt + 1);
    }, 100);
  }

  function boot() {
    const root = byId("knowledge-editor-app");

    if (!root || root.dataset.keInitialized === "true") {
      return;
    }

    waitForToastEditor(root, 0);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  if (window.document$ && typeof window.document$.subscribe === "function") {
    window.document$.subscribe(boot);
  }
})();
