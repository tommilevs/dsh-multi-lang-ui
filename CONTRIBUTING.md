# Contributing translations

Community translation packs are data-only JSON. A pull request must contain only files under `contributions/`; CI reads those files as data and runs the trusted locale validator from the target branch. It does not execute code from a contribution.

## File layout

Add one locale pack per plugin and locale:

```text
contributions/<plugin-id>/<locale>.json
```

For a scoped package ID, keep the scope in the path:

```text
contributions/@scope/plugin-name/<locale>.json
```

Use a path-safe package ID that matches `plugin.id` exactly. Locale filenames use a BCP 47-style language tag, for example `ru.json`, `en-US.json`, or `zh-Hans.json`.

## Pack format

```json
{
  "plugin": {
    "id": "@example/my-plugin",
    "version": "1.2.3",
    "source": "https://github.com/example/my-plugin",
    "license": "MIT"
  },
  "locale": "ru",
  "sourceLocale": "en",
  "namespaces": {
    "settings": {
      "save": "Сохранить",
      "greeting": "Привет, {name}!"
    }
  },
  "source": {
    "settings": {
      "save": "Save",
      "greeting": "Hello, {name}!"
    }
  },
  "dom": [
    {
      "selector": ".my-plugin-root .greeting",
      "source": "Hello, {name}!",
      "target": "Привет, {name}!"
    }
  ]
}
```

Required top-level fields are `plugin`, `locale`, `sourceLocale`, and `namespaces`. The `plugin` object contains non-empty `id`, `version`, `source`, and `license` strings; `plugin.source` must be an HTTP(S) URL. Every namespace must contain at least one key, and every translation must be a non-empty string. A DOM-only adapter may use an empty `namespaces` object if it has at least one valid `dom` entry. The `plugin.id` must match the directory name and the `locale` must match the filename.

The optional `source` map records the original UI strings. When supplied, it must have exactly the same namespaces and keys as `namespaces`. The validator compares `{placeholder}` names, including repeated occurrences, between each original string and its translation. Keep placeholders intact and use the same spelling. A format suffix such as `{count:plural}` is permitted; validation compares the `count` placeholder and ignores the format suffix.

The optional `dom` array is for adapters that translate exact UI text in a plugin panel that does not use DSH locale APIs. Each entry requires a non-empty CSS `selector`, original `source` string, and translated `target` string. Selectors must use a supported, narrow plugin root such as `[data-dsh-plugin="usage"]`, `[data-dsh-pet-root]`, or a documented root class, and cannot exceed 300 characters. The validator also permits the two Auxiliary Models card headings and `p[role="alert"]` for its one exact, generated provider error; that entry only matches the known full error pattern and will not translate unrelated alerts. Global roots such as `body`, `html`, and `*` are rejected. `{placeholder}` names and counts must match between source and target. Do not target general DSH controls or user-authored content.

Namespace/key pairs must be unique across all packs for the same locale. The same pair may appear in another locale. Plugin IDs, namespaces, keys, and text are treated as data; contributions cannot add executable translation code.

## Validate locally

Run the validator against the repository's complete `contributions/` directory:

```bash
node scripts/validate-locales.mjs
```

Or validate a separate directory with the same `<plugin-id>/<locale>.json` structure:

```bash
node scripts/validate-locales.mjs /path/to/contributions
```

Then open a pull request containing only the new or changed JSON packs under `contributions/`. CI checks the entire submitted catalog for schema errors, filename/metadata mismatches, empty strings, placeholder mismatches, and duplicate namespace/key pairs for each locale.

For predictable CI resource use, the catalog is limited to 2,000 packs, 7,000 directory entries and 32 MiB total; each pack may be up to 1 MiB. Directory paths may be one level for an unscoped plugin or two levels for `@scope/plugin`.

---

# Переводы от сообщества

Пакеты переводов сообщества — это только JSON-данные. Pull request должен содержать файлы только внутри `contributions/`; CI читает их как данные и запускает доверенный валидатор из целевой ветки. Код из вклада не выполняется.

## Структура файлов

Создайте отдельный файл для каждого сочетания плагина и языка:

```text
contributions/<plugin-id>/<locale>.json
```

Для scoped-пакета сохраните scope в пути:

