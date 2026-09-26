import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const contributions = fileURLToPath(new URL('../contributions/', import.meta.url))

function pack(id, locale) {
  const path = `${contributions}/${id}/${locale}.json`
  return JSON.parse(readFileSync(path, 'utf8'))
}

function assertDomTranslations(id, locale, selector, sources) {
  const value = pack(id, locale)
  for (const source of sources) {
    assert.ok(
      value.dom?.some((entry) => entry.selector === selector && entry.source === source && entry.target),
      `${id}/${locale} is missing ${JSON.stringify(source)} under ${selector}`,
    )
  }
}

function assertDomTranslationTarget(id, locale, selector, source, target) {
  const value = pack(id, locale)
  const entry = value.dom?.find((item) => item.selector === selector && item.source === source)
  assert.equal(entry?.target, target, `${id}/${locale} translation for ${JSON.stringify(source)} should be exact`)
}

function assertNamespaceTranslations(id, locale, namespace, keys) {
  const value = pack(id, locale)
  for (const key of keys) {
    assert.ok(value.namespaces?.[namespace]?.[key], `${id}/${locale} is missing ${namespace}.${key}`)
  }
}

test('all screenshot-visible MCP filter options have English and Russian labels', () => {
  const sources = ['全部传输', '全部状态', '已连接', '失败', '已禁用']
  assertDomTranslations('dsh-mcp-manager-ui', 'en', '.dsh-mcp-panel-overlay', sources)
  assertDomTranslations('dsh-mcp-manager-ui', 'ru', '.dsh-mcp-panel-overlay', sources)
})

test('pet widget, pet selector, usage card, and usage page cover screenshot text', () => {
  const pet = [
    '亲密度', '亲密度 {rank}', '小鱼干 ×{n}', '{points}点', '{points} 点', '喂食', '改名', '隐藏',
    '等待模型响应', '点击跳转到对应会话', '幼鲸', '伙伴', '挚友', '深海羁绊', '心有灵犀',
    '传说羁绊', '神话羁绊', '永恒之契', '鲸生共渡', '鲸鱼娘', '鲸鱼娘（原版）',
  ]
  assertDomTranslations('@linxin666/dsh-pet', 'en', '[data-dsh-pet-root]', pet)
  assertDomTranslations('@linxin666/dsh-pet', 'ru', '[data-dsh-pet-root]', pet)
  for (const locale of ['en', 'ru']) assert.equal(pack('@linxin666/dsh-pet', locale).sourceLocale, 'zh')
  assertDomTranslations('@linxin666/dsh-pet', 'en', '#settings-pet-pet', ['鲸鱼娘（原版）'])
  assertDomTranslations('@linxin666/dsh-pet', 'ru', '#settings-pet-pet', ['鲸鱼娘（原版）'])
  assertDomTranslations('@linxin666/dsh-pet', 'en', '#settings-pet-pet', ['蓝喉蜂虎', 'OUO Neko', '鲸鱼娘（精致版）'])
  assertDomTranslations('@linxin666/dsh-pet', 'ru', '#settings-pet-pet', ['蓝喉蜂虎', 'OUO Neko', '鲸鱼娘（精致版）'])
  assertNamespaceTranslations('@linxin666/dsh-pet', 'ru', 'pet', [
    'pet.openSessionHint', 'pet.rank.name.幼鲸', 'pet.rank.name.伙伴', 'pet.rank.name.挚友',
    'pet.rank.name.深海羁绊', 'pet.rank.name.心有灵犀', 'pet.rank.name.传说羁绊',
    'pet.rank.name.神话羁绊', 'pet.rank.name.永恒之契', 'pet.rank.name.鲸生共渡',
    'settings.decorationHint', 'settings.visibleHint', 'settings.sizeHint', 'settings.bubbleScale',
    'settings.bubbleScaleHint', 'settings.rightHint', 'settings.bottomHint', 'settings.inherit',
    'settings.on', 'settings.off', 'settings.diagnosticsTitle', 'settings.overridden', 'settings.reset',
    'settings.notExposed', 'settings.readOnly', 'settings.expand', 'settings.collapse', 'settings.unsaved',
    'settings.saveFailed', 'settings.invalidNumber',
  ])
  assertDomTranslationTarget('@linxin666/dsh-pet', 'ru', '[data-dsh-pet-root]', '等待模型响应', 'Ожидание ответа модели')
  assertDomTranslationTarget('@linxin666/dsh-pet', 'en', '[data-dsh-pet-root]', '点击跳转到对应会话', 'Click to jump to this session')
  assertDomTranslationTarget('@linxin666/dsh-pet', 'ru', '[data-dsh-pet-root]', '{points} 点', 'Баллы: {points}')

  const usage = [
    '今日消费', '今日暂无用量', '更新于 {time}', '今日用量', '个人套餐', 'Token 银行',
    '没有已配置的提供方', '近 30 天', '暂无用量数据（统计自插件启用起）', '轮询间隔（秒）',
    '当前', '总 tokens', '输入', '输出', '缓存读', '缓存写',
  ]
  assertDomTranslations('@linxin666/dsh-web-all', 'en', '[data-dsh-plugin="usage"]', usage)
  assertDomTranslations('@linxin666/dsh-web-all', 'ru', '[data-dsh-plugin="usage"]', usage)
})

