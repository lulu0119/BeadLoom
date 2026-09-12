export const en = {
  meta: {
    title: "BeadLoom",
    description:
      "Talk to a drawing agent on a bead chart. Attach a reference photo in chat or type what to draw, then keep editing the grid by hand."
  },
  languageSwitcher: {
    ariaLabel: "Language",
    english: "English",
    chinese: "中文"
  },
  dialog: {
    close: "Close"
  },
  header: {
    logoAlt: "BeadLoom logo",
    openLibrary: "Saved charts"
  },
  status: {
    emptyCellEyedropper: "That cell is empty—no bead color to pick.",
    noUndo: "No edits to undo.",
    noRedo: "No edits to redo.",
    librarySaveFailed: "Could not write patterns to browser storage. Export important charts as a file from the library.",
    patternImportInvalid: "That file is not a valid BeadLoom chart export.",
    patternImported: "Chart file added to your library.",
    exportPngFailed: "PNG export failed."
  },
  chat: {
    placeholder: "What should we draw?",
    emptyHint: "Chat",
    messages: "Chat messages",
    scrollToEnd: "Scroll to latest",
    needApiKey: "Add an API key in settings to talk to the agent.",
    attachImage: "Attach a photo",
    removeImage: "Remove",
    send: "Send",
    stop: "Stop",
    thinking: "Thinking",
    drawThis: "Draw this on the board.",
    turnFailed: "The agent could not finish that turn.",
    corsBlocked: "The browser blocked this request (CORS). This API does not allow calls from a web page.",
    turnAborted: "The agent run was interrupted.",
    toolRunning: "Running",
    toolDone: "Done",
    toolError: "Error",
    toolArguments: "Arguments",
    toolResult: "Result",
    toolPreview: "Preview",
    toolPreviewAlt: "Board preview seen by the agent",
    hidePanel: "Hide chat",
    showPanel: "Show chat"
  },
  settings: {
    open: "Settings",
    title: "Settings",
    description: "These stay in this browser.",
    language: "Language",
    agent: "Drawing agent",
    agentDescription: "The board works without a key. Add one only when you want to chat.",
    baseURL: "Base URL",
    model: "Model",
    apiKey: "API key",
    save: "Save"
  },
  sizeChip: {
    aria: "Chart size",
    width: "Width",
    height: "Height"
  },
  welcome: {
    title: "New chart",
    description: "Choose the bead grid size. Width and height are independent. Attach a reference photo later in chat if the agent should look at one.",
    createBlank: "Create blank chart",
    cancel: "Back to chart"
  },
  workspace: {
    tools: {
      pencil: "Pencil",
      eraser: "Eraser",
      eyedropper: "Eyedropper",
      paintBucket: "Paint bucket",
      hand: "Hand",
      line: "Line"
    },
    editorToolsAside: "Editor tools",
    magnificationControls: "Magnification controls",
    zoomOut: "Zoom out",
    zoomIn: "Zoom in",
    zoomOutTooltip: "Shrink the chart preview (coarser cells, more area visible).",
    zoomInTooltip: "Enlarge the chart preview (finer cells).",
    chartZoom: "Chart zoom",
    editableBeadPattern: "Editable bead pattern",
    paletteAside: "Palette",
    openPalette: "Open palette",
    openPaletteTooltip: "Palette and colors used in the chart.",
    dismissPalette: "Dismiss palette",
    paletteDialog: "Palette"
  },
  sidePanels: {
    legendAria: "Legend badges",
    usedInChart: "Used in chart",
    undo: "Undo",
    redo: "Redo",
    legendSelect: "Select {{code}}, {{count}} beads in chart",
    legendReplace: "Replace {{fromCode}} with active color {{activeColor}}",
    legendReplaceTitle: "Replace {{fromCode}} with {{activeColor}}",
    legendDelete: "Delete {{fromCode}} from pattern",
    legendDeleteTitle: "Delete {{fromCode}}",
    undoTooltip: "Step back one edit.",
    redoTooltip: "Replay the next edit after an undo."
  },
  library: {
    dialogTitle: "Pattern library",
    dialogDescription:
      "Work with charts in this browser: open them, export a picture, or download an editable JSON file to move or share.",
    searchLabel: "Search",
    searchPlaceholder: "Search by title",
    sortLabel: "Sort",
    sortUpdated: "Recently updated",
    sortCreated: "Recently created",
    sortTitle: "Title A–Z",
    emptyFiltered: "No patterns match your search.",
    metaLine: "Updated {{updated}} · Created {{created}}",
    renameAria: "Rename {{title}}",
    open: "Open",
    duplicate: "Duplicate",
    exportPng: "Export image",
    exportImageHint: "Export a picture of this chart.",
    exportJson: "Export chart file",
    exportFileHint: "Download a BeadLoom JSON chart you can open again here.",
    delete: "Delete",
    confirmDelete: "Delete this pattern from this browser?",
    importJson: "Import chart file",
    importSavedHint: "Choose a BeadLoom JSON chart exported from this app.",
    newChart: "New chart",
    done: "Done",
    defaultTitle: "Untitled pattern",
    importedTitle: "Imported chart",
    duplicatedTitleSuffix: "copy"
  },
  defaultPalette: {
    sectionLabel: "Palette",
    heading: "Palette",
    firstInGroup: "First in group: {{code}}",
    selectColor: "Select palette color {{code}}"
  }
} as const;