```text
contributions/@scope/plugin-name/<locale>.json
```

Используйте безопасный для пути идентификатор пакета; он должен точно совпадать с `plugin.id`. В имени файла используйте языковой тег в стиле BCP 47, например `ru.json`, `en-US.json` или `zh-Hans.json`.

## Формат пакета

Пример JSON выше показывает полный формат. Обязательны поля верхнего уровня `plugin`, `locale`, `sourceLocale` и `namespaces`. Объект `plugin` содержит непустые строки `id`, `version`, `source` и `license`; `plugin.source` должен быть HTTP(S)-ссылкой. В каждом пространстве имён должен быть хотя бы один ключ, а каждая строка перевода должна быть непустой. Для пакета, состоящего только из DOM-переводов, объект `namespaces` может быть пустым, если указан хотя бы один допустимый элемент `dom`. `plugin.id` должен совпадать с каталогом, а `locale` — с именем файла.

Необязательная карта `source` хранит исходные строки интерфейса. Если она указана, набор пространств имён и ключей должен полностью совпадать с `namespaces`. Валидатор сравнивает имена и количество вхождений плейсхолдеров вида `{placeholder}` в оригинале и переводе. Сохраняйте плейсхолдеры без изменений. Допускается суффикс формата, например `{count:plural}`; валидатор сравнивает `count`, а суффикс игнорирует.

Необязательный массив `dom` предназначен для адаптеров, переводящих точные строки интерфейса в панели плагинов без поддержки API локализации DSH. У каждой записи должны быть непустые CSS-селектор `selector`, исходная строка `source` и перевод `target`. Используйте узкий поддерживаемый корень плагина, например `[data-dsh-plugin="usage"]`, `[data-dsh-pet-root]` или документированный класс. Максимальная длина — 300 символов. Для двух карточек Auxiliary Models также разрешены их заголовки и `p[role="alert"]` для одной точной сгенерированной ошибки провайдера; этот перевод сработает только для известного полного шаблона ошибки и не затронет другие предупреждения. Глобальные корни `body`, `html` и `*` запрещены. Имена и количество плейсхолдеров `{placeholder}` должны совпадать. Не выбирайте общие элементы DSH или текст, введённый пользователем.

Пары namespace/key должны быть уникальны среди всех пакетов одного языка. Такая же пара может использоваться в другом языке. Идентификаторы, ключи и переводы считаются данными; добавлять исполняемый код в перевод нельзя.

## Локальная проверка

Проверьте весь каталог `contributions/`:

```bash
node scripts/validate-locales.mjs
```

Или укажите отдельный каталог с такой же структурой `<plugin-id>/<locale>.json`:

```bash
node scripts/validate-locales.mjs /путь/к/contributions
```

Затем откройте pull request только с новыми или изменёнными JSON-пакетами в `contributions/`. CI проверит полный набор отправленных переводов: схему, соответствие имени файла и метаданных, пустые строки, плейсхолдеры и дубли namespace/key для каждого языка.

Чтобы ограничить расход ресурсов CI, каталог может содержать не более 2 000 пакетов, 7 000 файловых записей и общий размер до 32 МиБ; каждый пакет — до 1 МиБ. Путь может включать один уровень для обычного плагина или два для `@scope/plugin`.

## MCP setup

### Let an AI translation agent help

The optional stdio MCP server lets any MCP-capable AI client inspect the translation inventory, read source context, prepare a locale pack, validate it, and stage the JSON file in a local checkout. It does not need GitHub credentials and cannot publish, approve, or merge a pull request. Keep review and submission in the contributor's hands.

Install the repository dependencies, then add a server entry to the AI client's MCP configuration. Use absolute paths for both the script and repository checkout:

```json
{
  "mcpServers": {
    "dsh-multi-lang-ui": {
      "command": "node",
      "args": [
        "/absolute/path/to/dsh-multi-lang-ui/bin/dsh-i18n-mcp.mjs",
        "--repo",
        "/absolute/path/to/dsh-multi-lang-ui"
      ]
    }
  }
}
```

