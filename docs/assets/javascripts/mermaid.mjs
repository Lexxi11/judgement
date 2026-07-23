import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";

// Material for MkDocs erwartet Mermaid für seine native Diagramm-Integration
// am globalen window-Objekt. Der Editor nutzt dieselbe Instanz für die
// dynamische TOAST-UI-Vorschau.
window.mermaid = mermaid;
window.dispatchEvent(new CustomEvent("judgement:mermaid-ready"));
