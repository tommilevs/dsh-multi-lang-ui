Warning: truncated output (original token count: 37468)
Total output lines: 1191

# Changelog

## 0.2.0

- **EN:** Add per-plugin, per-language translation coverage and a `dsh-i18n coverage` CLI inventory.
- **RU:** Добавлены таблица покрытия переводов по плагинам и языкам и команда `dsh-i18n coverage`.
- **EN:** Add a stdio MCP server for translation discovery, source lookup, draft creation, validation, and safe local staging, including source catalogs for new plugins.
- **RU:** Добавлен MCP-сервер stdio для поиска исходных строк и переводов, создания черновиков, проверки и безопасной подготовки языковых пакетов, в том числе каталогов новых плагинов.
- **EN:** Show source-map availability from an embedded map or source-language pack, and limit CI catalog depth, pack count, and JSON size.
- **RU:** Отображается наличие карты исходных строк во встроенной карте или языковом пакете; в CI ограничены глубина каталогов, число пакетов и размер JSON.
- **EN:** Validate data-only language-pack pull requests with trusted base-branch code and approve eligible translations of cataloged source strings without merging them.
- **RU:** Запросы на включение только с данными переводов проверяются доверенным кодом целевой ветки; подходящие переводы известных строк автоматически одобряются, но не сливаются.
- **EN:** Document a bilingual workflow for human-reviewed community translations.
- **RU:** Описан двуязычный процесс подготовки и проверки переводов сообщества.
- **EN:** Translate all 16 built-in pet messages shown when its treat supply is empty.
- **RU:** Переведены все 16 встроенных реплик питомца, которые появляются, когда лакомства закончились.
- **EN:** Add pull-request CI for tests, locale validation, client syntax, and package contents.
- **RU:** Добавлены проверки pull request: тесты, языковые пакеты, синтаксис клиентского кода и состав npm-пакета.
- **EN:** Publish a versioned GitHub Release with the validated npm tarball and bilingual changelog notes.
- **RU:** Настроена публикация GitHub Release с проверенным npm-архивом и двуязычными заметками из списка изменений.
- **EN:** Configure weekly grouped Dependabot updates for npm dependencies and GitHub Actions.
- **RU:** Настроены еженедельные сгруппированные обновления npm-зависимостей и GitHub Actions через Dependabot.

## 0.1.14

- Prefer the most specific matching dynamic DOM template so broad labels cannot partially translate pet chatter.
- Add a regression test for interpolated tool-summon dialogue in English and Russian.

## 0.1.13

- Translate all 293 built-in pet chatter lines in English and Russian, including status, tool, and whisper bubbles.
- Add a versioned source snapshot and regression checks for complete pet chatter coverage, exact placeholders, and Chinese-free targets.

## 0.1.12

- Translate the remaining pet dialogue and composite affinity ranks in English and Russian.
- Add translations for all visible built-in MCP catalogue descriptions, Server Deck and Browser Skill home-tab titles, and the mixed-language vision-model fallback error.
- Reset the MCP floating button's persisted dragged position once so its default bottom-right placement is restored.
- Add focused regression tests for the screenshot-reported strings, dynamic model IDs, and the one-time button-position migration.

## 0.1.11

- Translate the Server Deck native sidebar tab, standalone-panel controls, common API errors, SSH failure messages, and delete confirmation.
- Add narrowly allowlisted roots for the right-sidebar tab title and Server Deck standalone host panel.
- Translate supported native `window.confirm` prompts from community packs and restore the original handler when the plugin unloads.
- Cover the latest MCP import strings and add regression tests for mixed-language and dynamic Server Deck content.

## 0.1.10

- Complete screenshot-driven English and Russian coverage for the remaining pet settings, MCP forms, Skin Center, DSH Desktop, and plugin-manager cards.
- Translate the dynamic usage footer with token and call totals while preserving counts and supporting English, Chinese, and mixed-language source forms.
- Allow the runtime selector guard to load plugin-manager card translations.
- Add regression checks for the new UI copy, DOM selectors, and language switching.

## 0.1.9

- Translate the auxiliary compaction explanation when its host renders the Chinese source string.
- Translate the `OUO Neko` pet choice into Russian while preserving its English display name.
- Refine the Russian skin-card descriptions and add screenshot regression coverage for both gaps.

