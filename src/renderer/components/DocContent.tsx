import type { ReactNode } from 'react'

/** Упрощённый рендер Markdown для справки (без внешних зависимостей). */
export default function DocContent({ markdown }: { markdown: string }) {
  const blocks = parseBlocks(markdown)
  return <div className="doc-content">{blocks}</div>
}

function parseBlocks(text: string): ReactNode[] {
  const lines = text.split('\n')
  const nodes: ReactNode[] = []
  let i = 0
  let key = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.startsWith('```')) {
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      i++
      nodes.push(
        <pre key={key++} className="doc-pre">
          <code>{codeLines.join('\n')}</code>
        </pre>
      )
      continue
    }

    if (line.startsWith('|')) {
      const tableLines: string[] = []
      while (i < lines.length && lines[i].startsWith('|')) {
        tableLines.push(lines[i])
        i++
      }
      nodes.push(renderTable(tableLines, key++))
      continue
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ''))
        i++
      }
      nodes.push(
        <ul key={key++} className="doc-ul">
          {items.map((item, idx) => (
            <li key={idx}>{inlineFormat(item)}</li>
          ))}
        </ul>
      )
      continue
    }

    if (!line.trim()) {
      i++
      continue
    }

    const para: string[] = []
    while (i < lines.length && lines[i].trim() && !lines[i].startsWith('|') && !/^[-*]\s+/.test(lines[i])) {
      para.push(lines[i])
      i++
    }
    nodes.push(
      <p key={key++} className="doc-p">
        {inlineFormat(para.join(' '))}
      </p>
    )
  }

  return nodes
}

function renderTable(lines: string[], key: number): ReactNode {
  const rows = lines
    .filter((l) => !/^\|[\s\-:|]+\|$/.test(l.trim()))
    .map((l) =>
      l
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim())
    )
  if (rows.length === 0) return null
  const [head, ...body] = rows
  return (
    <table key={key} className="doc-table">
      <thead>
        <tr>
          {head.map((cell, ci) => (
            <th key={ci}>{inlineFormat(cell)}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {body.map((row, ri) => (
          <tr key={ri}>
            {row.map((cell, ci) => (
              <td key={ci}>{inlineFormat(cell)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function inlineFormat(text: string): ReactNode {
  const parts: ReactNode[] = []
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g
  let last = 0
  let m: RegExpExecArray | null
  let k = 0

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    const token = m[0]
    if (token.startsWith('**')) {
      parts.push(<strong key={k++}>{token.slice(2, -2)}</strong>)
    } else if (token.startsWith('`')) {
      parts.push(<code key={k++} className="doc-code-inline">{token.slice(1, -1)}</code>)
    } else {
      const link = token.match(/\[([^\]]+)\]\(([^)]+)\)/)
      if (link) {
        const href = link[2]
        if (href.startsWith('#')) {
          parts.push(
            <a key={k++} href={href} className="doc-link-internal">
              {link[1]}
            </a>
          )
        } else {
          parts.push(
            <a key={k++} href={href} target="_blank" rel="noreferrer">
              {link[1]}
            </a>
          )
        }
      }
    }
    last = m.index + token.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts.length === 1 ? parts[0] : <>{parts}</>
}
