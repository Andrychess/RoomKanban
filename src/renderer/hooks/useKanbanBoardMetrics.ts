import { useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react'

export interface KanbanBoardMetrics {
  boardHeight: number
  columnWidth: number
  matrixRows: number
  matrixCellHeight: number
}

const BOTTOM_GAP = 12
const COLUMN_GAP = 14
const MATRIX_GAP = 12
const MATRIX_COLUMNS = 3
const MIN_COLUMN_WIDTH = 180
const MIN_BOARD_HEIGHT = 240
const MIN_CELL_HEIGHT = 200

function readBoardWidth(root: HTMLElement): number {
  const boardScroll = root.querySelector<HTMLElement>('.kanban-board-scroll')
  const boardHost = root.querySelector<HTMLElement>('.employee-board-others-scroll')
  const source = boardScroll ?? boardHost ?? root
  return Math.floor(source.getBoundingClientRect().width)
}

function readMatrixWidth(root: HTMLElement): number {
  const matrix = root.querySelector<HTMLElement>('.employee-board-matrix')
  return matrix ? Math.floor(matrix.getBoundingClientRect().width) : readBoardWidth(root)
}

export function useKanbanBoardMetrics(
  rootRef: RefObject<HTMLElement | null>,
  options: {
    columnCount: number
    matrixItemCount?: number
  }
): { metrics: KanbanBoardMetrics | null; style: CSSProperties | undefined } {
  const { columnCount, matrixItemCount = 0 } = options
  const [metrics, setMetrics] = useState<KanbanBoardMetrics | null>(() => {
    if (typeof window === 'undefined') return null
    const boardHeight = Math.max(MIN_BOARD_HEIGHT, Math.floor(window.innerHeight - 220))
    return {
      boardHeight,
      columnWidth: MIN_COLUMN_WIDTH,
      matrixRows: 1,
      matrixCellHeight: boardHeight
    }
  })

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return

    const measure = () => {
      const anchor = root.querySelector<HTMLElement>('[data-board-anchor]')
      if (!anchor) return

      const top = anchor.getBoundingClientRect().top
      const boardHeight = Math.max(
        MIN_BOARD_HEIGHT,
        Math.floor(window.innerHeight - top - BOTTOM_GAP)
      )

      const boardWidth = readBoardWidth(root)
      const columnWidth = Math.max(
        MIN_COLUMN_WIDTH,
        Math.floor((boardWidth - COLUMN_GAP * Math.max(0, columnCount - 1)) / columnCount)
      )

      const matrixRows = Math.max(1, Math.ceil(matrixItemCount / MATRIX_COLUMNS))
      const matrixWidth = readMatrixWidth(root)
      const matrixCellWidth = Math.max(
        MIN_COLUMN_WIDTH,
        Math.floor((matrixWidth - MATRIX_GAP * (MATRIX_COLUMNS - 1)) / MATRIX_COLUMNS)
      )
      const matrixCellHeight = Math.max(
        MIN_CELL_HEIGHT,
        Math.floor((boardHeight - MATRIX_GAP * Math.max(0, matrixRows - 1)) / matrixRows)
      )

      setMetrics({
        boardHeight,
        columnWidth: matrixItemCount > 0 ? matrixCellWidth : columnWidth,
        matrixRows,
        matrixCellHeight
      })
    }

    measure()

    const observer = new ResizeObserver(measure)
    observer.observe(root)
    const anchor = root.querySelector('[data-board-anchor]')
    if (anchor) observer.observe(anchor)
    const filters = root.querySelector('.kanban-filters-wrap')
    if (filters) observer.observe(filters)

    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [rootRef, columnCount, matrixItemCount])

  if (!metrics) {
    return { metrics: null, style: undefined }
  }

  return {
    metrics,
    style: {
      '--kanban-board-height': `${metrics.boardHeight}px`,
      '--kanban-column-width': `${metrics.columnWidth}px`,
      '--kanban-matrix-rows': String(metrics.matrixRows),
      '--kanban-matrix-cell-height': `${metrics.matrixCellHeight}px`
    } as CSSProperties
  }
}