## 0.1.8

- Normalize a partially translated DeepSeek usage message that DSH could render after other locale adapters ran first.
- Translate the Skin Center item in the DSH Desktop navigation in both locales.
- Add live-screen regression coverage for the mixed-language usage message.

## 0.1.7

- Complete the screenshot-reported Russian and English translations for DSH Desktop, auxiliary models, usage, archive, MCP import, model capabilities, pet choices, and skin cards.
- Translate every DSH Desktop settings string from its 119-key source dictionary.
- Extend safe scoped DOM translations to the auxiliary-model feature-card sections.
- Add regression coverage for the newly localized controls and dynamic strings.

## 0.1.6

- Fetch bundled community locale packs without reusing stale browser-cache responses after plugin updates.
- Add a regression test for fresh pack loading.

## 0.1.5

- Translate the Trajectory tab on the initial Russian render, before its locale namespace becomes available.
- Localize usage-card accessibility labels in English and Russian.
- Keep the conversation-tabs fallback scoped to its dedicated root.

## 0.1.4

- Align host validation with browser selectors so every bundled locale pack reaches the UI.
- Translate accessibility attributes on plugin root controls, including MCP launch buttons.
- Add Russian dictionaries for the complete Trajectory and Workshop surfaces.
- Remove leftover English labels from the bundled Russian Workshop titles.
- Verify all bundled packs load without skips and root controls survive language changes.

## 0.1.3

- Add bilingual screenshot coverage for MCP filters, usage statistics, session archive, pet UI, model capabilities, and the update modal.
- Localize Desktop settings, plugin manager, and Auxiliary Models labels, including the dynamic provider catalog error.
- Translate native select options and preserve runtime values when switching languages.
- Add screenshot coverage and dynamic DOM translation regression tests.

## 0.1.2

- Restore complete host and browser JavaScript artifacts that were truncated in 0.1.1.
- Add regression coverage for runtime syntax and package-version metadata.

## 0.1.1

- Add the DSH 0.1.7 settings API integration and preserve the `russian-lang` preferences namespace.
- Publish the bilingual UI and community translation pack workflow.

## Historical translation-source notes

The following release notes are retained from the upstream `dsh-russian-lang` project for provenance of the reused translation corpus. Their version numbers describe that source project, not releases of `dsh-multi-lang-ui`.


## 0.1.1

- Support DSH 0.1.7 settings through volatile plugin configuration fields.
- Preserve the `russian-lang` profile entry for existing preferences.
- Document installation from the public GitHub repository.