The tools are `list_translation_coverage`, `get_translation_source`, `stage_source_catalog`, `scaffold_translation_pack`, `validate_translation_pack`, and `stage_translation_pack`. A translator can ask an AI to list untranslated plugin/language pairs, retrieve available source context, draft translations while preserving placeholders, validate the draft, and stage it. If a plugin has more than one source locale, pass `sourceLocale` explicitly to the source and scaffold tools. The AI should then show the diff for human review before the contributor opens a PR. The server only writes to the selected checkout's `contributions/` directory; it does not execute contributed data.

To add a plugin that has no translation pack yet, first collect its user-visible source strings and their namespace/key or DOM selectors. Ask the AI to call `stage_source_catalog` with `plugin` metadata (`id`, `version`, repository `source` URL, and `license`), the source language, the source strings in `namespaces`, and any selector/source pairs in `dom`. This records the source text as a source-language catalog; it does not scrape or execute the plugin. Then call `scaffold_translation_pack` for each target language (for example, `de`), passing `sourceLocale` when the plugin has multiple source languages. Fill the draft while preserving placeholders and markup, validate it, and stage it. Coverage will list the plugin and each contributed language. A maintainer manually reviews the initial source catalog and any new source keys or DOM selectors; later changes translating those established strings can qualify for auto-approval. Additions remain data-only JSON contributions and receive the same human-readable diff and CI validation as other packs.

Use `dsh-i18n coverage` for a human-readable coverage report or `dsh-i18n coverage --json` for an inventory suitable for another tool. Coverage lists the packs present in this repository, locale, namespace/key and DOM mapping counts, and whether source text is available. It does not invent percentages for upstream strings we have not catalogued.

### MCP-сервер для ИИ-переводчика

Необязательный MCP-сервер со стандартным вводом и выводом можно подключить к любому MCP-совместимому ИИ-клиенту. Он показывает каталог переводов, выдаёт исходный контекст, подготавливает языковой пакет, проверяет его и помещает JSON-файл в локальную копию репозитория. Серверу не нужны учётные данные GitHub; он не может публиковать, одобрять или сливать pull request. Проверка изменений и отправка PR остаются за участником.

Установите зависимости репозитория и добавьте сервер в конфигурацию MCP вашего ИИ-клиента. Укажите абсолютные пути к скрипту и клону:

```json
{
  "mcpServers": {
    "dsh-multi-lang-ui": {
      "command": "node",
      "args": [
        "/абсолютный/путь/dsh-multi-lang-ui/bin/dsh-i18n-mcp.mjs",
        "--repo",
        "/абсолютный/путь/dsh-multi-lang-ui"
      ]
    }
  }
}
```

Инструменты: `list_translation_coverage`, `get_translation_source`, `stage_source_catalog`, `scaffold_translation_pack`, `validate_translation_pack` и `stage_translation_pack`. Попросите ИИ найти отсутствующие сочетания плагина и языка, получить исходный текст, подготовить перевод с сохранением плейсхолдеров и проверить его. Если у плагина несколько исходных языков, укажите `sourceLocale` в инструментах получения исходного текста и подготовки пакета. Перед отправкой покажите diff человеку. Сервер записывает JSON только в каталог `contributions/` выбранного клона и не исполняет данные перевода.

Чтобы добавить плагин, которого ещё нет в каталоге, сначала соберите видимые пользователю исходные строки, их namespace/key или DOM-селекторы. Попросите ИИ вызвать `stage_source_catalog`, передав объект `plugin` с полями `id`, `version`, ссылкой на репозиторий `source` и лицензией `license`, исходный язык, тексты в `namespaces` и пары селектор/текст в `dom`. Инструмент добавит каталог исходного языка; он не скачивает и не запускает код плагина. Затем вызовите `scaffold_translation_pack` для каждого целевого языка (например, `de`), указав `sourceLocale`, если исходных языков несколько; заполните перевод, сохранив плейсхолдеры и разметку, проверьте и добавьте пакет. В таблице появятся плагин и каждый внесённый язык. Исходный каталог нового плагина и новые ключи/селекторы проверяет человек; последующие PR с переводом уже зарегистрированных строк могут получить автоодобрение. Перед отправкой ИИ должен показать человеку diff.

Команда `dsh-i18n coverage` выводит покрытие для человека, а `dsh-i18n coverage --json` — каталог для других инструментов. Отчёт перечисляет существующие пакеты, языки, число ключей namespace и DOM-подстановок, а также наличие исходного текста. Проценты покрытия не выдумываются, если полный исходный каталог строк плагина неизвестен.

