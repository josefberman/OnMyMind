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
import { nextColor, type ColorKey, type TodoItem, type TodoList } from './types'

function listsRef(uid: string) {
  return collection(requireDb(), 'users', uid, 'lists')
}

function itemsRef(uid: string, listId: string) {
  return collection(requireDb(), 'users', uid, 'lists', listId, 'items')
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
      const lists: TodoList[] = snap.docs.map((d) => {
        const data = d.data()
        return {
          id: d.id,
          name: data.name as string,
          color: data.color as ColorKey,
          order: data.order as number,
          createdAt: data.createdAt as number,
          updatedAt: data.updatedAt as number,
        }
      })
      onData(lists)
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
  const ref = await addDoc(listsRef(uid), {
    name: name.trim() || 'Untitled',
    color: color || nextColor(existing.map((l) => l.color)),
    order,
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

export async function reorderLists(uid: string, orderedIds: string[]) {
  const firestore = requireDb()
  const batch = writeBatch(firestore)
  orderedIds.forEach((id, index) => {
    batch.update(doc(firestore, 'users', uid, 'lists', id), {
      order: index,
      updatedAt: Date.now(),
    })
  })
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
