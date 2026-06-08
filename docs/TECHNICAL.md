# RoomKanban — техническая документация {#обзор-технический}

**RoomKanban** (репозиторий `OficceHelper`, npm-пакет `room-kanban`) — настольное приложение на **Electron** для канбан-задач с синхронизацией через общую папку. Целевая аудитория этого документа: **разработчики** и **IT-администраторы** (сборка, развёртывание, структура данных, интеграция с файловым хранилищем).

Пользовательское руководство: `README.md` / `docs/USER_GUIDE.md` (якоря `обзор`, `канбан-и-задачи` и т.д.). В приложении справка загружается из `src/main/help/loadUserGuide.ts` — парсинг Markdown с заголовками `## … {#id}`.

---

## Содержание

- [Технический обзор](#обзор-технический)
- [Требования для разработки](#требования-разработки)
- [Установка для разработки](#установка-для-разработки)
- [Сборка](#сборка)
- [Структура папки комнаты](#структура-папки-комнаты)
- [Настройки приложения](#настройки-приложения)
- [Синхронизация (технически)](#синхронизация-технически)
- [Форматы данных](#форматы-данных)
- [Структура проекта](#структура-проекта)
- [Скрипты npm](#скрипты-npm)
- [API приложения](#api-приложения)

---

## Технический обзор {#обзор-технический}

| Компонент | Реализация |
|-----------|------------|
| **Среда** | Electron 34, Node.js в main-процессе |
| **Сборка** | [electron-vite](https://electron-vite.org/) → каталог `out/` |
| **UI** | React 19 + TypeScript (renderer) |
| **Данные комнаты** | JSON в `sync/` + файлы в `docs/` на выбранном диске/шаре |
| **Синхронизация** | Нет сервера; [chokidar](https://github.com/paulmillr/chokidar) следит за изменениями на диске |
| **Мост UI ↔ диск** | IPC (`ipcMain` / `ipcRenderer`) + `contextBridge` в preload |

Архитектура процессов:

```
┌─────────────────┐     contextBridge      ┌──────────────────┐
│  Renderer       │ ◄── window.api ─────── │  Preload         │
│  (React)        │     ipcRenderer        │  src/preload/    │
└────────┬────────┘                        └────────┬─────────┘
         │ invoke / on                           │ invoke / on
         ▼                                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Main (Node): RoomManager, *Store, BoardSyncManager,        │
│  chokidar, ReminderScheduler, SettingsStore                 │
└────────────────────────────┬────────────────────────────────┘
                             │ fs, rename, shell.openPath
                             ▼
                    Папка комнаты (sync/, docs/)
```

Версия приложения задаётся в `package.json` (сейчас **0.1.0**). `productName` установщика: **RoomKanban**, `appId`: `ru.roomkanban.app`, иконка: `build/icon.png`.

---

## Требования для разработки {#требования-разработки}

| Требование | Детали |
|------------|--------|
| **Node.js** | **18+** (LTS рекомендуется; в lock-файле типы `@types/node` 22.x) |
| **npm** | Поставляется с Node; зависимости — `npm install` |
| **ОС разработки** | Windows 10/11 (основная цель; Electron кроссплатформенный) |
| **ОС пользователей** | Windows 10/11 для готового `.exe` |
| **Сеть** | Нужна при первой сборке (`electron-builder` скачивает Electron) |
| **Папка комнаты (тест)** | Локальный путь или UNC `\\server\share\…` с правами чтения/записи |

Для офисного развёртывания на ПК сотрудников Node.js **не** требуется — только установщик из `release/`.

---

## Установка для разработки {#установка-для-разработки}

```bash
cd OficceHelper
npm install
npm run dev
```

- **`npm run dev`** — `electron-vite dev`, hot reload для renderer.
- **`npm run typecheck`** — `tsc --noEmit` для main/preload (`tsconfig.node.json`) и renderer (`tsconfig.web.json`).

Проверка production-сборки без установщика:

```bash
npm run build
npm run preview
```

Исходники: `src/`. Артефакт сборки: `out/main`, `out/preload`, `out/renderer`. Точка входа Electron: `out/main/index.js` (`package.json` → `"main"`).

Документация в режиме разработки ищется в `docs/TECHNICAL.md`, `docs/USER_GUIDE.md` (см. `loadUserGuide.ts` → `resolveDocPath`).

---

## Сборка {#сборка}

### electron-vite

Конфигурация: `electron.vite.config.ts` — три таргета (main, preload, renderer с `@vitejs/plugin-react`).

```bash
npm run build    # → out/
npm run preview  # Electron с out/
```

### electron-builder

Секция `"build"` в `package.json`:

| Поле | Значение |
|------|----------|
| `directories.output` | `release/` |
| `files` | `out/**/*` |
| `asar` | `true` |
| `win.target` | NSIS, x64 |
| Ярлык | `shortcutName`: RoomKanban |
| Иконка | `build/icon.png` → `.ico` в установщике; копия в `resources/icon.png` для окна |

Команды:

| Команда | Результат |
|---------|-----------|
| `npm run build` | Сборка в `out/` (версию **не** меняет) |
| `npm run dist` | Авто patch +1 в `package.json`, затем `build` + NSIS → `release/RoomKanban Setup X.Y.Z.exe` |
| `npm run dist:dir` | Авто patch +1, распакованная папка `release/win-unpacked/` |
| `npm run dist:publish` | Авто patch +1 + публикация в GitHub Releases (нужен `GH_TOKEN`) |
| `npm run version:show` | Текущая версия без изменений |

Скрипт `scripts/bump-version.mjs`: перед локальной сборкой увеличивает patch (`0.1.0` → `0.1.1`). В GitHub Actions при push тега `vX.Y.Z` версия **синхронизируется с тегом** без увеличения.

**Данные комнаты не входят в установщик** — только бинарник приложения. Резервное копирование = копия всей папки комнаты.

### Автообновление (GitHub Releases)

| Компонент | Реализация |
|-----------|------------|
| Библиотека | `electron-updater` в main-процессе (`src/main/updates/AppUpdater.ts`) |
| Источник | GitHub Releases репозитория `Andrychess/RoomKanban` (`publish` в `package.json`) |
| UI | Кнопка **Обновить** в шапке + меню **Справка → Обновить приложение…** |
| Проверка при старте | Через ~4 с после запуска (только packaged-сборка) |

**Публикация новой версии для пользователей (GitHub Actions):**

1. Закоммитьте изменения в `main`.
2. Создайте тег с нужной версией: `git tag v0.2.0 && git push origin v0.2.0`
3. GitHub Actions синхронизирует версию с тегом, соберёт `.exe` и опубликует Release с `latest.yml`.

**Локальная сборка / публикация:**

```bash
npm run dist          # версия 0.1.0 → 0.1.1 автоматически
npm run dist:publish  # то же + загрузка в GitHub Releases
```

После локальной сборки закоммитьте `package.json`. При публикации через `dist:publish` создайте тег `vX.Y.Z`, совпадающий с версией в `package.json`, чтобы CI и релизы оставались согласованными.

Локальная публикация с токеном:

```bash
set GH_TOKEN=ghp_...
npm run dist:publish
```

Установленное приложение подтянет обновление по кнопке **Обновить**; в режиме `npm run dev` автообновление отключено.

### extraResources и справка в установщике

В `package.json` → `extraResources`: папка `docs/**/*.md` для справки и `build/icon.png` → `icon.png` для иконки окна (`resolveAppIconPath` в `src/main/appIcon.ts`).

`loadUserGuide.ts` в packaged-режиме читает `process.resourcesPath/docs/TECHNICAL.md` и `…/docs/USER_GUIDE.md`.

```json
"extraResources": [
  {
    "from": "README.md",
    "to": "docs/USER_GUIDE.md"
  },
  {
    "from": "docs/TECHNICAL.md",
    "to": "docs/TECHNICAL.md"
  }
]
```

Либо целиком каталог:

```json
{
  "from": "docs",
  "to": "docs",
  "filter": ["**/*"]
}
```

После изменения — пересобрать `npm run dist`. Якоря технической справки в коде: `src/shared/helpAnchors.ts` → `TECH_HELP_ANCHORS`.

### Замечания для IT

- **SmartScreen** — неподписанный бинарник может требовать исключения или подписи Authenticode.
- **Антивирус** — исключения на запись в `sync/` и `docs/` общей папки комнаты.
- **Облако** (OneDrive и др.) — возможны задержки и «конфликтующие копии»; предпочтительна SMB-шара с нормальными правами NTFS.

---

## Структура папки комнаты {#структура-папки-комнаты}

Корень — путь, который пользователь выбирает при создании/входе в комнату. Константы путей: `src/main/sync/syncPaths.ts`.

```
<Корень комнаты>/
├── .room/                          # маркер «это комната RoomKanban»
├── docs/
│   ├── <task_id>/
│   │   ├── source/                 # входящие вложения задачи
│   │   │   └── <fileId>_<имя>
│   │   └── completed/              # итоговые файлы
│   │       └── <fileId>_<имя>
│   └── exchange/
│       └── <employee_key>/         # физические файлы «Обмена»
│           └── <fileId>_<имя>
└── sync/
    ├── room_state.json             # метаданные комнаты и сотрудники
    ├── tasks/                      # task_<id>.json — по одной задаче
    ├── exchange/                   # <employee_key>.json — метаданные обмена
    ├── history/                    # <task_id>.json — журнал изменений
    ├── task_types.json
    ├── task_priorities.json
    ├── task_templates.json
    ├── task_locks.json             # блокировки редактора
    ├── reminder_settings.json
    ├── board.json.migrated         # после миграции с board.json
    ├── exchange.json.migrated
    ├── task_history.json.migrated
    └── pc_*.json                   # legacy; мигрируется в tasks/
```

**Важно для админов:** не редактировать JSON вручную при открытых клиентах без понимания `updated_at` и атомарной записи. Резервная копия — вся папка целиком.

---

## Настройки приложения {#настройки-приложения}

Локальные настройки **не** синхронизируются через папку комнаты.

| Параметр | Значение |
|----------|----------|
| **Путь к файлу** | `%APPDATA%\room-kanban\settings.json` |
| **Механизм** | `app.getPath('userData')` + `settings.json` (`SettingsStore`) |
| **Имя каталога** | Из `package.json` → `"name": "room-kanban"` |

Тип `AppSettings` (`src/shared/types.ts`), основные поля:

| Поле | Назначение |
|------|------------|
| `theme` | `light` \| `dark` |
| `currentRoomPath` | Автооткрытие последней комнаты |
| `lastOpenedRooms` | До 10 недавних путей |
| `machineFingerprint` | Идентификатор ПК |
| `employeeBindings` | `путь комнаты` → последний `emp_…` на этом ПК |
| `kanbanColumnSort` | Сортировка колонок по пути комнаты (per-PC) |
| `reminderSent` | Ключи уже показанных напоминаний |
| `pcId` | Устаревшее; для legacy-комнат |

Тема дублируется в `localStorage` renderer для уменьшения мигания при старте.

---

## Синхронизация (технически) {#синхронизация-технически}

### Принцип

Источник правды — файлы на диске. Main-процесс:

1. Читает/пишет JSON через `readJsonFile` / `writeJsonFileAtomic` (`src/main/sync/jsonFile.ts`).
2. Следит за каталогами через **chokidar**.
3. Уведомляет renderer событиями `room-sync-updated`, `tasks-updated` и др.

### Наблюдаемые пути (chokidar)

| Store / менеджер | Путь | `depth` |
|------------------|------|---------|
| `BoardSyncManager` | `sync/tasks/*.json` | `0` |
| `ExchangeStore` | `sync/exchange/` | по файлам сотрудников |
| `TaskTypesStore` | `sync/task_types.json` | файл |
| `TaskPrioritiesStore` | `sync/task_priorities.json` | файл |
| `TaskTemplatesStore` | `sync/task_templates.json` | файл |
| `TaskHistoryStore` | `sync/history/<task_id>.json` | per-task |

Опции `awaitWriteFinish` (`src/main/sync/syncPath.ts` → `chokidarWriteFinish`):

| Условие | `stabilityThreshold` | `pollInterval` |
|---------|----------------------|----------------|
| Локальный диск | 300 ms | 100 ms |
| UNC, OneDrive, Yandex.Disk и т.п. | 900 ms | 150 ms |

### Собственная запись vs внешняя

`ExternalSyncHelper.markOwnWrite()` подавляет обработку watcher **~600 ms**, чтобы не дублировать обновление UI после локального сохранения. Внешние изменения шлют `broadcastRoomSync` → канал `room-sync-updated`.

### Очередь и конкуренция

- На одном ПК: `AsyncMutex` в каждом store — серия быстрых записей без гонки в одном процессе.
- Между ПК: одна задача = один файл `sync/tasks/<id>.json`; при чтении с диска берётся версия с большим `updated_at`, если она новее локальной (кроме явного «сохранить поверх» в редакторе).
- Редактор: `client_base_updated_at` → конфликт (`UpdateTaskResult`).
- Блокировки: `task_locks.json`, ~3 минуты, продление через IPC.

### Принудительное обновление

IPC `refresh-room-sync` → перечитывание задач, обмена, справочников; событие `room-data-refreshed`.

### Миграция legacy (при `start()` комнаты)

Выполняется в `BoardSyncManager`, `ExchangeStore`, `TaskHistoryStore` если нет per-file хранилища:

| Legacy | Действие |
|--------|----------|
| `sync/board.json` | Разбивка задач в `sync/tasks/*.json`, файл → `board.json.migrated` |
| `sync/pc_*.json` | Объединение задач в `tasks/`, исходники остаются |
| `sync/exchange.json` | → `sync/exchange/<emp>.json`, `exchange.json.migrated` |
| `sync/task_history.json` | → `sync/history/<task_id>.json`, `task_history.json.migrated` |

Нормализация полей задачи: `BoardSyncManager.normalizeTask` (в т.ч. `comment` → `description`, `due_date` через `normalizeDueDateStorage`).

### Безопасность путей

`syncPathSecurity.ts`: `assertTaskId`, `resolvePathInsideRoom` — запись и открытие файлов только внутри корня комнаты.

---

## Форматы данных {#форматы-данных}

### `room_state.json`

```json
{
  "room_id": "room_…",
  "room_name": "Название",
  "invite_code": "123456",
  "created_at": 1710000000,
  "chief_pc": "emp_…",
  "employees": {
    "emp_abc": {
      "name": "Иван",
      "role": "Менеджер",
      "joined_at": 1710000000,
      "password": { "salt": "…", "hash": "…" }
    }
  },
  "room_password": { "salt": "…", "hash": "…" }
}
```

Пароли: **scrypt** (соль + хэш), не plaintext. `chief_pc` — ключ сотрудника-создателя комнаты.

### `sync/tasks/<task_id>.json`

Основные поля задачи (`Task` в `src/shared/types.ts`):

| Поле | Тип / значения |
|------|----------------|
| `id` | `task_…` |
| `status` | `review` \| `todo` \| `in_progress` \| `done` |
| `title`, `description` | string |
| `type_id`, `priority_id` | ссылки на справочники |
| `assignee_pc` | ключ `emp_…` |
| `due_date` | см. ниже |
| `source_files`, `completed_files` | `TaskFile[]` с `file_rel` относительно `docs/` |
| `comments`, `checklist` | массивы |
| `archived_at` | `null` — на доске; unix sec — в архиве |
| `created_at`, `updated_at` | unix seconds |

### Поле `due_date`

Логика: `src/shared/dates.ts` (`normalizeDueDateStorage`, `parseDueDate`, `isOverdue`).

| Формат в JSON | Семантика |
|---------------|-----------|
| `null` / отсутствует | Без срока |
| `YYYY-MM-DD` | Дедлайн — **конец календарного дня** (23:59:59.999 локально) |
| `YYYY-MM-DDTHH:mm` | Точный момент (без секунд в хранении) |

При сохранении из UI: `mergeDueDateTime(date, time)` — пустое время → только дата.

**Календарь** группирует по `dueDateOnly()` (дата без времени). **Просрочка:** `parseDueDate` + статус не `done`; задачи в архиве и «Готово» не просрочены в отчётах.

### Legacy `board.json`

```json
{
  "tasks": [ { "id": "task_…", … } ],
  "updated_at": 1710000000
}
```

После миграции не используется; остаётся `board.json.migrated` для аудита.

### Обмен

- Метаданные: `sync/exchange/<employee_key>.json`
- Файлы: `docs/exchange/<employee_key>/<fileId>_<name>`

### История

`sync/history/<task_id>.json` — массив записей `TaskHistoryEntry` (действия: `status_changed`, `due_date_changed`, …).

### Статусы колонок

Коды в данных ↔ UI: `src/shared/taskStatus.ts` (`review`, `todo`, `in_progress`, `done`).

---

## Структура проекта {#структура-проекта}

```
OficceHelper/
├── package.json              # scripts, electron-builder, extraResources
├── electron.vite.config.ts
├── tsconfig.node.json        # main + preload
├── tsconfig.web.json         # renderer
├── docs/
│   ├── TECHNICAL.md          # этот файл
│   └── USER_GUIDE.md         # копия README для справки (рекомендуется)
├── README.md                 # пользовательское руководство (источник)
└── src/
    ├── main/
    │   ├── index.ts          # окно, меню, lifecycle
    │   ├── ipc/
    │   │   ├── registerHandlers.ts   # ipcMain.handle(…)
    │   │   └── windowSubscriptions.ts
    │   ├── room/RoomManager.ts
    │   ├── settings/SettingsStore.ts
    │   ├── help/loadUserGuide.ts
    │   ├── sync/
    │   │   ├── BoardSyncManager.ts   # tasks + chokidar + миграции
    │   │   ├── ExchangeStore.ts
    │   │   ├── TaskHistoryStore.ts
    │   │   ├── TaskTypesStore.ts
    │   │   ├── TaskPrioritiesStore.ts
    │   │   ├── TaskTemplatesStore.ts
    │   │   ├── syncPaths.ts
    │   │   ├── syncPath.ts           # chokidarWriteFinish
    │   │   ├── syncPathSecurity.ts
    │   │   ├── jsonFile.ts
    │   │   └── syncBroadcast.ts
    │   └── reminders/ReminderScheduler.ts
    ├── preload/index.ts      # contextBridge → window.api
    ├── renderer/             # React: screens, components, hooks
    └── shared/               # типы, dates, overdue, helpAnchors, …
```

**Стек:** Electron 34, electron-vite 3, React 19, TypeScript 5.8, chokidar 4.

Общая логика без Electron живёт в `src/shared/` — переиспользуется в main и renderer (через импорты в bundler с разными `tsconfig`).

---

## Скрипты npm {#скрипты-npm}

| Скрипт | Команда | Назначение |
|--------|---------|------------|
| `dev` | `electron-vite dev` | Разработка с HMR |
| `build` | `electron-vite build` | Production в `out/` |
| `preview` | `electron-vite preview` | Запуск собранного приложения |
| `dist` | `npm run build && electron-builder --win` | Установщик NSIS в `release/` |
| `dist:dir` | `build` + `electron-builder --win --dir` | `win-unpacked` без установщика |
| `typecheck` | `tsc --noEmit` (node + web) | Статическая проверка типов |

Зависимости runtime: **chokidar**, **electron-updater**. Остальное — devDependencies (electron, vite, react, typescript, electron-builder).

---

## API приложения {#api-приложения}

Публичный контракт renderer: **`window.api`** (`RoomKanbanApi` в `src/preload/index.ts`). Доступ только через **context isolation**; прямого `require('electron')` в UI нет.

### Паттерн IPC

- **Запросы:** `ipcRenderer.invoke('<channel>', …)` ↔ `ipcMain.handle('<channel>', …)` в `registerHandlers.ts`.
- **Подписки:** `subscribe-*` handlers регистрируют колбэк через `setWindowSubscription`; main шлёт `webContents.send('<event>', payload)`.
- **События меню/окна:** `navigate`, `open-help`, `room-auto-opened`, `room-closed`.

### Каналы invoke (основные)

| Канал | Назначение |
|-------|------------|
| `get-user-documentation` | Парсенные USER + TECH markdown |
| `get-app-theme` / `set-app-theme` | Тема |
| `select-folder` / `select-task-files` | Диалоги выбора |
| `create-room` / `enter-room` / `resolve-room-entry` / `close-room` | Комната |
| `peek-room` / `get-current-room` / `get-recent-rooms` / `list-rooms` | Состояние комнат |
| `verify-room-password` / `set-room-password` / `set-employee-password` | Пароли |
| `add-employee` / `update-employee` / `remove-employee` | Состав |
| `get-column-sorts` / `set-column-sort` | Сортировка канбана (local settings) |
| `get-tasks` / `create-task` / `update-task` / `update-task-status` | Задачи |
| `refresh-room-sync` | Принудительный reload с диска |
| `subscribe-tasks` | Поток `tasks-updated` |
| `acquire-task-lock` / `release-task-lock` / `refresh-task-lock` | Блокировки |
| `archive-done-tasks` / `get-archived-tasks` / `restore-archived-task` / `delete-archived-task` | Архив |
| `get-task-history` / `add-task-comment` | История и комментарии |
| `get-task-types` / `save-task-types` / `subscribe-task-types` | Виды задач |
| `get-task-priorities` / `save-task-priorities` / `subscribe-task-priorities` | Приоритеты |
| `get-task-templates` / `save-task-templates` / `subscribe-task-templates` | Шаблоны |
| `get-reminder-settings` / `save-reminder-settings` | Напоминания |
| `get-chief-dashboard` / `get-overdue-tasks` | Начальник |
| `get-exchange-files` / `add-exchange-files` / `clear-exchange-files` / `remove-exchange-file` | Обмен |
| `open-task-file` / `open-exchange-file` | Открытие в ОС |

### События main → renderer

| Событие | Когда |
|---------|--------|
| `tasks-updated` | Изменился список активных задач |
| `task-types-updated` / `task-priorities-updated` / `task-templates-updated` | Справочники |
| `exchange-updated` | Обмен файлами |
| `room-sync-updated` | Изменение с другого ПК или после refresh (`RoomSyncEvent`) |
| `room-data-refreshed` | Завершён `refresh-room-sync` |
| `navigate` | Пункт меню «Вид» |
| `open-help` | F1 / клик по `?` (anchor id) |

### Типы для интеграции

- Доменные типы: `src/shared/types.ts`
- Результат сохранения задачи: `src/shared/syncEvents.ts` (`UpdateTaskResult`, `RoomSyncEvent`)
- Якоря справки: `src/shared/helpAnchors.ts`

При добавлении IPC: расширить `RoomKanbanApi`, реализацию в `preload/index.ts`, handler в `registerHandlers.ts`, при подписке — `windowSubscriptions.ts`.

---

## Совместимость и изменения схемы

При изменении формата `sync/tasks/*.json` или `room_state.json`:

1. Обновить `normalizeTask` / парсеры в соответствующих Store.
2. При несовместимости — одноразовая миграция по образцу `migrateFromBoardJson`.
3. Сохранять обратную совместимость чтения старых полей (`comment`, legacy `pc_*`).

---

*Документ соответствует кодовой базе RoomKanban / OficceHelper, версия приложения 0.1.0.*
