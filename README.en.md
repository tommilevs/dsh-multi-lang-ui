# dsh-multi-lang-ui

**Community-extensible translations for DeepSeek Harness (DSH).** This plugin preserves the Russian dictionaries and user-facing features from `dsh-russian-lang`, adds English strings for its own UI, and provides a contribution path for additional plugin translations.

Русская версия: [README.md](README.md).

## Included

- The base and user-facing features of [`GooDAnDReaDY/dsh-russian-lang`](https://github.com/GooDAnDReaDY/dsh-russian-lang): Russian core/plugin dictionaries, RU/EN switching, plural forms, typography, keyboard-layout correction, overrides, inspector, and the existing `russian-lang` settings namespace.
- The source dictionary set plus missing core keys from the author's installed 0.3.7 package: 56 core namespaces, 130 plugin namespaces, and 365 exact Chinese UI strings. These are dictionary counts, not a claim of complete coverage for every DSH release.
- Russian dictionaries for usage statistics and session archive in `@linxin666/dsh-web-all` 0.4.1.
- Russian and English UI adapters for the hardcoded Chinese interfaces in `dsh-mcp-manager-ui` 1.4.0 and `@dsh-external/dsh-super-injector` 0.3.3. Adapters only replace known exact strings within plugin-owned root classes. The ambiguous string `关闭` is intentionally left untranslated because it means both “Close” and “Off” in different controls.
- A **Community translations** settings section to import and export JSON packs. Translation packs contain data only and are never executed as code.

DSH's native English remains the default and fallback language. Packs add missing dictionaries and selectable locales; they do not replace DSH's core locale dictionaries.

## Install

To install from DSH, open **Plugins → Add** and enter this GitHub source:

```text
github:tommilevs/dsh-multi-lang-ui
```

Remove `@goodandready/dsh-russian-lang` before installation because both packages register Russian locale dictionaries. Settings keep the `russian-lang` profile entry and appear in DSH 0.1.7's profile configuration form. Restart DSH Desktop after replacement.

For local development and checks, run:

```bash
node scripts/embed-multilang.mjs
node --test test/*.test.mjs
node scripts/validate-locales.mjs
```

## Contribute a translation

Add `contributions/<package-id>/<locale>.json`; scoped package IDs use matching folders such as `contributions/@scope/plugin/ru.json`. Each JSON pack records package version, source URL, license, source text, translation, and optional exact-text DOM mappings restricted to plugin-owned CSS roots.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full bilingual schema, attribution rules, and local validation. Run:

```bash
node --test
node scripts/validate-locales.mjs
```

CI validates pull requests containing translation data. The workflow reads contribution JSON as data and runs a validator from the target branch; contributed code is not executed in CI or in the browser.

## Compatibility and licensing

The plugin targets current DSH locale/settings/slots APIs. Prefer namespace packs for plugins with native localization support. Scoped DOM adapters are a fallback and may need updates when upstream UI classes or strings change.

Code and dictionaries inherited from `dsh-russian-lang` retain their MIT attribution. Every external translation set records its source, version, and declared license. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), including the known license metadata discrepancy for the injector package.
