import { useEffect, useMemo, useRef, useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  COLOR_KEYS,
  COLORS,
  type ColorKey,
  type TodoItem,
  type TodoList,
} from '../types'

export function itemSortableId(itemId: string) {
  return `item:${itemId}`
}

export function parseItemSortableId(id: string): string | null {
  return id.startsWith('item:') ? id.slice(5) : null
}

export function listSortableId(listId: string) {
  return `list:${listId}`
}

export function parseListSortableId(id: string): string | null {
  return id.startsWith('list:') ? id.slice(5) : null
}

type Props = {
  list: TodoList
  items: TodoItem[]
  dragHandleProps: {
    attributes: ReturnType<typeof useSortable>['attributes']
    listeners: ReturnType<typeof useSortable>['listeners']
  }
  isDragging: boolean
  onRename: (name: string) => void
  onColor: (color: ColorKey) => void
  onDelete: () => void
  onAddItem: (text: string) => void
  onToggleItem: (item: TodoItem) => void
  onDeleteItem: (itemId: string) => void
  style?: React.CSSProperties
  setNodeRef?: (node: HTMLElement | null) => void
}

export default function ListColumn({
  list,
  items,
  dragHandleProps,
  isDragging,
  onRename,
  onColor,
  onDelete,
  onAddItem,
  onToggleItem,
  onDeleteItem,
  style,
  setNodeRef,
}: Props) {
  const [title, setTitle] = useState(list.name)
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [draft, setDraft] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)
  const addRef = useRef<HTMLInputElement>(null)

  useEffect(() => setTitle(list.name), [list.name])

  useEffect(() => {
    if (!menuOpen) return
    const onPointer = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) {
        setMenuOpen(false)
        setConfirmDelete(false)
      }
    }
    document.addEventListener('mousedown', onPointer)
    return () => document.removeEventListener('mousedown', onPointer)
  }, [menuOpen])

  const openItems = useMemo(
    () => items.filter((i) => !i.done).sort((a, b) => a.order - b.order),
    [items],
  )
  const doneItems = useMemo(
    () => items.filter((i) => i.done).sort((a, b) => a.order - b.order),
    [items],
  )

  const commitTitle = () => {
    const next = title.trim() || 'Untitled'
    setTitle(next)
    if (next !== list.name) onRename(next)
  }

  return (
    <article
      ref={setNodeRef}
      className={`list-column${isDragging ? ' is-dragging' : ''}`}
      style={{ ...style, ['--focus' as string]: COLORS[list.color] }}
    >
      <div
        className="list-header"
        style={{ background: COLORS[list.color] }}
        {...dragHandleProps.attributes}
        {...dragHandleProps.listeners}
      >
        <input
          className="list-title"
          value={title}
          aria-label="List name"
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur()
            }
            e.stopPropagation()
          }}
          onPointerDown={(e) => e.stopPropagation()}
        />
        <div className="menu-wrap" ref={menuRef}>
          <button
            type="button"
            className="menu-btn"
            aria-label="List menu"
            aria-expanded={menuOpen}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              setMenuOpen((v) => !v)
              setConfirmDelete(false)
            }}
          >
            ⋯
          </button>
          {menuOpen && (
            <div className="menu-popover" role="menu">
              <div className="color-dots" role="radiogroup" aria-label="List color">
                {COLOR_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={`color-dot${list.color === key ? ' is-selected' : ''}`}
                    style={{ background: COLORS[key] }}
                    role="radio"
                    aria-checked={list.color === key}
                    aria-label={key}
                    onClick={() => onColor(key)}
                  />
                ))}
              </div>
              {!confirmDelete ? (
                <button
                  type="button"
                  className="danger"
                  role="menuitem"
                  onClick={() => setConfirmDelete(true)}
                >
                  Delete list
                </button>
              ) : (
                <div className="confirm-row">
                  <button
                    type="button"
                    className="danger"
                    onClick={() => {
                      setMenuOpen(false)
                      onDelete()
                    }}
                  >
                    Delete {list.name}?
                  </button>
                  <button type="button" onClick={() => setConfirmDelete(false)}>
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="list-body">
        <SortableContext
          items={openItems.map((i) => itemSortableId(i.id))}
          strategy={verticalListSortingStrategy}
        >
          {openItems.map((item) => (
            <SortableItem
              key={item.id}
              item={item}
              listId={list.id}
              zone="open"
              onToggle={() => onToggleItem(item)}
              onDelete={() => onDeleteItem(item.id)}
            />
          ))}
        </SortableContext>

        {doneItems.length > 0 && (
          <SortableContext
            items={doneItems.map((i) => itemSortableId(i.id))}
            strategy={verticalListSortingStrategy}
          >
            {doneItems.map((item) => (
              <SortableItem
                key={item.id}
                item={item}
                listId={list.id}
                zone="done"
                onToggle={() => onToggleItem(item)}
                onDelete={() => onDeleteItem(item.id)}
              />
            ))}
          </SortableContext>
        )}
      </div>

      <form
        className="list-footer"
        onSubmit={(e) => {
          e.preventDefault()
          const text = draft
          setDraft('')
          onAddItem(text)
          requestAnimationFrame(() => addRef.current?.focus())
        }}
      >
        <input
          ref={addRef}
          className="add-item"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add an item…"
          aria-label={`Add item to ${list.name}`}
        />
      </form>
    </article>
  )
}

function SortableItem({
  item,
  listId,
  zone,
  onToggle,
  onDelete,
}: {
  item: TodoItem
  listId: string
  zone: 'open' | 'done'
  onToggle: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: itemSortableId(item.id),
      data: { type: 'item' as const, listId, itemId: item.id, zone },
    })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`item-row${item.done ? ' is-done' : ''}${isDragging ? ' is-dragging' : ''}`}
    >
      <button
        type="button"
        className="drag-handle"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripIcon />
      </button>
      <button
        type="button"
        className={`item-check${item.done ? ' is-checked' : ''}`}
        aria-label={item.done ? 'Mark as open' : 'Mark as done'}
        onClick={onToggle}
      >
        {item.done && <CheckIcon />}
      </button>
      <span className="item-text">{item.text}</span>
      <button
        type="button"
        className="item-delete"
        aria-label="Delete item"
        onClick={onDelete}
      >
        <TrashIcon />
      </button>
    </div>
  )
}

function GripIcon() {
  return (
    <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden>
      <circle cx="2" cy="2" r="1.5" />
      <circle cx="8" cy="2" r="1.5" />
      <circle cx="2" cy="8" r="1.5" />
      <circle cx="8" cy="8" r="1.5" />
      <circle cx="2" cy="14" r="1.5" />
      <circle cx="8" cy="14" r="1.5" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M2.5 6.5 4.8 9 9.5 3.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M2 4h10M5 4V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1m1 0v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4h6Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