test('pet settings copy accurately describes decorations, text scaling, and viewport in both locales', () => {
  const en = pack('@linxin666/dsh-pet', 'en').namespaces.pet
  const ru = pack('@linxin666/dsh-pet', 'ru').namespaces.pet
  assert.equal(en['settings.petHint'], 'Choose which pet to display. Each pet keeps its own name; you can rename it from the pet hover panel.')
  assert.equal(ru['settings.petHint'], 'Выберите, какого питомца показывать. Имя задаётся отдельно для каждого питомца; изменить его можно во всплывающей панели питомца.')
  assert.equal(ru['settings.decorationHint'], 'Показывать в пузырях статуса питомца декоративные элементы — например, кита, выпускающего фонтан воды. Если выключить, в пузырях останется только текст.')
  assert.equal(ru['settings.bubbleScaleHint'], 'Текст в пузырях статуса, реплик и расхода токенов автоматически масштабируется вместе с питомцем. Этот коэффициент дополнительно меняет его масштаб (0,5–2; по умолчанию 1). Размер текста — от 10 до 24 пикселей.')
  assert.equal(ru['settings.rightHint'], 'Отступ по горизонтали от правого края области просмотра.')
  assert.equal(ru['settings.bottomHint'], 'Отступ по вертикали от нижнего края области просмотра.')
})

test('archive and model-capability labels visible in screenshots have both locales', () => {
  const archive = ['会话归档管理', '共 {n} 条会话', '全部', '未归档', '已归档', '全部工作区', '搜索标题或会话 ID', '最新优先', '仅看异常会话', '全选当前结果', '清空选择', '已选 {n} 项', '批量归档', '批量取消归档', '批量删除', '普通', '最后活动：{time}', '归档时间：未知', '大小：{size}', '预览', '取消归档', '删除', '（无标题）']
  assertDomTranslations('@linxin666/dsh-web-all', 'en', '[data-dsh-plugin="session-archive"]', archive)
  assertDomTranslations('@linxin666/dsh-web-all', 'ru', '[data-dsh-plugin="session-archive"]', archive)
  assertDomTranslations('@linxin666/dsh-client-ui-model-capabilities', 'en', '[data-dsh-plugin="model-capabilities"]', ['模型能力'])
  assertDomTranslations('@linxin666/dsh-client-ui-model-capabilities', 'ru', '[data-dsh-plugin="model-capabilities"]', ['模型能力'])
})

