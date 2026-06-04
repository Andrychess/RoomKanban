import { useEffect, useMemo, useRef, useState } from 'react'
import type { DocumentationBundle, DocumentationKind } from '../../shared/documentation'
import type { UserHelpAnchorId } from '../../shared/helpAnchors'
import type { ParsedDocumentation } from '../../shared/helpMarkdown'
import DocContent from './DocContent'

interface Props {
  bundle: DocumentationBundle | null
  loading: boolean
  error: string | null
  docKind: DocumentationKind
  anchor: UserHelpAnchorId | null
  onClose: () => void
  onReload: () => void
}

export default function DocumentationModal({
  bundle,
  loading,
  error,
  docKind: initialKind,
  anchor,
  onClose,
  onReload
}: Props) {
  const [docKind, setDocKind] = useState<DocumentationKind>(initialKind)
  const [activeAnchor, setActiveAnchor] = useState<string | null>(anchor)
  const [query, setQuery] = useState('')
  const bodyRef = useRef<HTMLDivElement>(null)

  const doc: ParsedDocumentation | null =
    docKind === 'user' ? (bundle?.user ?? null) : (bundle?.technical ?? null)

  useEffect(() => {
    setDocKind(initialKind)
  }, [initialKind])

  useEffect(() => {
    setActiveAnchor(anchor)
  }, [anchor, docKind])

  useEffect(() => {
    if (!activeAnchor || !bodyRef.current) return
    const el = bodyRef.current.querySelector(`#doc-${activeAnchor}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [activeAnchor, doc])

  useEffect(() => {
    const root = bodyRef.current
    if (!root) return
    const onClick = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest('a.doc-link-internal')
      if (!link) return
      e.preventDefault()
      const id = (link.getAttribute('href') ?? '').replace(/^#/, '')
      if (id) setActiveAnchor(id)
    }
    root.addEventListener('click', onClick)
    return () => root.removeEventListener('click', onClick)
  }, [doc])

  const toc = useMemo(() => {
    if (!doc) return []
    const q = query.trim().toLowerCase()
    return doc.sections.filter((s) => {
      if (s.level > 3) return false
      if (!q) return true
      return s.title.toLowerCase().includes(q) || s.content.toLowerCase().includes(q)
    })
  }, [doc, query])

  return (
    <div className="modal-overlay doc-modal-overlay" onClick={onClose}>
      <div
        className="modal card doc-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="doc-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="doc-modal-header">
          <div>
            <h2 id="doc-modal-title">Справка</h2>
            <p className="doc-modal-sub">
              «?» — краткая подсказка; клик по «?» — раздел «Как пользоваться». Схемы данных и сборка — вкладка
              «Техническая».
            </p>
          </div>
          <div className="doc-modal-header-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={onReload} disabled={loading}>
              Обновить
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
              Закрыть
            </button>
          </div>
        </header>

        <div className="doc-kind-tabs" role="tablist" aria-label="Тип документации">
          <button
            type="button"
            role="tab"
            aria-selected={docKind === 'user'}
            className={`doc-kind-tab ${docKind === 'user' ? 'active' : ''}`}
            onClick={() => {
              setDocKind('user')
              setActiveAnchor(null)
            }}
          >
            Как пользоваться
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={docKind === 'technical'}
            className={`doc-kind-tab ${docKind === 'technical' ? 'active' : ''}`}
            onClick={() => {
              setDocKind('technical')
              setActiveAnchor(null)
            }}
          >
            Техническая
          </button>
        </div>

        {loading && <p className="sub doc-modal-status">Загрузка документации…</p>}
        {error && (
          <div className="error doc-modal-status">
            {error}
            <button type="button" className="btn btn-sm" onClick={onReload}>
              Повторить
            </button>
          </div>
        )}

        {doc && !loading && (
          <div className="doc-modal-layout">
            <aside className="doc-toc">
              <p className="doc-toc-kind-label">
                {docKind === 'user'
                  ? 'Руководство для сотрудников'
                  : 'Для разработчиков и IT'}
              </p>
              <label className="doc-toc-search">
                <span className="sr-only">Поиск по справке</span>
                <input
                  type="search"
                  placeholder="Поиск в оглавлении…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <nav aria-label="Оглавление">
                <ul className="doc-toc-list">
                  {toc.map((section) => (
                    <li
                      key={section.id}
                      className={`doc-toc-item level-${section.level} ${activeAnchor === section.id ? 'is-active' : ''}`}
                    >
                      <button type="button" onClick={() => setActiveAnchor(section.id)}>
                        {section.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </nav>
            </aside>

            <div className="doc-body" ref={bodyRef}>
              <p className="doc-body-title">{doc.title}</p>
              {doc.sections.map((section) => (
                <section
                  key={section.id}
                  id={`doc-${section.id}`}
                  className={`doc-section level-${section.level} ${activeAnchor === section.id ? 'is-highlighted' : ''}`}
                >
                  {section.level === 2 ? (
                    <h2 className="doc-section-title">{section.title}</h2>
                  ) : (
                    <h3 className="doc-section-title">{section.title}</h3>
                  )}
                  {section.content ? <DocContent markdown={section.content} /> : null}
                </section>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
