export const zh = {
  meta: {
    title: "豆织工坊",
    description: "对着拼豆图纸跟绘制代理说话。在对话里附上参考照片，或直接说想画什么，再用手工工具继续改网格。"
  },
  languageSwitcher: {
    ariaLabel: "语言",
    english: "English",
    chinese: "中文"
  },
  dialog: {
    close: "关闭"
  },
  header: {
    logoAlt: "豆织工坊标志",
    openLibrary: "已保存图纸"
  },
  status: {
    emptyCellEyedropper: "该格为空，没有可吸取的拼豆颜色。",
    noUndo: "没有可撤销的编辑。",
    noRedo: "没有可重做的编辑。",
    librarySaveFailed: "无法将图纸写入浏览器存储。请在图库中把重要图纸导出为文件。",
    patternImportInvalid: "该文件不是有效的豆织工坊图纸导出。",
    patternImported: "图纸文件已加入本地库。",
    exportPngFailed: "PNG 导出失败。"
  },
  chat: {
    placeholder: "想画什么？",
    emptyHint: "对话",
    messages: "对话记录",
    scrollToEnd: "跳到最新",
    needApiKey: "在设置里填入 API 密钥后即可与代理对话。",
    attachImage: "附加参考照片",
    removeImage: "移除",
    send: "发送",
    stop: "停止",
    thinking: "思考中",
    drawThis: "把这张图画到图纸上。",
    turnFailed: "代理未能完成这一轮。",
    corsBlocked: "浏览器拦下了这次请求（跨域 CORS）。这个接口不允许网页直接调用。",
    turnAborted: "代理运行被中断。",
    toolRunning: "运行中",
    toolDone: "完成",
    toolError: "出错",
    toolArguments: "参数",
    toolResult: "结果",
    toolPreview: "预览",
    toolPreviewAlt: "代理看到的棋盘预览",
    hidePanel: "收起对话",
    showPanel: "打开对话"
  },
  settings: {
    open: "设置",
    title: "设置",
    description: "只保存在本浏览器。",
    language: "语言",
    agent: "绘制代理",
    agentDescription: "没有密钥也可以继续画图纸。只在需要对话时填写。",
    baseURL: "接口地址",
    model: "模型",
    apiKey: "API 密钥",
    save: "保存"
  },
  sizeChip: {
    aria: "图纸尺寸",
    width: "宽",
    height: "高"
  },
  welcome: {
    title: "新建图纸",
    description: "选择拼豆网格尺寸。宽和高互不影响。若要代理对照照片，稍后再在对话里附上参考图。",
    createBlank: "创建空白图纸",
    cancel: "回到图纸"
  },
  workspace: {
    tools: {
      pencil: "铅笔",
      eraser: "橡皮",
      eyedropper: "吸管",
      paintBucket: "油漆桶",
      hand: "抓手",
      line: "直线"
    },
    editorToolsAside: "编辑工具",
    magnificationControls: "缩放控制",
    zoomOut: "缩小",
    zoomIn: "放大",
    zoomOutTooltip: "缩小图纸预览（格子更粗，同屏可见范围更大）。",
    zoomInTooltip: "放大图纸预览（格子更细）。",
    chartZoom: "图纸缩放",
    editableBeadPattern: "可编辑的拼豆图纸",
    paletteAside: "调色板",
    openPalette: "打开调色板",
    openPaletteTooltip: "调色板和图纸中出现的颜色。",
    dismissPalette: "关闭调色板",
    paletteDialog: "调色板"
  },
  sidePanels: {
    legendAria: "图例色块",
    usedInChart: "图纸中使用",
    undo: "撤销",
    redo: "重做",
    legendSelect: "选择 {{code}}，图纸中共 {{count}} 颗",
    legendReplace: "用当前颜色 {{activeColor}} 替换 {{fromCode}}",
    legendReplaceTitle: "将 {{fromCode}} 替换为 {{activeColor}}",
    legendDelete: "从图纸中删除 {{fromCode}}",
    legendDeleteTitle: "删除 {{fromCode}}",
    undoTooltip: "后退一步修改。",
    redoTooltip: "在撤销之后重放下一步修改。"
  },
  library: {
    dialogTitle: "图纸库",
    dialogDescription: "在本浏览器中管理图纸：打开已有图纸、导出图片，或下载可编辑的 JSON 图纸以便迁移或分享。",
    searchLabel: "搜索",
    searchPlaceholder: "按标题搜索",
    sortLabel: "排序",
    sortUpdated: "最近更新",
    sortCreated: "最近创建",
    sortTitle: "标题 A–Z",
    emptyFiltered: "没有匹配的图纸。",
    metaLine: "更新 {{updated}} · 创建 {{created}}",
    renameAria: "重命名 {{title}}",
    open: "打开",
    duplicate: "复制",
    exportPng: "导出图片",
    exportImageHint: "导出这张图纸的图片。",
    exportJson: "导出图纸文件",
    exportFileHint: "下载可在本应用再次打开的 JSON 图纸。",
    delete: "删除",
    confirmDelete: "确定从本浏览器删除该图纸？",
    importJson: "导入图纸文件",
    importSavedHint: "选择此前从此应用导出的 JSON 图纸。",
    newChart: "新建图纸",
    done: "完成",
    defaultTitle: "未命名图纸",
    importedTitle: "导入的图纸",
    duplicatedTitleSuffix: "副本"
  },
  defaultPalette: {
    sectionLabel: "调色板",
    heading: "调色板",
    firstInGroup: "分组中首个：{{code}}",
    selectColor: "选择调色板颜色 {{code}}"
  }
} as const;
