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

Required top-level fields are `plugin`, `locale`, `sourceLocale`, and `namespaces`. The `plugin` object contains non-empty `id`, `version`, `source`, and `license` strings; `plugin.source` must be an HTTP(S) URL. Every namespace must contain at least one key, and every translation must be a non-empty string. The `plugin.id` must match the directory name and the `locale` must match the filename.

The optional `source` map records the original UI strings. When supplied, it must have exactly the same namespaces and keys as `namespaces`. The validator compares `{placeholder}` names, including repeated occurrences, between each original string and its translation. Keep placeholders intact and use the same spelling. A format suffix such as `{count:plural}` is permitted; validation compares the `count` placeholder and ignores the format suffix.

The optional `dom` array is for adapters that translate exact UI text in a plugin panel that does not use DSH locale APIs. Each entry requires a non-empty CSS `selector`, original `source` string, and translated `target` string. The selector must be a scoped selector rooted at a plugin-owned class and no longer than 300 characters; global roots such as `body`, `html`, and `*` are rejected. `{placeholder}` names and counts must match between source and target. Keep selectors narrow and scoped to the plugin's own UI; do not target general DSH controls or user-authored content.

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

Пример JSON выше показывает полный формат. Обязательны поля верхнего уровня `plugin`, `locale`, `sourceLocale` и `namespaces`. Объект `plugin` содержит непустые строки `id`, `version`, `source` и `license`; `plugin.source` должен быть HTTP(S)-ссылкой. В каждом пространстве имён должен быть хотя бы один ключ, а каждая строка перевода должна быть непустой. `plugin.id` должен совпадать с каталогом, а `locale` — с именем файла.

Необязательная карта `source` хранит исходные строки интерфейса. Если она указана, набор пространств имён и ключей должен полностью совпадать с `namespaces`. Валидатор сравнивает имена и количество вхождений плейсхолдеров вида `{placeholder}` в оригинале и переводе. Сохраняйте плейсхолдеры без изменений. Допускается суффикс формата, например `{count:plural}`; валидатор сравнивает `count`, а суффикс игнорирует.

Необязательный массив `dom` предназначен для адаптеров, переводящих точные строки интерфейса в панели плагинов без поддержки API локализации DSH. У каждой записи должны быть непустые CSS-селектор `selector`, исходная строка `source` и перевод `target`. Селектор должен быть узким и начинаться с класса, принадлежащего плагину; длина — не более 300 символов. Глобальные корни `body`, `html` и `*` запрещены. Имена и количество плейсхолдеров `{placeholder}` должны совпадать. Не выбирайте общие элементы DSH или текст, введённый пользователем.

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