test('desktop, plugin-manager, and auxiliary-model settings translate their visible controls', () => {
  assertNamespaceTranslations('@deepseek-ai/dsh-client-ui-trajectory', 'ru', 'trajectory', ['view.trajectory', 'toolbar.aria', 'toolbar.duration', 'toolbar.calls'])
  assertDomTranslations('@deepseek-ai/dsh-client-ui-trajectory', 'ru', '[data-conversation-tabs]', ['Trajectory'])
  const bundledMarket = JSON.parse(readFileSync(new URL('../lib/locales/plugins/54-workshop-market.json', import.meta.url), 'utf8'))
  assert.equal(bundledMarket['dsh-web-ui-market']['settings.title'], 'Витрина сообщества')
  assert.ok(bundledMarket['dsh-web-ui-market']['tab.skin'])
  for (const namespace of ['@dsh-external/dsh-plugin-workshop', 'dsh-plugin-workshop']) {
    assert.equal(bundledMarket[namespace]['settings.title'], 'Мастерская плагинов')
    assert.equal(bundledMarket[namespace].title, 'Мастерская плагинов')
  }
  assertNamespaceTranslations('@linxin666/dsh-web-all', 'ru', 'dsh-web-ui-market', ['tab.preset', 'filter.category', 'category.tools', 'subcategory.browser', 'installs'])
  const usageAccessibility = ['打开使用统计设置', '收起用量卡片', '展开用量卡片']
  assertDomTranslations('@linxin666/dsh-web-all', 'en', '[data-dsh-plugin="usage"]', usageAccessibility)
  assertDomTranslations('@linxin666/dsh-web-all', 'ru', '[data-dsh-plugin="usage"]', usageAccessibility)
  assertNamespaceTranslations('dsh-plugin-desktop', 'ru', 'desktop.settings', [
    'nav', 'title', 'intro', 'exportDiagnostics', 'openTerminal', 'restartDesktop', 'profileTitle',
    'profileIntro', 'profileReady', 'activeProfile', 'profileName', 'profileNamePlaceholder', 'create',
    'marketTitle', 'marketIntro', 'marketDisabled', 'marketDisabledBody', 'communityMarketBody', 'dshMarketBody',
    'selected', 'beta', 'aaIntro',
  ])
  assertDomTranslations('dsh-plugin-desktop', 'ru', '.zOa2rq_navCell', ['Auxiliary Models', '插件管理', 'Workshop'])
  assertNamespaceTranslations('@linxin666/dsh-client-ui-plugin-manager', 'ru', 'settings.pluginManager', ['tab'])
  assertNamespaceTranslations('@dsh-plugin/dsh-auxiliary', 'ru', 'dsh-auxiliary', [
    'nav', 'intro', 'catalogFailure', 'visionTitle', 'visionDescription', 'visionToggle', 'visionPickerLabel',
    'visionHandoff', 'visionSkipWhenImageCapable', 'visionUsage', 'compactTitle', 'compactDescription', 'compactToggle',
  ])
  assertDomTranslations('@dsh-plugin/dsh-auxiliary', 'ru', 'p[role="alert"]', [
    '{provider} ({id}): model "{model}" declares native image input, so its "{alias}" entry no longer applies. Select the same model from the provider group without "{alias}".',
  ])
})

test('new screenshots: MCP import, usage/archive controls, model capability and skin-center labels are bilingual', () => {
  const mcp = [
    '从本机客户端导入全局配置（只读，不修改它们的文件）',
    '从本机客户端导入项目级配置（只读，不修改它们的文件）',
    '{n} 个 MCP：{names}',
    '含需掩码字段：{fields}（导入后在详情页可用眼睛查看）',
    '{n} 条提示，导入时逐条列出',
    '替换当前 Profile',
  ]
  for (const locale of ['en', 'ru']) {
    assertDomTranslations('dsh-mcp-manager-ui', locale, '.dsh-mcp-overlay', mcp)
    assertDomTranslations('dsh-mcp-manager-ui', locale, '.dsh-mcp-entry', ['入口'])
  }

  const usage = [
    '鲸元券',
    '暂无 DeepSeek 官方用量数据（统计自插件启用起）',
    '暂无 DeepSeek 官方用量数据（统计自插件Включить起）',
    '{tokens} tokens · {n} calls',
    '{tokens} tokens · {n} 次调用',
    '{tokens} tokens · Вызовов: {n}',
    '没有已配置的套餐类 provider（如 Kimi、GLM、OpenCode Go、MiniMax、Codex 订阅）',
  ]
  const archive = [
    '最后活动时间', '归档时间', '创建时间', '标题', '最早优先',
    '不属于任何工作区', '{n} 个子会话',
  ]
  for (const locale of ['en', 'ru']) {
    assertDomTranslations('@linxin666/dsh-web-all', locale, '[data-dsh-plugin="usage"]', usage)
    assertDomTranslations('@linxin666/dsh-web-all', locale, '[data-dsh-plugin="session-archive"]', archive)
    assertDomTranslations('dsh-plugin-desktop', locale, '.zOa2rq_navCell', ['Skin Center'])
  }

  for (const locale of ['en', 'ru']) {
  assertNamespaceTranslations('@linxin666/dsh-client-ui-model-capabilities', locale, 'model-caps', [
      'caps.hint', 'caps.save', 'caps.discard',
    ])
    assertDomTranslations('@linxin666/dsh-client-ui-model-capabilities', locale, '[data-dsh-plugin="model-capabilities"]', [
      '为目录里的每个模型声明推理档位，保存写入设置文档并立即生效。', '重置', '保存',
    ])
  }
  assertNamespaceTranslations('@linxin666/dsh-client-ui-skin-center', 'ru', 'skinCenter', ['uninstall'])
  assertNamespaceTranslations('@linxin666/dsh-client-ui-skin-center', 'en', 'skinCenter', ['uninstall'])
  for (const locale of ['en', 'ru']) {
    assertDomTranslations('@linxin666/dsh-client-ui-skin-center', locale, '.TJMolG_card', [
      'Blue Fantasy', 'Harbor', '鲸鱼插画背景 · periwinkle 靛蓝调色板 · 半透明面板',
      '暮光蓝港 · 日落橙辉 · 半透明夜色面板',
    ])
  }
})

