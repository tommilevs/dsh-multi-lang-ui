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
  assertNamespaceTranslations('dsh-plugin-desktop', 'ru', 'desktop.settings', [
    'nav', 'title', 'intro', 'exportDiagnostics', 'openTerminal', 'restartDesktop', 'profileTitle',
    'profileIntro', 'profileReady', 'activeProfile', 'profileName', 'profileNamePlaceholder', 'create',
    'marketTitle', 'marketIntro', 'marketDisabled', 'marketDisabledBody', 'communityMarketBody', 'dshMarketBody',
    'selected', 'beta', 'aaIntro',
  ])
  assertNamespaceTranslations('@linxin666/dsh-client-ui-plugin-manager', 'ru', 'settings.pluginManager', ['tab'])
  assertNamespaceTranslations('@dsh-plugin/dsh-auxiliary', 'ru', 'dsh-auxiliary', [
    'nav', 'intro', 'catalogFailure', 'visionTitle', 'visionDescription', 'visionToggle', 'visionPickerLabel',
    'visionHandoff', 'visionSkipWhenImageCapable', 'visionUsage', 'compactTitle', 'compactDescription', 'compactToggle',
  ])
  assertDomTranslations('@dsh-plugin/dsh-auxiliary', 'ru', 'p[role="alert"]', [
    '{provider} ({id}): model "{model}" declares native image input, so its "{alias}" entry no longer applies. Select the same model from the provider group without "{alias}".',
  ])
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
