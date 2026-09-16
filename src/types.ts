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

export type TodoList = {
  id: string
  name: string
  color: ColorKey
  order: number
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