test('MCP add and built-in dialogs cover the exact untranslated screenshot strings', () => {
  const importSources = [
    '从本机客户端Import全局配置（只读，不修改它们的文件）',
    '{n} 个 MCP: {names}',
    '含需掩码字段: {fields} (Import 后在详情页可用眼睛查看)',
    '{n} 条提示，Import时逐条列出',
    '替换当前 Profile',
  ]
  const addFormSources = [
    '从预设模板快速填充（可选，命令需本机 npx/uvx）',
    '传输类型',
    '运行策略',
    '环境变量（可选，值写 !!js process.env.KEY 引用密钥）',
  ]
  const builtInSources = [
    '{configured} 已配置 · {available} 可安装',
    '安装选中（{n}）',
    '网页搜索、代码搜索与页面内容读取',
    '免密额度，可添加 API Key 提升额度',
    '面向 Agent 的网页搜索与内容提取',
    '免密额度（Search / Extract）；可切换免费账号 API Key',
    '网页搜索、抓取与文档解析',
    '免密额度（Search / Scrape / Parse）；可添加 API Key',
    '浏览器调试、网络与性能分析',
    '本地 npx / Node.js / Chrome',
    '基于可访问性快照的浏览器自动化',
    '本地 npx / Node.js 20+',
  ]
  const modes = ['悬浮按钮 + 侧栏入口', '仅悬浮按钮', '仅侧栏入口']
  for (const locale of ['en', 'ru']) {
    assertDomTranslations('dsh-mcp-manager-ui', locale, '.dsh-mcp-overlay', importSources)
    assertDomTranslations('dsh-mcp-manager-ui', locale, '.dsh-mcp-overlay', addFormSources)
    assertDomTranslations('dsh-mcp-manager-ui', locale, '.dsh-mcp-overlay', builtInSources)
    assertDomTranslations('dsh-mcp-manager-ui', locale, '.dsh-mcp-panel-overlay', addFormSources)
    assertDomTranslations('dsh-mcp-manager-ui', locale, '.dsh-mcp-panel-overlay', builtInSources)
    assertDomTranslations('dsh-mcp-manager-ui', locale, '.dsh-mcp-overlay', modes)
    assertDomTranslations('dsh-mcp-manager-ui', locale, '.dsh-mcp-panel-overlay', modes)
  }
})

