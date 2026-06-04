import type { ReactElement } from 'react'

interface Props {
  text: string
  children: ReactElement
  className?: string
}

/** Обёртка для кнопок и ссылок: подсказка при наведении (+ нативный title). */
export default function TooltipWrap({ text, children, className }: Props) {
  return (
    <span className={`ui-tooltip-wrap ${className ?? ''}`} title={text}>
      {children}
      <span className="ui-hint-bubble ui-tooltip-bubble" role="tooltip">
        {text}
      </span>
    </span>
  )
}
