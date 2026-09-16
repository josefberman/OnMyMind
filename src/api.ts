import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  writeBatch,
  getDocs,
  type Unsubscribe,
} from 'firebase/firestore'
import { requireDb } from './firebase'
import {
  findNextCell,
  nextColor,
  cellKey,
  type ColorKey,
  type TodoItem,
  type TodoList,
} from './types'

function listsRef(uid: string) {
  return collection(requireDb(), 'users', uid, 'lists')
}

function itemsRef(uid: string, listId: string) {
  return collection(requireDb(), 'users', uid, 'lists', listId, 'items')
}

function mapList(id: string, data: Record<string, unknown>): TodoList {
  const order = typeof data.order === 'number' ? data.order : 0
  const hasCol = typeof data.col === 'number'
  const hasRow = typeof data.row === 'number'
  return {
    id,
    name: (data.name as string) || 'Untitled',
    color: data.color as ColorKey,
    order,
    col: hasCol ? (data.col as number) : order,
    row: hasRow ? (data.row as number) : 0,
    createdAt: (data.createdAt as number) || 0,
    updatedAt: (data.updatedAt as number) || 0,
  }
}

/** Ensure every list has a unique col/row (deployed site may only update `order`). */
function normalizeLayout(lists: TodoList[]): TodoList[] {
  const sorted = [...lists].sort((a, b) => a.order - b.order || a.createdAt - b.createdAt)
  const occupied = new Set<string>()
  return sorted.map((list) => {
    let { col, row } = list
    if (occupied.has(cellKey(col, row))) {
      const next = findNextCell(
        [...occupied].map((key) => {
          const [c, r] = key.split(',').map(Number)
          return { col: c, row: r }
        }),
      )
      col = next.col
      row = next.row
    }
    occupied.add(cellKey(col, row))
    return col === list.col && row === list.row ? list : { ...list, col, row }
  })
}

export function subscribeLists(
  uid: string,
  onData: (lists: TodoList[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(listsRef(uid), orderBy('order', 'asc'))
  return onSnapshot(
    q,
    (snap) => {
      const mapped = snap.docs.map((d) => mapList(d.id, d.data()))
      const normalized = normalizeLayout(mapped)
      onData(normalized)

      // Persist missing/colliding grid coords so local and deployed stay aligned
      const dirty = normalized.filter((list) => {
        const raw = mapped.find((m) => m.id === list.id)
        return !raw || raw.col !== list.col || raw.row !== list.row
      })
      if (dirty.length > 0) {
        const firestore = requireDb()
        const batch = writeBatch(firestore)
        const now = Date.now()
        dirty.forEach((list) => {
          batch.update(doc(firestore, 'users', uid, 'lists', list.id), {
            col: list.col,
            row: list.row,
            updatedAt: now,
          })
        })
        void batch.commit().catch(() => {
          /* non-fatal; UI already has normalized positions */
        })
      }
    },
    (err) => onError?.(err),
  )
}

export function subscribeItems(
  uid: string,
  listId: string,
  onData: (items: TodoItem[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(itemsRef(uid, listId), orderBy('order', 'asc'))
  return onSnapshot(
    q,
    (snap) => {
      const items: TodoItem[] = snap.docs.map((d) => {
        const data = d.data()
        return {
          id: d.id,
          text: data.text as string,
          done: Boolean(data.done),
          order: data.order as number,
          createdAt: data.createdAt as number,
        }
      })
      onData(items)
    },
    (err) => onError?.(err),
  )
}

export async function createList(
  uid: string,
  name: string,
  color: ColorKey,
  existing: TodoList[],
): Promise<string> {
  const now = Date.now()
  const order =
    existing.length === 0
      ? 0
      : Math.max(...existing.map((l) => l.order)) + 1
  const { col, row } = findNextCell(existing)
  const ref = await addDoc(listsRef(uid), {
    name: name.trim() || 'Untitled',
    color: color || nextColor(existing.map((l) => l.color)),
    order,
    col,
    row,
    createdAt: now,
    updatedAt: now,
  })
  return ref.id
}

export async function renameList(uid: string, listId: string, name: string) {
  await updateDoc(doc(requireDb(), 'users', uid, 'lists', listId), {
    name: name.trim() || 'Untitled',
    updatedAt: Date.now(),
  })
}

export async function updateListColor(
  uid: string,
  listId: string,
  color: ColorKey,
) {
  await updateDoc(doc(requireDb(), 'users', uid, 'lists', listId), {
    color,
    updatedAt: Date.now(),
  })
}

export async function deleteList(uid: string, listId: string) {
  const firestore = requireDb()
  const items = await getDocs(itemsRef(uid, listId))
  const batch = writeBatch(firestore)
  items.docs.forEach((d) => batch.delete(d.ref))
  batch.delete(doc(firestore, 'users', uid, 'lists', listId))
  await batch.commit()
}

/** Move a list to a grid cell; if occupied, swap with the other list. */
export async function moveList(
  uid: string,
  listId: string,
  col: number,
  row: number,
  lists: TodoList[],
) {
  const firestore = requireDb()
  const moving = lists.find((l) => l.id === listId)
  if (!moving) return
  const nextCol = Math.max(0, col)
  const nextRow = Math.max(0, row)
  if (moving.col === nextCol && moving.row === nextRow) return

  const occupant = lists.find(
    (l) => l.id !== listId && l.col === nextCol && l.row === nextRow,
  )
  const batch = writeBatch(firestore)
  const now = Date.now()
  batch.update(doc(firestore, 'users', uid, 'lists', listId), {
    col: nextCol,
    row: nextRow,
    updatedAt: now,
  })
  if (occupant) {
    batch.update(doc(firestore, 'users', uid, 'lists', occupant.id), {
      col: moving.col,
      row: moving.row,
      updatedAt: now,
    })
  }
  await batch.commit()
}

export async function addItem(
  uid: string,
  listId: string,
  text: string,
  openItems: TodoItem[],
) {
  const trimmed = text.trim()
  if (!trimmed) return
  const order =
    openItems.length === 0
      ? 0
      : Math.max(...openItems.map((i) => i.order)) + 1
  await addDoc(itemsRef(uid, listId), {
    text: trimmed,
    done: false,
    order,
    createdAt: Date.now(),
  })
}

export async function toggleItem(
  uid: string,
  listId: string,
  item: TodoItem,
  siblings: TodoItem[],
) {
  const nextDone = !item.done
  const group = siblings.filter((i) => i.done === nextDone && i.id !== item.id)
  const order =
    group.length === 0 ? 0 : Math.max(...group.map((i) => i.order)) + 1
  await updateDoc(
    doc(requireDb(), 'users', uid, 'lists', listId, 'items', item.id),
    {
      done: nextDone,
      order,
    },
  )
}

export async function deleteItem(uid: string, listId: string, itemId: string) {
  await deleteDoc(
    doc(requireDb(), 'users', uid, 'lists', listId, 'items', itemId),
  )
}

export async function reorderItems(
  uid: string,
  listId: string,
  orderedIds: string[],
) {
  const firestore = requireDb()
  const batch = writeBatch(firestore)
  orderedIds.forEach((id, index) => {
    batch.update(doc(firestore, 'users', uid, 'lists', listId, 'items', id), {
      order: index,
    })
  })
  await batch.commit()
}
