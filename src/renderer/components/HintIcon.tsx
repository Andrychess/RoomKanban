import type { ReactNode } from 'react'
import { hintDocAnchor, type HintTopicKey } from '../../shared/helpAnchors'
import { HINT_SHORT } from '../hints/uiHints'
import { useHelp } from '../context/HelpContext'

interface HintIconProps {
  topic: HintTopicKey
  className?: string
}

/** Иконка «?»: наведение — кратко, клик — справка с оглавлением. */
export default function HintIcon({ topic, className }: HintIconProps) {
  const { openHelp } = useHelp()
  const text = HINT_SHORT[topic]
  const anchor = hintDocAnchor(topic)

  return (
    <span className={`ui-hint ${className ?? ''}`}>
      <button
        type="button"
        className="ui-hint-trigger"
        aria-label={`${text}. Нажмите, чтобы открыть справку.`}
        title="Нажмите — открыть раздел в справке"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          openHelp(anchor)
        }}
      >
        ?
      </button>
      <span className="ui-hint-bubble" role="tooltip">
        {text}
        <span className="ui-hint-bubble-more">Нажмите ? — полная справка</span>
      </span>
    </span>
  )
}

interface HintLabelProps {
  children: ReactNode
  topic: HintTopicKey
  className?: string
}

export function HintLabel({ children, topic, className }: HintLabelProps) {
  return (
    <span className={`hint-label ${className ?? ''}`}>
      {children}
      <HintIcon topic={topic} />
    </span>
  )
}