## Automatic approval of translation-only PRs

After validation succeeds, the GitHub workflow can automatically approve a pull request only when it targets `main`, is not a draft, changes no more than 50 files, and every changed path is an added or modified `contributions/<plugin-id>/<locale>.json` pack. Auto-approval is narrower still: the plugin and its source strings must already exist in the trusted base catalog, and a pack may only translate established namespace keys and DOM source mappings. New-plugin source catalogs, new source keys/selectors, metadata changes, deletions, renames, code, workflows, documentation, and all other paths require human review. The workflow approves but never merges. If a pull request becomes ineligible or is retargeted, it dismisses only approvals previously created by this workflow; it never dismisses human reviews. It pins comparisons and approvals to the validated base/head commits and treats pull request files only as JSON data. It runs on every pull request update and cancels obsolete runs.

For a protected branch, add the **GitHub Actions** app to the allowed review dismissers so the workflow can withdraw only its own approval if the PR becomes ineligible; GitHub requires an administrator or an allowed reviewer/app to dismiss reviews on protected branches ([review dismissal permissions](https://docs.github.com/en/rest/pulls/reviews#dismiss-a-review-for-a-pull-request)). Also enable [**Dismiss stale pull request approvals when new commits are pushed**](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches) and require branches to be up to date before merging. The stale-review rule invalidates an approval tied to an older PR-head SHA if a push races with the workflow's final API check; the up-to-date rule prevents merging against a base branch that advanced after validation, until the PR is updated and revalidated. Keep GitHub auto-merge disabled for these pull requests; the workflow does not call the merge API and skips approval whenever auto-merge is already enabled.

To enable review submissions by `GITHUB_TOKEN`, a repository owner must enable **Settings → Actions → General → Workflow permissions → [Allow GitHub Actions to create and approve pull requests](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository)**. GitHub disables this setting by default in many repositories. Required reviews or branch protection remain in force.

## Автоматическое одобрение PR только с переводами

После успешной проверки GitHub Actions может автоматически одобрить pull request только при соблюдении всех условий: целевая ветка — `main`, PR не является черновиком, изменено не более 50 файлов, а каждый путь — новый или изменённый пакет `contributions/<plugin-id>/<locale>.json`. У автоподтверждения есть дополнительные ограничения: плагин и исходные строки должны уже быть в доверенном каталоге основной ветки, а пакет может переводить только существующие ключи namespace и DOM-пары. Исходные каталоги новых плагинов, новые ключи/селекторы, изменения метаданных, удаление и переименование файлов, код, workflow, документация и любые другие пути требуют ручной проверки. Workflow только одобряет PR и никогда не сливает изменения. Если PR перестал соответствовать правилам или был перенаправлен на другую ветку, workflow отзывает только собственные ранее созданные одобрения и никогда не снимает человеческие review. Проверка и одобрение привязаны к SHA проверенных веток; файлы PR обрабатываются только как JSON-данные. Workflow запускается при каждом обновлении PR и отменяет устаревшие запуски.

В защите ветки добавьте приложение **GitHub Actions** к списку тех, кому разрешено снимать review: на защищённой ветке это действие доступно администратору или указанному участнику/приложению ([права на снятие review](https://docs.github.com/en/rest/pulls/reviews#dismiss-a-review-for-a-pull-request)). Также включите [**Dismiss stale pull request approvals when new commits are pushed**](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches) и требуйте актуальную относительно целевой ветки ветку PR перед слиянием. Первое снимает одобрение, привязанное к старому SHA PR, если push совпадёт по времени с последней проверкой API; второе не позволит слить PR на устаревшей базе до его обновления и повторной проверки. Для этих PR оставьте GitHub auto-merge выключенным: workflow не вызывает API слияния и пропускает автоодобрение, если авто-слияние уже включено.

Чтобы `GITHUB_TOKEN` мог отправлять одобрения, владелец репозитория должен включить **Settings → Actions → General → Workflow permissions → [Allow GitHub Actions to create and approve pull requests](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository)**. GitHub часто выключает эту настройку по умолчанию. Обязательные проверки и защита ветки продолжают действовать.
