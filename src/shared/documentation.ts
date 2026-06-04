import type { ParsedDocumentation } from './helpMarkdown'

export type DocumentationKind = 'user' | 'technical'

export interface DocumentationBundle {
  user: ParsedDocumentation
  technical: ParsedDocumentation
}
