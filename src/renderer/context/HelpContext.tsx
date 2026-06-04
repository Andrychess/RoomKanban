import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'
import type { DocumentationBundle, DocumentationKind } from '../../shared/documentation'
import type { UserHelpAnchorId } from '../../shared/helpAnchors'
import DocumentationModal from '../components/DocumentationModal'

interface HelpContextValue {
  bundle: DocumentationBundle | null
  loading: boolean
  error: string | null
  open: boolean
  docKind: DocumentationKind
  anchor: UserHelpAnchorId | null
  openHelp: (anchor?: UserHelpAnchorId | null, kind?: DocumentationKind) => void
  closeHelp: () => void
  reloadDoc: () => void
}

const HelpContext = createContext<HelpContextValue | null>(null)

export function HelpProvider({ children }: { children: ReactNode }) {
  const [bundle, setBundle] = useState<DocumentationBundle | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [docKind, setDocKind] = useState<DocumentationKind>('user')
  const [anchor, setAnchor] = useState<UserHelpAnchorId | null>(null)

  const loadDoc = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await window.api.getUserDocumentation()
      setBundle(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить справку')
      setBundle(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDoc()
  }, [loadDoc])

  const openHelp = useCallback(
    (nextAnchor?: UserHelpAnchorId | null, kind: DocumentationKind = 'user') => {
      setDocKind(kind)
      setAnchor(nextAnchor ?? null)
      setOpen(true)
      if (!bundle && !loading) void loadDoc()
    },
    [bundle, loading, loadDoc]
  )

  const closeHelp = useCallback(() => {
    setOpen(false)
  }, [])

  const value = useMemo(
    () => ({
      bundle,
      loading,
      error,
      open,
      docKind,
      anchor,
      openHelp,
      closeHelp,
      reloadDoc: () => void loadDoc()
    }),
    [bundle, loading, error, open, docKind, anchor, openHelp, closeHelp, loadDoc]
  )

  return (
    <HelpContext.Provider value={value}>
      {children}
      {open && (
        <DocumentationModal
          bundle={bundle}
          loading={loading}
          error={error}
          docKind={docKind}
          anchor={anchor}
          onClose={closeHelp}
          onReload={() => void loadDoc()}
        />
      )}
    </HelpContext.Provider>
  )
}

export function useHelp(): HelpContextValue {
  const ctx = useContext(HelpContext)
  if (!ctx) throw new Error('useHelp вне HelpProvider')
  return ctx
}
