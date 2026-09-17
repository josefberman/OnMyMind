export const COLORS = {
  blue: '#3B82F6',
  green: '#22C55E',
  orange: '#F59E0B',
  violet: '#8B5CF6',
  rose: '#F43F5E',
  teal: '#14B8A6',
} as const

export type ColorKey = keyof typeof COLORS

export const COLOR_KEYS = Object.keys(COLORS) as ColorKey[]

export function nextColor(used: ColorKey[]): ColorKey {
  for (const key of COLOR_KEYS) {
    if (!used.includes(key)) return key
  }
  return COLOR_KEYS[used.length % COLOR_KEYS.length]
}

/** List card width (matches --col-width). */
export const GRID_LIST_W = 320
/** Vertical space reserved for a list card. */
export const GRID_LIST_H = 400
/** Gap between cells. */
export const GRID_GAP = 20
/** Board padding — must match CSS. */
export const GRID_PAD_X = 20
export const GRID_PAD_Y = 24
/** Pixel stride between cell origins (list size + gap). */
export const GRID_CELL_W = GRID_LIST_W + GRID_GAP
export const GRID_CELL_H = GRID_LIST_H + GRID_GAP
/** Preferred wrap width when auto-placing new lists. */
export const GRID_WRAP_COLS = 8

export function cellPosition(col: number, row: number) {
  return {
    left: GRID_PAD_X + col * GRID_CELL_W,
    top: GRID_PAD_Y + row * GRID_CELL_H,
  }
}

export type TodoList = {
  id: string
  name: string
  color: ColorKey
  /** @deprecated kept for migration; layout uses col/row */
  order: number
  col: number
  row: number
  createdAt: number
  updatedAt: number
}

export type TodoItem = {
  id: string
  text: string
  done: boolean
  order: number
  createdAt: number
}

export function cellKey(col: number, row: number) {
  return `${col},${row}`
}

export function findNextCell(
  lists: Pick<TodoList, 'col' | 'row'>[],
  wrapCols = GRID_WRAP_COLS,
): { col: number; row: number } {
  const occupied = new Set(lists.map((l) => cellKey(l.col, l.row)))
  for (let i = 0; i < 10_000; i++) {
    const col = i % wrapCols
    const row = Math.floor(i / wrapCols)
    if (!occupied.has(cellKey(col, row))) return { col, row }
  }
  return { col: 0, row: lists.length }
}
