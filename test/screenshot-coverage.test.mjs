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
  const pet = ['亲密度', '小鱼干 ×{n}', '{points}点', '喂食', '改名', '隐藏', '鲸鱼娘', '鲸鱼娘（原版）']
  assertDomTranslations('@linxin666/dsh-pet', 'en', '[data-dsh-pet-root]', pet)
  assertDomTranslations('@linxin666/dsh-pet', 'ru', '[data-dsh-pet-root]', pet)
  assertDomTranslations('@linxin666/dsh-pet', 'en', '#settings-pet-pet', ['鲸鱼娘（原版）'])
  assertDomTranslations('@linxin666/dsh-pet', 'ru', '#settings-pet-pet', ['鲸鱼娘（原版）'])
  assertDomTranslations('@linxin666/dsh-pet', 'en', '#settings-pet-pet', ['蓝喉蜂虎', '鲸鱼娘（精致版）'])
  assertDomTranslations('@linxin666/dsh-pet', 'ru', '#settings-pet-pet', ['蓝喉蜂虎', '鲸鱼娘（精致版）'])

  const usage = ['今日消费', '今日暂无用量', '更新于 {time}', '今日用量', '个人套餐', 'Token 银行', '没有已配置的提供方', '近 30 天', '暂无用量数据（统计自插件启用起）', '轮询间隔（秒）']
  assertDomTranslations('@linxin666/dsh-web-all', 'en', '[data-dsh-plugin="usage"]', usage)
  assertDomTranslations('@linxin666/dsh-web-all', 'ru', '[data-dsh-plugin="usage"]', usage)
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
    '没有已配置的套餐类 provider（如 Kimi、GLM、OpenCode Go、MiniMax、Codex 订阅）',
  ]
  const archive = [
    '最后活动时间', '归档时间', '创建时间', '标题', '最早优先',
    '不属于任何工作区', '{n} 个子会话',
  ]
  for (const locale of ['en', 'ru']) {
    assertDomTranslations('@linxin666/dsh-web-all', locale, '[data-dsh-plugin="usage"]', usage)
    assertDomTranslations('@linxin666/dsh-web-all', locale, '[data-dsh-plugin="session-archive"]', archive)
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
    compact: ['Context compaction', 'Controls whether `purpose: compaction` summaries use the independent compact model route.', 'Enable auxiliary compaction route', 'Compaction model', 'Compaction threshold', 'Compaction triggers when context usage reaches this threshold. Supported range: 17%–99% (must stay above the retention ratio, 16% by default). Saving enables the auxiliary compression engine; if the default compaction plugin is loaded, remove it first so this engine takes over.', 'An enabled feature without a complete provider/model route keeps the existing pass-through behavior. `engine` has no third model picker; when enabled, the compression engine reuses this compact route.', 'Save'],
    approve: ['Approval model', 'Hookup for the @dsh-plugin/dsh-approve-for-me plugin: once that plugin is installed and review mode is active, its approval reviews run on the dedicated model selected here instead of inheriting the session\'s main model.', 'Enable approval-model routing', 'Approval model', 'An enabled feature without a complete provider/model route keeps the original behavior (the reviewer keeps inheriting the session or the plugin\'s own reviewProvider/reviewModel config). Prefer a cheap, fast model; the review verdict only decides approval and never enters the session history.', 'The @dsh-plugin/dsh-approve-for-me plugin was not detected: install and enable it (review mode) first — until then, saving this configuration has no effect.', 'Save'],
  }
  for (const locale of ['en', 'ru']) {
    for (const [feature, sources] of Object.entries(auxiliarySections)) {
      assertDomTranslations('@dsh-plugin/dsh-auxiliary', locale, `section[aria-labelledby="${feature}-title"]`, sources)
    }
  }
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