test('plugin manager cards translate screenshot-visible headings, names, and manifest descriptions', () => {
  const cardSources = [
    'Official', 'Installed', 'Официальные', 'Установленные',
    'Agent Teams', 'Enable team collaboration, team tools, the member roster, and the shared task board.',
    'Beta', 'Voice input', 'Transcribe recordings locally with SenseVoice; first use requires installing dependencies',
    'Russian language', 'Переводы интерфейса DSH и плагинов',
    'Цикл агента', 'Управление диспетчеризацией вызовов инструментов агентом.',
    'Субагент', 'Настройка глубины рекурсии, количества и моделей субагентов.',
    'Веб-поиск', 'Настройка поискового провайдера DeepSeek.',
    "Automated approval review for DeepSeek Harness: auto-approves safe tools, auto-denies dangerous command patterns, and can fully auto-approve in 'auto' mode. · DSH 自动审批审核插件：安全操作自动放行、危险命令自动拒绝、可配置全自动模式。",
    'Opt-in DeepSeek Harness Skill-only bundle for the Archify architecture-diagram skill.',
    'DeepSeek Harness plugin that uses configured model providers for image analysis and context compaction.',
    'DeepSeek Harness tool plugin that exposes BrowserSkill browser automation (browser_* tools) to the model',
    'Context (dsh-context)',
    'A DeepSeek Harness plugin for context insight and management, with context dashboard and context command, for understanding how the context is made of, and how it evolves.',
    'Visual plugin market inside DeepSeek Harness — browse, search, and one-click install community plugins. · DSH 可视化插件市场：逛一逛，点一下，装好。',
    'Find DeepSeek Harness plugins inside the agent — live GitHub dsh-plugin topic search, ranked by stars.',
    'GenUI for DeepSeek Harness: interactive UI components rendered inline in assistant replies via the ```dsh-ui fence — layout, charts, plots, forms, quizzes, mermaid, 3D scenes, and an action event loop back to the model. Ships the fence-teaching host plugin, the browser renderer (client half), and the genui skill.',
    'Reflect-only Hindsight long-term memory for coding agents (harness-pluggable: opencode, …), with automatic background ingestion (no setup CLI).',
    'Runtime compatibility shim for dsh (DeepSeek Harness) cordis bundle plugins: decouples third-party plugins from real dsh internal service names, module paths, and RPC details via a version-aware adapter registry.',
    'OpenViking memory and context bundle for DeepSeek Harness',
    'Plug-in vision for text-only LLMs, powered by the free Antigravity CLI',
    'Community-extensible translations for DeepSeek Harness core and plugins, with safe scoped adapters for UI that has no locale API.',
    'DSH 能力插件:服务器卡片仪表盘——实时状态/CPU/内存/磁盘 + 趋势记录与可视化(1h/24h/7d/30d) + 点卡片进入 xterm 交互终端',
    'dsh-routing-suite 分发入口：DSH 超级模组注入器（BepInEx 式运行时注入，免重启）+ router-standard 预设仓库。插件入口为 injector/，预设位于 preset/。',
    'A DSH port of obra/superpowers — the full multi-agent software-development methodology (TDD, planning, debugging, review) as native DSH skills',
    'External dsh web GUI plugin: a blank-session git branch selector + Git graph, with real host-side git operations and guards, as a dsh profile bundle',
    'DSH skill center: browse loaded skills by source (bundled / project / user / custom / runtime), enable or disable, create and delete, in a web GUI panel.',
    'Host-authoritative task board for the DSH Web GUI with real session execution, Host cron scheduling, and optional cross-platform idle-sleep protection; mounted without DSH source changes.',
    'DSH Web UI 全家桶聚合插件：一键安装全部功能插件（task-board / git-graph / pet / remote-web-ui / web-ui-settings / skin-center / community-plugins / compat shim）。compat 桥接层已并入本包（src/client），无需独立 compat npm 包。',
    'WeKnora knowledge retrieval tools for DeepSeek Harness (dsh): semantic search, document reading and RAG/agent answers over your own knowledge bases.',
  ]
  for (const locale of ['en', 'ru']) {
    assertDomTranslations('@linxin666/dsh-client-ui-plugin-manager', locale, 'section[data-plugin-panel]', cardSources)
  }
  assertDomTranslationTarget('@linxin666/dsh-client-ui-plugin-manager', 'ru', 'section[data-plugin-panel]', 'Agent Teams', 'Команды агентов')
  assertDomTranslationTarget('@linxin666/dsh-client-ui-plugin-manager', 'ru', 'section[data-plugin-panel]', 'Beta', 'Бета')
  assertDomTranslationTarget('@linxin666/dsh-client-ui-plugin-manager', 'ru', 'section[data-plugin-panel]', 'Russian language', 'Русский язык')
  assertDomTranslationTarget('@linxin666/dsh-client-ui-plugin-manager', 'ru', 'section[data-plugin-panel]', 'Voice input', 'Голосовой ввод')
  assertDomTranslationTarget('@linxin666/dsh-client-ui-plugin-manager', 'ru', 'section[data-plugin-panel]', 'OpenViking memory and context bundle for DeepSeek Harness', 'Пакет памяти и контекста OpenViking для DeepSeek Harness.')
  for (const locale of ['en', 'ru']) {
    const value = pack('@linxin666/dsh-client-ui-plugin-manager', locale)
    assert.ok(value.dom?.some((entry) => entry.selector === 'section[data-plugin-panel]' && entry.source === 'dsh-routing-suite 分发入口：DSH 超级模组注入器（BepInEx 式运行时注入，免重启）+ router-standard 预设仓库。插件入口为 injector/，预设位于 preset/。'))
  }
})

