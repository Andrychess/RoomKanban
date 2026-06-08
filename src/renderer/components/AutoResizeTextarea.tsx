import { useCallback, useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react'

interface Props extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string
  minRows?: number
  maxRows?: number
}

export default function AutoResizeTextarea({
  value,
  minRows = 3,
  maxRows = 16,
  className = '',
  onChange,
  ...rest
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)

  const adjustHeight = useCallback(() => {
    const el = ref.current
    if (!el) return

    el.style.height = 'auto'
    const styles = getComputedStyle(el)
    const lineHeight = parseFloat(styles.lineHeight) || 22
    const padding =
      parseFloat(styles.paddingTop) +
      parseFloat(styles.paddingBottom) +
      parseFloat(styles.borderTopWidth) +
      parseFloat(styles.borderBottomWidth)
    const minHeight = lineHeight * minRows + padding
    const maxHeight = lineHeight * maxRows + padding
    const nextHeight = Math.min(Math.max(el.scrollHeight, minHeight), maxHeight)

    el.style.height = `${nextHeight}px`
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }, [minRows, maxRows])

  useLayoutEffect(() => {
    adjustHeight()
  }, [value, adjustHeight])

  return (
    <textarea
      ref={ref}
      value={value}
      className={`auto-resize-textarea ${className}`.trim()}
      rows={minRows}
      onChange={(e) => {
        onChange?.(e)
        requestAnimationFrame(adjustHeight)
      }}
      {...rest}
    />
  )
}
