// Maps consumer-facing boardId → internal DB key (set during indexer init)
// The genesis board was seeded with id='hood' and must not change in the DB.
// All new routes use 'genesis'; this layer resolves that transparently.
const ALIASES: Record<string, string> = {
  genesis: 'hood',
}

export function resolveBoard(boardId: string): string {
  return ALIASES[boardId] ?? boardId
}
