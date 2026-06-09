import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  className?: string
  bodyClassName?: string
}

/** Область с фиксированной высотой и вертикальной прокруткой списка внутри столбца */
export default function ColumnScrollFrame({ children, className, bodyClassName }: Props) {
  const frameClass = ['column-scroll-frame', className].filter(Boolean).join(' ')
  const bodyClass = ['column-scroll-body', bodyClassName].filter(Boolean).join(' ')

  return (
    <div className={frameClass}>
      <div className={bodyClass}>{children}</div>
    </div>
  )
}