test('Skin Center has a complete 121-key English and Russian namespace, not only card labels', () => {
  const visible = [
    'title', 'cardDescription', 'enabled', 'enabledHint', 'intro', 'official', 'officialTagline',
    'active', 'tryingOn', 'tryOn', 'exitTryOn', 'apply', 'restore', 'theme', 'themeLight', 'themeDark',
    'verifyIntegrity', 'backgroundOpacity', 'backgroundHint', 'backgroundBlurEmpty', 'backgroundBlurContent',
    'backgroundBlurHint', 'inputCardBlur', 'inputCardBlurHint', 'bubbleOpacity', 'bubbleOpacityHint',
    'bubbleBlur', 'bubbleBlurHint', 'wallpaperTitle', 'wallpaperEnable', 'wallpaperHint',
    'wallpaperLibraryManual', 'wallpaperEmpty', 'wallpaperDirs', 'wallpaperDirsEmpty', 'wallpaperDirsHint',
    'customThemeTitle', 'customThemeTagline', 'customThemeEdit', 'uninstall',
  ]
  for (const locale of ['en', 'ru']) {
    const value = pack('@linxin666/dsh-client-ui-skin-center', locale)
    assert.equal(Object.keys(value.namespaces?.skinCenter ?? {}).length, 121)
    assert.equal(Object.keys(value.source?.skinCenter ?? {}).length, 121)
    for (const [key, target] of Object.entries(value.namespaces.skinCenter)) {
      assert.doesNotMatch(target, /[\u3400-\u9fff]/, `Skin Center ${locale}.${key} still contains Chinese text`)
    }
    assertNamespaceTranslations('@linxin666/dsh-client-ui-skin-center', locale, 'skinCenter', visible)
  }
})