## 0.3.9 — 2026-09-25
* **Хотфикс перевода реплик (#370)**: Устранён дублирующийся ключ `headers` в `translateTurnContent`, приводивший к потере заголовка `x-dsh-translator` и 403-ошибке. В `isTrustedTranslatorRequest` разрешены запросы через LAN и Tailscale при совпадении `Origin` и `Host`.
* **Безопасная типографика ввода (#371)**: Живая типографика в полях ввода переведена в режим строгого опт-ина (`liveInput: true`, по умолчанию выключена). В `formatInputLive` добавлена защита CLI-флагов (`--watch`, `--flag`), аргументов-разделителей `npm test -- ...` и кавычек с латиницей (`"git commit -m x"`).
* **Стабилизация и обезличенность CI (#372)**: Убраны абсолютные пути из `tools/systemd`, тестовые IP переведены на RFC 5737 TEST-NET-2, проверка обезличенности исключает файлы словарей.
* **ESLint в CI (#356)**: В пайплайн CI добавлен линтинг бандла с правилами `no-undef` и `no-dupe-keys`.
* **Документация и фиксация переводчика (#360)**: Зафиксирован тег образа `libretranslate/libretranslate:v1.5.3`, в README добавлен подробный раздел о движках перевода и приватности данных.
* **Фильтрация мёртвых ключей ядра (#358)**: Актуализирован срез апстрима `upstream/core-en.json`, в `build.py` внедрена фильтрация устаревших ключей при сборке `core.json`.

## 0.3.8 — 2026-09-25
* **Исправление падения карточки настроек (#354)**: Устранён `ReferenceError: upStatus is not defined` при разворачивании карточки плагина в настройках.
* **Безопасность DOM в инспекторе перевода (#355)**: Исключена интерполяция ключей и текста через `innerHTML` в `openInspectorModal`.
* **Восстановление CI (#356)**: Восстановлен пайплайн `.gitea/workflows/ci.yml` с полной проверкой сборки, тестов и размера пакета.
* **Синхронизация плейсхолдеров (#358)**: Устранено расхождение плейсхолдера `{label}` в `ru/05-plugins-subagent.json`.
* **Защита эндпоинтов транслятора (#359)**: Добавлена проверка кастомного заголовка `x-dsh-translator` и совпадения origin/host в `lib/translator.js`.
* **Фиксация Docker LibreTranslate и документация конфиденциальности (#360)**: Закреплён тег `libretranslate:v1.5.3`, в README добавлен раздел «Движок перевода реплик» с описанием движков, приватности и куда уходит текст, в карточке настроек — предупреждение при выборе Google.
* **Декомпозиция сборочного скрипта (#361)**: Исходный код клиентского скрипта вынесен из `build.py` в отдельный файл `lib/client.template.js`.
* **Оптимизация размера npm-пакета (#362)**: Медиафайлы (`docs/media`) исключены из `package.json.files`, ссылка на баннер переведена на raw GitHub.
* **Подключение умного ввода (#363)**: Функции `formatInputLive` (живая типографика по Enter) и `detectInputLayout` (индикатор раскладки) подключены к полям ввода чата.
* **Удаление дубликата документации (#364)**: Удалён избыточный файл `README.ru.md`.
* **Уточнение вариантов отображения диалога (#367)**: В `ru/02-conversation.json` пункт `verbose` переведён как «Полностью развёрнутый», заголовок — «Детали работы», удалены устаревшие ключи.

## 0.3.7 — 2026-09-24

- **Массовая локализация плагинов экосистемы DSH (230 новых ключей)**:
  - `@goodandready/dsh-remote-workspace` (70 ключей): полный русский перевод веб-интерфейса удалённых рабочих мест, включая коды подтверждения, управление кластером, контейнеры Docker/Podman, туннели и передачу файлов (закрывает #351).
  - `@mars-sea/dsh-commandcode-provider` (43 ключа): мультиаккаунтность, ротация API-ключей, закрепление аккаунтов за моделями и настройка порогов автоодобрения Command Guard.
  - `@noob-stupid/dsh-plugin-console` (28 ключей): контрактный префлайт формата сессий перед обновлением фреймворка, автоадаптация с бэкапом и разблокировка строк из карантина.
  - `@goodandready/dsh-smart-restart` (26 ключей): карточка настроек и инструменты защиты перезапу…30468 tokens truncated…по их английским словарям, плейсхолдеры сохранены. Бандл: 51 namespace, 3700 ключей.
- feat(locale): DOM-перевод панелей в обход locale-ядра (PR #113; issue #102). Панель dsh-skill-hub выбирает словарь по `documentElement.lang` и понимает только en/zh — русский в неё не попадает никак. Добавлен третий DOM-проход (рядом со spellcheck/типографикой): при активном русском CJK-текстовые узлы и атрибуты title/placeholder/aria-label заменяются по карте ZH_RU (348 пар), собранной на сборке из zh-референсов плагинов (`zh-refs/*.json`) и нашего перевода тех же ключей; шаблонные пары («共 {count} 个技能») — через регексы, значения переносятся в ru-шаблон («Всего навыков: 56»). MutationObserver удерживает переведёнными перерендеры React; при уходе с русского наблюдатель отключается.

## 0.1.26 — 2026-08-31

- fix(client): pass lookup chain to core lookup for DSH 0.1.2 (PR #94, issue #93). The translate wrapper called `this.lookup(ns, key)` with two args; DSH 0.1.2 `lookup(ns, key, chain)` requires a third argument (the locale chain) and iterates it, so `chain === undefined` threw `chain is not iterable`. That crashed `timeLabel` → `SessionNodeItem` → the whole `sidebar.workspaces` slot, so the conversation list vanished with no mention of Russian. Now the wrapper asks the method's arity (`lookup.length`) and passes the chain only when the core expects it, taking it from the core's `fallbackChain` (else `[active]`). Old 2-arg cores keep working. Adds `test/test_lookup_chain.mjs`.

## 0.1.24 — 2026-08-30

- fix: 0.1.23 вышла БЕЗ обещанного словаря `dsh-kanban`. Локальный `main` и `main` на GitHub разошлись: правка канбана лежала только на GitHub, релизные коммиты 0.1.21–0.1.23 — только локально, и сборка 0.1.23 шла по локальной ветке (49 пространств, 3309 ключей). 0.1.24 собрана после слияния обеих линий: 50 пространств, 3530 ключей, `dsh-kanban` внутри.

## 0.1.23 — 2026-08-30

- feat: русский словарь для `dsh-kanban` (221 ключ, `ru-plugins/10-kanban.json`). Плагин доски перестал нести свой `ru`: встроенные локали ядра — английская и китайская, русский даёт этот пакет. Пространство убрано из `self-ru.json` — пока оно там стояло, сборка пропускала его как «плагин локализовался сам». Выкатывать раньше dsh-kanban 0.1.12.

## 0.1.22 — 2026-08-30

- fix(client): use real LocaleRuntime API (addLanguage/setLocale) for RU switch (PR #88). 0.1.21 was published from a stale local main and missed this fix; 0.1.22 is the corrected build.

## 0.1.21 — 2026-08-30

- fix(client): use real LocaleRuntime API (addLanguage/setLocale) for RU switch (PR #88). Old code wrote runtime.snapshot / called runtime.publish() — neither exists on DSH 0.1.2-alpha, so switching silently no-op'd. Now the native Language menu lists Русский and selecting it switches the UI.

## 0.1.20 — 2026-08-30

- fix(client): register settings card via slots.inject so the slot is declared (PR #87). Direct register threw "slot is not declared" on DSH 0.1.2-alpha and the card never rendered; 0.1.19 only guarded the error. Now matches dsh-context/dsh-key-rotation.

## 0.1.19 — 2026-08-30

- fix: self-ru(dsh-key-limits) — private plugin self-localizes, exclude from bundle (49 ns/3309), fixes prod Failed to load (#81 suppl.)
- fix(client): guard settings.plugin.item slot (hotfix #85) already in 0.1.18+main, keep in release

# Changelog

## 0.1.18 (2026-08-29) — hotfix

- `fix(client)`: drop the `@deepseek-ai/dsh-client-ui-primitives` require and
  use a pure SVG chevron. That module is not registered in the module table of
  the current DSH core, so requiring it aborted our plugin's loader entry and
  broke production. Our bundle now requires only `react`. (#81)

## 0.1.16 (2026-08-27)

- `feat(client)`: RU/EN layout indicator near the chat input; click converts
  the current text (Alt+L behaviour). (#66)
- `feat(client)`: layout fixer learns from accepted corrections — a
  per-session local dictionary reduces false positives. (#67)
- `feat(host)`: optional Russian agent system prompt
  (`russian-lang.agentPrompt`), exposed in the settings card. (#68)
- `feat(tools)`: auto-fill new plugin keys into the MT queue
  (`tools/mt_autofill.py`, daily cron). (#69)
- `fix(client)`: settings card uses the core chevron icon (with fallback).
- `fix(mt)`: corrected 39 placeholder mismatches in shipped translations.
- `ci`: build npm `.tgz` artifact for the isolated test server.

## 0.1.15 (2026-08-26)

- `fix(client)`: settings-card checkboxes update instantly. Typography and ё
  toggles were controlled by async host state, so React reverted every click;
  now they use optimistic local state and sync from the host afterwards. The
  Russian switch reacts to locale changes.
- `feat(client)`: descriptive captions for «Типографика вывода» and
  «Буква ё» in the settings card.

## 0.1.13 (2026-08-26)

- `feat(dict)`: translate dsh-spend (namespace `usageStats`, 129 keys) — now
  shipped in the bundle; self-ru scanner no longer misfires on `{zh,en}`-only
  registrations. (#55)
- `feat(build/CI)`: test/_repro.cjs exits non-zero on a broken bundle; MT
  registry placeholder gate + honest runtime coverage metric (100%). (#55)
- `fix(ci)`: offline runner — dropped setup-python, added term_check warning
  step. (#55)
- `fix(tools)`: upstream_check no longer pushes directly to main (commits to
  `upstream/snapshot` for a PR instead). (#55)
- `feat(client)`: settings card now shows the Alt+L layout-convert hint. (#55)
- `chore(ops)`: weekly `freq_refresh` cron added.

## 0.1.10 (2026-08-25)

- `feat(client)`: settings card. New «Русская локализация» card in
  Настройки → Плагины → Настройки плагинов: switch Russian on/off (goes
  through the runtime, no syncFlag fight), typography toggle, ё toggle,
  overrides count. Collapsed by default; form gated on the snapshot status;
  rl- prefixed styles on theme variables.
- `feat(build)`: corpus-derived ё dictionary. build.py generates е→ё pairs
  from the bundled frequency corpus (144 pairs + 22 curated); ambiguous
  «все» is blacklisted. typography.yo stays default-off.
- `feat(tools): term_check.py` — en→ru terminology consistency report across
  all namespaces (27 contextual divergences documented).
- `chore(dict)`: plugin dictionaries refreshed from the production profile
  (plugins-en.json 16 ns / 1815 keys); MT filled 102 new dsh-market keys,
  25 bad drafts rejected by the new placeholder validation.

## 0.1.9 (2026-08-25)

- `feat(tools)`: placeholder validation in MT apply. `mt_fallback.py --apply`
  retries translations whose `{placeholders}` diverge from the en original and
  drops persistent mismatches instead of shipping raw `{...}` into the UI.
  Provider is injectable for tests. (#45)
- `feat(tools): self-ru namespace autodetection`. New
  `tools/self_ru_scan.py <profile>` writes `self-ru.json`; build.py prefers it
  over the hardcoded list, so new self-localizing plugins stop crashing the
  loader. (#45)
- `feat(tools): freq_refresh`. `tools/freq_refresh.py` downloads a fresh
  Russian frequency list and re-merges DSH domain words in one command. (#45)
- `test: full coverage for the tooling`. mt_fallback (PH rejection, retry,
  incremental registry), merge_freq (word extraction, stop-list),
  self_ru_scan (quote styles), freq_refresh (filter), upstream_check
  (diff/report). (#45)
- `ci: Gitea Actions workflow` — node tests, tool tests, build+syntax,
  coverage gate and a de-identification grep on every PR. (#45)
- `fix(tools)`: upstream_check/systemd installer no longer hardcode machine
  paths — configuration moved to environment variables.

## 0.1.8 (2026-08-25)

- `fix(plugin)`: complete the self-ru exclusion list. 0.1.7 missed
  `dsh-gitea`, `dsh-key-rotation` and `dsh-vision-bridge`, which also
  register their own ru locale; the loader still failed with «locale
  namespace X already has locale ru». All 14 self-ru namespaces are now
  excluded at build time; bundle 41→38 namespaces / 1878→1761 strings.

## 0.1.7 (2026-08-25)

- `fix(plugin)`: skip namespaces that plugins already localize to ru. 0.1.6
  added ru for namespaces the plugins themselves register as ru
  (dsh-messenger-gateway, dsh-spendmeter, task-board, settings.commandcode,
  pin, dsh-context, context-doctor, settings.ollama-cloud, plugin-store,
  usageStats, usageDashboard), which made the loader fail with
  «locale namespace X already has locale ru». Excluded at build time; bundle
  shrinks 52→41 namespaces / 2795→1878 strings.

## 0.1.6 (2026-08-25)

- `feat(tools): translate top plugins via MT`. `tools/mt_fallback.py` fills
  untranslated plugin keys through OpenRouter (deepseek/deepseek-chat) into
  `mt-registry.json`, now written incrementally so long runs survive
  interruption. 1086 keys across 16 plugin namespaces added; bundle grows
  39→52 namespaces / 1709→2795 strings. Full manual-review queue in
  `upstream/review-queue.md`; a manual translation in `ru-plugins/*.json`
  always wins over the machine one. (#3)
- `feat(tools): domain dictionary for wrong-layout detector`. New
  `tools/merge_freq.py` merges DSH vocabulary from the plugin's own
  translations into the layout-fix frequency list (8000→9181 words), so the
  detector recognises terms like «рабочая сессия». (#6)
- `test(smoke): probe feature surfaces`. Smoke reports runtime presence of
  the language/spellcheck/typography surfaces as probes. (#5)
- `fix(plugin)`: two placeholder bugs in context-doctor (`cd.updated` lost
  `{when}`, `cd.suggestions` had a stray `{n}`); surfaced once the plugin
  baseline `plugins-en.json` was committed.

## 0.1.5 (2026-08-25)

- `feat(tools): nightly upstream drift check`. `tools/upstream_check.py`
  installs the latest `@deepseek-ai/dsh`, harvests the en locale surface,
  diffs against a committed snapshot and opens/updates a `chore(upstream):`
  Gitea issue on drift. Installed as a daily cron job. (#18)
- `feat(tools): MT-fallback with review queue`. `tools/mt_fallback.py` fills
  untranslated keys via a cheap OpenRouter model into `mt-registry.json`;
  `build.py` merges those strings as ordinary keys (manual ru translation
  wins) and `--review` writes `upstream/review-queue.md`. (#22)
- `feat(tools): top-100 plugin coverage report`. `tools/top100.py` scans a
  profile's node_modules, harvests plugin locale surfaces and writes
  `docs/top.md`. (#21)
- `feat(client): wrong-layout input hint and Alt+L converter`. Detects latin
  typed instead of Cyrillic (bundled 8k Russian frequency list), shows a
  hint bar; click replaces. Cyrillic→Latin only for slash-command input.
  Alt+L converts the current input in place. (#25)

## 0.1.4 (2026-08-25)

- `feat(client): browser spellcheck on text fields`. While Russian is active,
  textareas and text/search inputs get `spellcheck=true` + `lang=ru-RU`;
  monospace fields (code, commands) are excluded, originals restored on
  language switch. (#24)
- `feat(client): plural forms for bare count keys`. The translate wrapper now
  resolves `X.one` / `X.few` / `X.many` for keys called as `t('X', {n})`
  without the core's `.one/.other` suffix; dictionaries gain correct forms for
  the context-doctor counters and workspace search hint. (#17)
- `feat(client): Russian typography pass`. Idempotent text-node post-processor:
  guillemets, em dash, non-breaking spaces after short function words;
  optional ё restoration (`russian-lang.typography.yo`, default off). Code,
  links and inputs are never touched. (#19)
- `chore(check)`: `X.few` / `X.many` are treated as intentional when the bare
  base key exists in en. (#17)

## 0.1.3 (2026-08-25)

- `feat(client): Russian plural forms (few/many)`. Wraps `runtime.translate` to
  resolve Russian plural forms (one/few/many) for keys ending in `.one`/`.other`,
  and adds `few`/`many` keys for all 7 plural pairs in the core.
- `feat(client): user-defined translation overrides`. New `russian-lang.overrides`
  settings namespace (`{ key: wording }`) applied as the top layer in translate.
- `feat(check): flag lost placeholders`. `check-coverage.py` fails on ru
  translations that drop or add `{placeholders}`; `X.few`/`X.many` are treated as
  intentional Russian plural forms.
- `feat(client): use ru-RU as the document locale`. `<html lang>` is now `ru-RU`
  (BCP 47); `Intl.PluralRules('ru-RU')`.

## 0.1.2 (2026-08-23)

- `fix(client): register html-lang subscriber synchronously`. The previous
  `ctx.effect(() => runtime.subscribe(syncLang))` deferred subscriber registration
  until after the first `publish()` from the boot path, so `<html lang>` never
  picked up the ru value on a fresh boot. Registered inline; the disposer is
  still attached through a `ctx.effect` so it tears down with the plugin.

## 0.1.1

- Initial public release. 30 DSH core namespaces (722 keys, 100% coverage) plus 9
  plugin namespaces (962 keys). Adds `Русский` as the third option in the native
  Settings - General - Language menu on unpatched cores. Persisted through the
  plugin-owned `russian-lang` settings namespace.
