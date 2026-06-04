export interface DocSection {
  id: string
  title: string
  level: number
  content: string
}

export interface ParsedDocumentation {
  title: string
  sections: DocSection[]
}

const HEADING_ANCHOR_RE = /\s*\{#([a-z0-9-]+)\}\s*$/i

/** Парсинг USER_GUIDE / README: заголовки `## … {#id}` и `### … {#id}`. */
export function parseDocumentationMarkdown(markdown: string): ParsedDocumentation {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  let title = 'Справка'
  const sections: DocSection[] = []
  let current: DocSection | null = null
  const contentLines: string[] = []

  function flush() {
    if (!current) return
    current.content = contentLines.join('\n').trim()
    sections.push(current)
    contentLines.length = 0
  }

  for (const line of lines) {
    const h1 = line.match(/^#\s+(.+)$/)
    const h2 = line.match(/^##\s+(.+)$/)
    const h3 = line.match(/^###\s+(.+)$/)

    if (h1 && !h2 && !line.startsWith('##')) {
      title = stripAnchor(h1[1]).trim()
      continue
    }

    if (h2) {
      flush()
      const parsed = parseHeading(h2[1], 2)
      current = parsed
      continue
    }

    if (h3) {
      flush()
      const parsed = parseHeading(h3[1], 3)
      current = parsed
      continue
    }

    if (line.trim() === '---' && !current) continue
    if (line.match(/^-\s+\[/)) continue // skip TOC list in body until section

    contentLines.push(line)
  }
  flush()

  return { title, sections: sections.filter((s) => s.id && s.title) }
}

function parseHeading(raw: string, level: number): DocSection {
  const anchorMatch = raw.match(HEADING_ANCHOR_RE)
  const id = anchorMatch ? anchorMatch[1] : slugifyHeading(stripAnchor(raw))
  const title = stripAnchor(raw).trim()
  return { id, title, level, content: '' }
}

function stripAnchor(text: string): string {
  return text.replace(HEADING_ANCHOR_RE, '').trim()
}

function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80)
}
