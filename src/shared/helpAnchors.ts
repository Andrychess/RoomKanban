/** Якоря в руководстве пользователя (`docs/USER_GUIDE.md`). */
export const USER_HELP_ANCHORS = {
  overview: 'обзор',
  features: 'возможности',
  install: 'установка-программы',
  quickstart: 'быстрый-старт',
  roles: 'роли-начальник-и-сотрудники',
  sections: 'разделы-приложения',
  kanban: 'канбан-и-задачи',
  dueDateTime: 'срок-дата-и-время',
  filters: 'фильтры-и-поиск',
  viewEdit: 'подробнее-и-редактирование',
  archive: 'архив-задач',
  exchange: 'обмен-файлами',
  security: 'безопасность-и-пароли',
  reminders: 'напоминания-о-сроках',
  overdue: 'просроченные-задачи',
  theme: 'тема-оформления',
  syncRefresh: 'обновить-синхронизацию',
  hints: 'подсказки-и-справка',
  faq: 'частые-вопросы',
  troubleshooting: 'решение-проблем',
  deploy: 'советы-по-работе-в-офисе',
  limits: 'ограничения'
} as const

/** Якоря в технической документации (`docs/TECHNICAL.md`). */
export const TECH_HELP_ANCHORS = {
  overview: 'обзор-технический',
  requirements: 'требования-разработки',
  devInstall: 'установка-для-разработки',
  build: 'сборка',
  folderStructure: 'структура-папки-комнаты',
  appSettings: 'настройки-приложения',
  sync: 'синхронизация-технически',
  dev: 'структура-проекта',
  scripts: 'скрипты-npm',
  api: 'api-приложения',
  dataFormats: 'форматы-данных'
} as const

export type UserHelpAnchorId = (typeof USER_HELP_ANCHORS)[keyof typeof USER_HELP_ANCHORS]
export type TechHelpAnchorId = (typeof TECH_HELP_ANCHORS)[keyof typeof TECH_HELP_ANCHORS]

/** Ключи подсказок «?» в интерфейсе → раздел руководства пользователя. */
export const HINT_DOC_MAP = {
  'tabs.kanban': USER_HELP_ANCHORS.kanban,
  'tabs.kanbanByEmployee': USER_HELP_ANCHORS.kanban,
  'tabs.calendar': USER_HELP_ANCHORS.sections,
  'tabs.team': USER_HELP_ANCHORS.roles,
  'tabs.exchange': USER_HELP_ANCHORS.exchange,
  'tabs.archive': USER_HELP_ANCHORS.archive,
  'tabs.dashboard': USER_HELP_ANCHORS.sections,
  'tabs.overdue': USER_HELP_ANCHORS.overdue,
  'roomBar.sync': USER_HELP_ANCHORS.syncRefresh,
  'roomBar.leave': USER_HELP_ANCHORS.sections,
  'kanban.newTask': USER_HELP_ANCHORS.kanban,
  'kanban.overdue': USER_HELP_ANCHORS.overdue,
  'kanban.labels': USER_HELP_ANCHORS.kanban,
  'kanban.filterToggle': USER_HELP_ANCHORS.filters,
  'kanban.columnAdd': USER_HELP_ANCHORS.kanban,
  'kanban.columnArchive': USER_HELP_ANCHORS.archive,
  'kanban.columnCount': USER_HELP_ANCHORS.filters,
  'kanban.columnCollapse': USER_HELP_ANCHORS.kanban,
  'kanban.columnExpand': USER_HELP_ANCHORS.kanban,
  'kanban.dragHint': USER_HELP_ANCHORS.kanban,
  'filters.search': USER_HELP_ANCHORS.filters,
  'filters.type': USER_HELP_ANCHORS.filters,
  'filters.ownership': USER_HELP_ANCHORS.filters,
  'filters.reset': USER_HELP_ANCHORS.filters,
  'taskCard.details': USER_HELP_ANCHORS.viewEdit,
  'taskCard.edit': USER_HELP_ANCHORS.viewEdit,
  'taskCard.status': USER_HELP_ANCHORS.kanban,
  'taskCard.collapse': USER_HELP_ANCHORS.kanban,
  'taskCard.expand': USER_HELP_ANCHORS.kanban,
  'taskEditor.delete': USER_HELP_ANCHORS.kanban,
  'calendar.addDay': USER_HELP_ANCHORS.dueDateTime,
  'calendar.noDue': USER_HELP_ANCHORS.dueDateTime,
  'calendar.overdueLegend': USER_HELP_ANCHORS.overdue,
  'archive.restore': USER_HELP_ANCHORS.archive,
  'archive.delete': USER_HELP_ANCHORS.archive,
  'archive.open': USER_HELP_ANCHORS.viewEdit,
  'exchange.add': USER_HELP_ANCHORS.exchange,
  'exchange.clear': USER_HELP_ANCHORS.exchange,
  'exchange.open': USER_HELP_ANCHORS.exchange,
  'exchange.remove': USER_HELP_ANCHORS.exchange,
  'dashboard.overdueCard': USER_HELP_ANCHORS.overdue,
  'dashboard.noDue': USER_HELP_ANCHORS.dueDateTime,
  'dashboard.stuck': USER_HELP_ANCHORS.sections,
  'dashboard.workload': USER_HELP_ANCHORS.sections,
  'reminders.days': USER_HELP_ANCHORS.reminders,
  'reminders.assignee': USER_HELP_ANCHORS.reminders,
  'reminders.chief': USER_HELP_ANCHORS.reminders
} as const

export type HintTopicKey = keyof typeof HINT_DOC_MAP

export function hintDocAnchor(topic: HintTopicKey): UserHelpAnchorId {
  return HINT_DOC_MAP[topic]
}
