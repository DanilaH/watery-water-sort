# Watery Water Sort

Android-игра сортировки жидкостей. Планируемый первый магазин — RuStore.

Стек по ТЗ: TypeScript + Phaser + Vite + Capacitor, нативная реклама Яндекса.

## Документация

- [Роудмапа v1](docs/ROADMAP.md) — этапы, критерии готовности, предлагаемые решения и открытые вопросы.
- [Полное ТЗ v1](docs/source/WATER_SORT_PRODUCT_REQUIREMENTS_V1_2026-10-23.md).
- [Исследование конкурентов](docs/source/research/WATER_SORT_COMPETITOR_RESEARCH_2026-10-23.md).

Оба оригинала перенесены без изменений. Роудмапа сверена с ТЗ; дополнительные решения отдельно помечены для утверждения. Старые validation-артефакты, на которые ссылается исследование, не приложены.

- [UI/UX и feel: аудит 0.2 от 24.10.2026](docs/UI_UX_AUDIT_2026-10-24.md) — 24 пункта, примеры и приоритеты.

- [Исправления UI/UX и feel в 0.3](docs/POLISH_03.md) — результаты повторного прохода.

- [Независимый аудит 0.6](docs/UI_UX_FEEL_REVIEW_06.md) и [правки 0.7](docs/POLISH_07.md).

## Текущее состояние

Полировка 0.7: 12 уровней, переливание, семплы воды/стекла и музыкальные акценты, отмена, сохранение, Worker-подсказки, темы/символы и Android-оболочка. Реклама ещё не подключена; подсказки в этой сборке без лимита. Не готово к магазину.

[Переработка графики и звука 0.2](docs/FEEL_REVISION_02.md) · [Результаты первого прототипа](docs/PROTOTYPE_STATUS.md) · [Решения](docs/DECISIONS.md)

## Запуск

Node 22+, затем:

```sh
npm ci
npm run dev
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Android: JDK 21 и SDK 36, `npm run android:sync`, затем `cd android && ./gradlew assembleDebug`. GitHub Actions выполняет проверки и сохраняет debug APK как `watery-water-sort-debug`. Релизной подписи нет.

`npm run levels` воспроизводит исходный прототипный банк. Не перегенерировать выпущенные задачи без новой версии и миграции.
