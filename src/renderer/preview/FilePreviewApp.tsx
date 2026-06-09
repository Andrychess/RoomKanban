import { useCallback, useEffect, useRef, useState } from 'react'
import './pdfPolyfills'
import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from 'pdfjs-dist'
import PdfWorker from './pdf.worker.entry?worker'
import type { FilePreviewPayload } from '../../shared/filePreview'

GlobalWorkerOptions.workerPort = new PdfWorker()

const MIN_ZOOM = 0.25
const MAX_ZOOM = 4
const DEFAULT_ZOOM = 1
const ZOOM_STEP = 0.25
const PDF_BASE_SCALE = 1.25

function clampPreviewZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value * 100) / 100))
}

function formatZoomPercent(zoom: number): string {
  return `${Math.round(zoom * 100)}%`
}

interface ZoomControlsProps {
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
  disabled?: boolean
}

function ZoomControls({ zoom, onZoomIn, onZoomOut, onZoomReset, disabled }: ZoomControlsProps) {
  return (
    <div className="file-preview-zoom-controls" aria-label="Масштаб">
      <button
        type="button"
        className="file-preview-zoom-btn"
        onClick={onZoomOut}
        disabled={disabled || zoom <= MIN_ZOOM}
        aria-label="Уменьшить"
        title="Уменьшить (Ctrl + −)"
      >
        −
      </button>
      <button
        type="button"
        className="file-preview-zoom-value"
        onClick={onZoomReset}
        disabled={disabled}
        title="Сбросить масштаб (Ctrl + 0)"
      >
        {formatZoomPercent(zoom)}
      </button>
      <button
        type="button"
        className="file-preview-zoom-btn"
        onClick={onZoomIn}
        disabled={disabled || zoom >= MAX_ZOOM}
        aria-label="Увеличить"
        title="Увеличить (Ctrl + +)"
      >
        +
      </button>
    </div>
  )
}

interface PdfViewerProps {
  dataBase64: string
  zoom: number
}

function PdfViewer({ dataBase64, zoom }: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setDoc(null)
    setPage(1)

    const binary = atob(dataBase64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

    void getDocument({ data: bytes }).promise
      .then((pdf) => {
        if (cancelled) return
        setDoc(pdf)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Не удалось открыть PDF')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [dataBase64])

  useEffect(() => {
    if (!doc || !canvasRef.current) return
    let cancelled = false

    void (async () => {
      const pdfPage = await doc.getPage(page)
      if (cancelled) return

      const viewport = pdfPage.getViewport({ scale: PDF_BASE_SCALE * zoom })
      const canvas = canvasRef.current!
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      canvas.width = viewport.width
      canvas.height = viewport.height
      await pdfPage.render({ canvasContext: ctx, viewport, canvas }).promise
    })()

    return () => {
      cancelled = true
    }
  }, [doc, page, zoom])

  if (loading) return <div className="file-preview-loading">Загрузка PDF…</div>
  if (error) {
    return (
      <div className="file-preview-fallback">
        <p className="file-preview-error">{error}</p>
      </div>
    )
  }
  if (!doc) return null

  return (
    <div className="file-preview-pdf">
      <div className="file-preview-pdf-toolbar">
        <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          ← Назад
        </button>
        <span>
          {page} / {doc.numPages}
        </span>
        <button
          type="button"
          disabled={page >= doc.numPages}
          onClick={() => setPage((p) => p + 1)}
        >
          Вперёд →
        </button>
      </div>
      <div className="file-preview-pdf-page">
        <canvas ref={canvasRef} className="file-preview-pdf-canvas" />
      </div>
    </div>
  )
}

function kindLabel(kind: FilePreviewPayload['kind']): string {
  switch (kind) {
    case 'text':
      return 'Текст'
    case 'image':
      return 'Изображение'
    case 'pdf':
      return 'PDF'
    default:
      return 'Файл'
  }
}

function supportsZoom(kind: FilePreviewPayload['kind']): boolean {
  return kind === 'text' || kind === 'image' || kind === 'pdf'
}

interface PreviewContentProps {
  payload: FilePreviewPayload
  zoom: number
}

function PreviewContent({ payload, zoom }: PreviewContentProps) {
  switch (payload.kind) {
    case 'text':
      return (
        <div className="file-preview-zoom-surface" style={{ zoom }}>
          <pre className="file-preview-text">{payload.text}</pre>
        </div>
      )
    case 'image':
      return (
        <div className="file-preview-image-wrap file-preview-zoom-surface" style={{ zoom }}>
          <img className="file-preview-image" src={payload.dataUrl} alt={payload.fileName} />
        </div>
      )
    case 'pdf':
      return <PdfViewer dataBase64={payload.dataBase64} zoom={zoom} />
    case 'unsupported':
      return (
        <div className="file-preview-fallback">
          <p>{payload.reason ?? 'Этот тип файла нельзя просмотреть в приложении.'}</p>
          <button
            type="button"
            className="file-preview-open-btn"
            onClick={() => void window.previewApi.openExternal(payload.filePath)}
          >
            Открыть в программе
          </button>
        </div>
      )
  }
}

export function FilePreviewApp() {
  const [payload, setPayload] = useState<FilePreviewPayload | null>(null)
  const [zoom, setZoom] = useState(DEFAULT_ZOOM)
  const bodyRef = useRef<HTMLElement>(null)

  const zoomIn = useCallback(
    () => setZoom((value) => clampPreviewZoom(value + ZOOM_STEP)),
    []
  )
  const zoomOut = useCallback(
    () => setZoom((value) => clampPreviewZoom(value - ZOOM_STEP)),
    []
  )
  const zoomReset = useCallback(() => setZoom(DEFAULT_ZOOM), [])

  useEffect(() => {
    return window.previewApi.onInit((data) => {
      setPayload(data)
      setZoom(DEFAULT_ZOOM)
      document.title = `Просмотр — ${data.fileName}`
    })
  }, [])

  useEffect(() => {
    if (!payload || !supportsZoom(payload.kind)) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey) return
      if (event.key === '=' || event.key === '+') {
        event.preventDefault()
        zoomIn()
      } else if (event.key === '-') {
        event.preventDefault()
        zoomOut()
      } else if (event.key === '0') {
        event.preventDefault()
        zoomReset()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [payload, zoomIn, zoomOut, zoomReset])

  useEffect(() => {
    if (!payload || !supportsZoom(payload.kind)) return
    const element = bodyRef.current
    if (!element) return

    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return
      event.preventDefault()
      setZoom((value) =>
        clampPreviewZoom(value + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP))
      )
    }

    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [payload])

  if (!payload) {
    return <div className="file-preview file-preview-loading">Загрузка…</div>
  }

  const zoomEnabled = supportsZoom(payload.kind)

  return (
    <div className="file-preview">
      <header className="file-preview-header">
        <span className="file-preview-title" title={payload.fileName}>
          {payload.fileName}
        </span>
        <span className="file-preview-badge">{kindLabel(payload.kind)} · только просмотр</span>
        {zoomEnabled && (
          <ZoomControls
            zoom={zoom}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onZoomReset={zoomReset}
          />
        )}
        <button
          type="button"
          className="file-preview-open-btn"
          onClick={() => void window.previewApi.openExternal(payload.filePath)}
        >
          Открыть в программе
        </button>
      </header>
      <main ref={bodyRef} className="file-preview-body">
        <PreviewContent payload={payload} zoom={zoom} />
      </main>
    </div>
  )
}