test('new screenshots: DSH Desktop and auxiliary settings have complete screenshot copy in Russian', () => {
  for (const locale of ['en', 'ru']) {
    const desktop = pack('dsh-plugin-desktop', locale)
    assert.equal(Object.keys(desktop.namespaces?.['desktop.settings'] ?? {}).length, 119)
    assert.equal(Object.keys(desktop.source?.['desktop.settings'] ?? {}).length, 119)
  }
  assertNamespaceTranslations('dsh-plugin-desktop', 'ru', 'desktop.settings', [
    'remoteControl', 'aaDisabled', 'aaEnabled', 'updatesTitle', 'updatesIntro', 'currentVersion',
    'checkForUpdates', 'presentationTitle', 'presentationIntro', 'compatibilityMode',
    'compatibilityModeBody', 'extendedMode', 'extendedModeBody', 'advancedMode', 'advancedModeBody',
    'windowMaterial', 'windowMaterialOff', 'windowMaterialTransparent', 'webTitle', 'webIntro',
    'openBrowser', 'lanAccess', 'lanStatus', 'lanHttpsUrls', 'lanTrustNotice', 'lanCaFingerprint',
    'notificationsTitle', 'notificationsIntro', 'notificationsEnabled', 'turnCompletion', 'turnFailure',
    'jobCompletion', 'jobFailure',
  ])
  assertNamespaceTranslations('dsh-plugin-desktop', 'en', 'desktop.settings', [
    'remoteControl', 'aaDisabled', 'aaEnabled', 'updatesTitle', 'updatesIntro', 'currentVersion',
    'checkForUpdates', 'presentationTitle', 'presentationIntro', 'compatibilityMode',
    'compatibilityModeBody', 'extendedMode', 'extendedModeBody', 'advancedMode', 'advancedModeBody',
    'windowMaterial', 'windowMaterialOff', 'windowMaterialTransparent', 'webTitle', 'webIntro',
    'openBrowser', 'lanAccess', 'lanStatus', 'lanHttpsUrls', 'lanTrustNotice', 'lanCaFingerprint',
    'notificationsTitle', 'notificationsIntro', 'notificationsEnabled', 'turnCompletion', 'turnFailure',
    'jobCompletion', 'jobFailure',
  ])
  assertNamespaceTranslations('@dsh-plugin/dsh-auxiliary', 'ru', 'dsh-auxiliary', [
    'subagentTitle', 'subagentDescription', 'subagentToggle', 'subagentPickerLabel', 'subagentUsage',
    'titleTitle', 'titleDescription', 'titleToggle', 'titlePickerLabel', 'titleUsage',
    'imagegenTitle', 'imagegenDescription', 'imagegenToggle', 'imagegenPickerLabel', 'imagegenUsage',
    'imagegenNoModels', 'compactPickerLabel', 'compactUsage', 'compactThresholdLabel', 'compactThresholdHint',
    'approveTitle', 'approveDescription', 'approveToggle', 'approvePickerLabel', 'approveUsage',
    'approveNotInstalled', 'pickerPlaceholder', 'pickerEmpty', 'pickerUnavailable', 'pickerListLabel',
  ])
  const auxiliarySections = {
    subagent: ['Subagent model', 'Set a dedicated model route for delegated child agents.', 'Enable subagent model', 'When enabled, every delegated child (one-shot spawn/fork runs and continuable children) uses the selected model instead of inheriting the parent session; in-process cold-resumed children are covered too. Remote providers (ACP) never register a process-local agent and their children keep inheriting the parent route. Prefer a cheap, fast model to control delegation cost.', 'Save'],
    title: ['Title model', 'Set a dedicated model route for session-title generation.', 'Enable title model', 'When enabled, session-title generation calls (purpose: session-title) use the selected model instead of following the main session route. Titles are issued by the dsh-session-title-llm provider; this setting only overrides its model route and leaves its deployment-level config untouched. Prefer a cheap, fast model; titles are generated infrequently, so the cost impact is minimal.', 'Save'],
    imagegen: ['Image-generation model', 'Pick a dedicated model route for auxiliary image generation; only models marked "Allow image generation" on the Models page are offered.', 'Enable auxiliary image generation', 'Image-generation model', 'Choose a provider and model', 'No image-generation model marked yet: check "Allow image generation" under Settings → Models → Provider → Customized settings → Models first.', 'Save'],
    compact: ['控制 `purpose: compaction` 摘要调用是否改用独立的 compact 模型路由。', 'Context compaction', 'Controls whether `purpose: compaction` summaries use the independent compact model route.', 'Enable auxiliary compaction route', 'Compaction model', 'Compaction threshold', 'Compaction triggers when context usage reaches this threshold. Supported range: 17%–99% (must stay above the retention ratio, 16% by default). Saving enables the auxiliary compression engine; if the default compaction plugin is loaded, remove it first so this engine takes over.', 'An enabled feature without a complete provider/model route keeps the existing pass-through behavior. `engine` has no third model picker; when enabled, the compression engine reuses this compact route.', 'Save'],
    approve: ['Approval model', 'Hookup for the @dsh-plugin/dsh-approve-for-me plugin: once that plugin is installed and review mode is active, its approval reviews run on the dedicated model selected here instead of inheriting the session\'s main model.', 'Enable approval-model routing', 'Approval model', 'An enabled feature without a complete provider/model route keeps the original behavior (the reviewer keeps inheriting the session or the plugin\'s own reviewProvider/reviewModel config). Prefer a cheap, fast model; the review verdict only decides approval and never enters the session history.', 'The @dsh-plugin/dsh-approve-for-me plugin was not detected: install and enable it (review mode) first — until then, saving this configuration has no effect.', 'Save'],
  }
  for (const locale of ['en', 'ru']) {
    for (const [feature, sources] of Object.entries(auxiliarySections)) {
      assertDomTranslations('@dsh-plugin/dsh-auxiliary', locale, `section[aria-labelledby="${feature}-title"]`, sources)
    }
  }
})

test('DSH Desktop settings and titlebar translate all locale strings through scoped roots', () => {
  const sources = Object.values(pack('dsh-plugin-desktop', 'en').source?.['desktop.settings'] ?? {})
  assert.equal(sources.length, 119)
  for (const locale of ['en', 'ru']) {
    assertDomTranslations('dsh-plugin-desktop', locale, '.dshDesktopSettings', sources)
    assertDomTranslations('dsh-plugin-desktop', locale, '.dshDesktopFrameTitlebar', [
      'Remote control', 'New feature', 'Compatibility mode',
    ])
    assertDomTranslations('dsh-plugin-desktop', locale, '.dshDesktopModePopover', [
      'Window mode', 'Compatibility mode', 'Extended mode', 'Enhanced mode',
    ])
  }
  assertDomTranslationTarget('dsh-plugin-desktop', 'ru', '.dshDesktopFrameTitlebar', 'Remote control', 'Удалённое управление')
  assertDomTranslationTarget('dsh-plugin-desktop', 'ru', '.dshDesktopFrameTitlebar', 'Compatibility mode', 'Режим совместимости')
  assertDomTranslationTarget('dsh-plugin-desktop', 'ru', '.dshDesktopSettings', 'Window mode', 'Режим окна')
})

test('screenshot translations keep the Chinese compaction note and skin taglines accurate', () => {
  const compactSource = '控制 `purpose: compaction` 摘要调用是否改用独立的 compact 模型路由。'
  assertDomTranslationTarget('@dsh-plugin/dsh-auxiliary', 'ru', 'section[aria-labelledby="compact-title"]', compactSource,
    'Определяет, будет ли для кратких сводок с `purpose: compaction` использоваться отдельный маршрут к модели сжатия контекста.')
  assertDomTranslationTarget('@dsh-plugin/dsh-auxiliary', 'en', 'section[aria-labelledby="compact-title"]', compactSource,
    'Controls whether summary requests with `purpose: compaction` are routed to a separate compact model.')
  assertDomTranslationTarget('@linxin666/dsh-pet', 'ru', '#settings-pet-pet', 'OUO Neko', 'Кошка OUO')
  assertDomTranslationTarget('@linxin666/dsh-client-ui-skin-center', 'ru', '.TJMolG_card',
    '鲸鱼插画背景 · periwinkle 靛蓝调色板 · 半透明面板',
    'Фон с иллюстрацией кита · сине-фиолетовая палитра · полупрозрачные панели')
  assertDomTranslationTarget('@linxin666/dsh-client-ui-skin-center', 'ru', '.TJMolG_card',
    '暮光蓝港 · 日落橙辉 · 半透明夜色面板',
    'Сумеречная синяя гавань · оранжевое сияние заката · полупрозрачные панели в ночных оттенках')
})

test('release modal labels and every v0.4.2 bullet have English and Russian text', () => {
  const bullets = [
    '[task-board] 子任务、Agent 工具与 Agent Team 执行：看板支持父子任务与并发级联执行，新增八个模型可调用的看板工具，并支持以 Agent Team 方式执行（由 Host 为每个子任务拉起队友）',
    '[market] 市场内容改为经卫星仓 submodule 固定内容提交，构建读取 gitlink 指向的目录',
    '[scripts] `link-profile` 同时链接卫星包到本地 DSH profile',
    '[remote-web-ui] 应用投放的每一类页面都不再落入配对围栏；LAN 必需提示同时指明两处设置位置',
    '[task-board] 失败的会话复用执行如实记录，并断言固定的 agent preset',
    '[client] 插件路由按文档相对路径投递，子路径部署不再拼错地址',
    '[dsh-web-all] 原地重载后家族页签与看板入口保持可用；带壳家族行改为可配置',
    '[usage] 余额探测限定在自身账号 origin',
    '[desktop] profile 重播种时保留每个插件的 bundle patch 文件（随桌面端移除一并退役）',
    '[market] 移除部署 lane 的部署后资产校验；边缘资产状态按实际重复状态判定并重试瞬时状态',
    '[preset-center] 改为消费拆出的预设中心包，不再在本仓内置',
    '[scripts] PR 评审与皮肤/pet 流程指向卫星仓；退掉本仓不再服务的 renderer 路由与皮肤评审 lane',
    '[ci] 特权 workflow 只在规范仓库运行；路由 glob 与配置文档一致',
    '[test] 重录当前测试舰队实际测得的覆盖率基线；家族测试环境提供可用的 localStorage',
    '[docs] 补齐卫星仓关系、四仓措辞与发布准备说明',
  ]
  assert.equal(bullets.length, 15)
  assertDomTranslations('@linxin666/dsh-remote-web-ui', 'en', '.fThDlq_updateNotes', bullets)
  assertDomTranslations('@linxin666/dsh-remote-web-ui', 'ru', '.fThDlq_updateNotes', bullets)
  assertNamespaceTranslations('@linxin666/dsh-remote-web-ui', 'ru', 'remote', [
    'update.title', 'update.found', 'update.foundDetail', 'update.start', 'update.cooldownNotice',
    'update.releaseNotes', 'update.releaseFeatures', 'update.releaseFixes', 'update.releaseOther', 'update.componentVersions',
  ])
})
