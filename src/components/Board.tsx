import { useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  sortableKeyboardCoordinates,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import ListColumn, {
  listSortableId,
  parseItemSortableId,
  parseListSortableId,
} from './ListColumn'
import NewListGhost from './NewListGhost'
import { COLORS, type ColorKey, type TodoItem, type TodoList } from '../types'

type Props = {
  lists: TodoList[]
  itemsByList: Record<string, TodoItem[]>
  ghostOpen: boolean
  onGhostOpen: () => void
  onGhostClose: () => void
  onCreateList: (name: string, color: ColorKey) => void
  onRenameList: (listId: string, name: string) => void
  onColorList: (listId: string, color: ColorKey) => void
  onDeleteList: (listId: string) => void
  onReorderLists: (orderedIds: string[]) => void
  onAddItem: (listId: string, text: string) => void
  onToggleItem: (listId: string, item: TodoItem) => void
  onDeleteItem: (listId: string, itemId: string) => void
  onReorderItems: (listId: string, orderedIds: string[]) => void
}

type ActiveDrag =
  | { type: 'list'; listId: string }
  | { type: 'item'; listId: string; itemId: string }
  | null

export default function Board({
  lists,
  itemsByList,
  ghostOpen,
  onGhostOpen,
  onGhostClose,
  onCreateList,
  onRenameList,
  onColorList,
  onDeleteList,
  onReorderLists,
  onAddItem,
  onToggleItem,
  onDeleteItem,
  onReorderItems,
}: Props) {
  const [active, setActive] = useState<ActiveDrag>(null)
  // Local item order while dragging so the UI moves immediately
  const [itemOrderOverride, setItemOrderOverride] = useState<Record<
    string,
    TodoItem[]
  > | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const listIds = useMemo(() => lists.map((l) => listSortableId(l.id)), [lists])
  const activeList =
    active?.type === 'list' ? lists.find((l) => l.id === active.listId) : null
  const activeItem =
    active?.type === 'item'
      ? (itemsByList[active.listId] ?? []).find((i) => i.id === active.itemId)
      : null

  const itemsFor = (listId: string) =>
    itemOrderOverride?.[listId] ?? itemsByList[listId] ?? []

  const onDragStart = (event: DragStartEvent) => {
    const type = event.active.data.current?.type
    if (type === 'list') {
      const listId = parseListSortableId(String(event.active.id))
      if (listId) setActive({ type: 'list', listId })
      return
    }
    if (type === 'item') {
      const itemId = parseItemSortableId(String(event.active.id))
      const listId = event.active.data.current?.listId as string | undefined
      if (itemId && listId) {
        setActive({ type: 'item', listId, itemId })
        setItemOrderOverride({ ...itemsByList })
      }
    }
  }

  const onDragOver = (event: DragOverEvent) => {
    const { active: a, over } = event
    if (!over || a.data.current?.type !== 'item') return

    const activeItemId = parseItemSortableId(String(a.id))
    const overItemId = parseItemSortableId(String(over.id))
    if (!activeItemId || !overItemId || activeItemId === overItemId) return

    const listId = a.data.current.listId as string
    const zone = a.data.current.zone as 'open' | 'done'
    const overZone = over.data.current?.zone as 'open' | 'done' | undefined
    if (over.data.current?.type !== 'item' || overZone !== zone) return
    if (over.data.current.listId !== listId) return

    setItemOrderOverride((prev) => {
      const source = prev ?? itemsByList
      const items = [...(source[listId] ?? [])]
      const zoneItems = items
        .filter((i) => (zone === 'done' ? i.done : !i.done))
        .sort((x, y) => x.order - y.order)
      const rest = items.filter((i) => (zone === 'done' ? !i.done : i.done))

      const oldIndex = zoneItems.findIndex((i) => i.id === activeItemId)
      const newIndex = zoneItems.findIndex((i) => i.id === overItemId)
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return prev

      const reordered = arrayMove(zoneItems, oldIndex, newIndex).map(
        (item, index) => ({ ...item, order: index }),
      )
      const merged =
        zone === 'open' ? [...reordered, ...rest] : [...rest, ...reordered]
      return { ...source, [listId]: merged }
    })
  }

  const onDragEnd = (event: DragEndEvent) => {
    const { active: a, over } = event
    const dragType = a.data.current?.type
    setActive(null)

    if (dragType === 'list') {
      if (!over) return
      const activeListId = parseListSortableId(String(a.id))
      const overListId =
        parseListSortableId(String(over.id)) ??
        (over.data.current?.listId as string | undefined)
      if (!activeListId || !overListId || activeListId === overListId) return
      const ids = lists.map((l) => l.id)
      const oldIndex = ids.indexOf(activeListId)
      const newIndex = ids.indexOf(overListId)
      if (oldIndex < 0 || newIndex < 0) return
      onReorderLists(arrayMove(ids, oldIndex, newIndex))
      return
    }

    if (dragType === 'item') {
      const listId = a.data.current?.listId as string
      const zone = a.data.current?.zone as 'open' | 'done'
      const override = itemOrderOverride?.[listId]
      setItemOrderOverride(null)
      if (!override) return

      const orderedIds = override
        .filter((i) => (zone === 'done' ? i.done : !i.done))
        .sort((x, y) => x.order - y.order)
        .map((i) => i.id)
      onReorderItems(listId, orderedIds)
    }
  }

  const onDragCancel = () => {
    setActive(null)
    setItemOrderOverride(null)
  }

  if (lists.length === 0 && !ghostOpen) {
    return (
      <div className="empty-board">
        <div>
          <h2>What’s on your mind?</h2>
          <p>Create your first list to get started.</p>
          <button type="button" className="btn-pill" onClick={onGhostOpen}>
            New list
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="board-area">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        <div className={`board${active ? ' is-dragging' : ''}`}>
          <SortableContext items={listIds} strategy={horizontalListSortingStrategy}>
            {lists.map((list) => (
              <SortableListColumn
                key={list.id}
                list={list}
                items={itemsFor(list.id)}
                onRename={(name) => onRenameList(list.id, name)}
                onColor={(color) => onColorList(list.id, color)}
                onDelete={() => onDeleteList(list.id)}
                onAddItem={(text) => onAddItem(list.id, text)}
                onToggleItem={(item) => onToggleItem(list.id, item)}
                onDeleteItem={(itemId) => onDeleteItem(list.id, itemId)}
              />
            ))}
          </SortableContext>

          <NewListGhost
            lists={lists}
            open={ghostOpen}
            onOpen={onGhostOpen}
            onClose={onGhostClose}
            onCreate={onCreateList}
          />
        </div>

        <DragOverlay dropAnimation={null}>
          {activeList ? (
            <div
              className="list-column is-dragging"
              style={{ width: 320, pointerEvents: 'none' }}
            >
              <div
                className="list-header"
                style={{ background: COLORS[activeList.color] }}
              >
                <span className="list-title" style={{ cursor: 'grabbing' }}>
                  {activeList.name}
                </span>
              </div>
              <div className="list-body" style={{ minHeight: 60 }} />
            </div>
          ) : null}
          {activeItem ? (
            <div
              className={`item-row is-dragging${activeItem.done ? ' is-done' : ''}`}
              style={{
                width: 280,
                pointerEvents: 'none',
                background: 'white',
                boxShadow: '0 10px 30px rgba(31,41,80,0.16)',
              }}
            >
              <span className="drag-handle" aria-hidden>
                ⠿
              </span>
              <span className="item-text">{activeItem.text}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

function SortableListColumn({
  list,
  items,
  onRename,
  onColor,
  onDelete,
  onAddItem,
  onToggleItem,
  onDeleteItem,
}: {
  list: TodoList
  items: TodoItem[]
  onRename: (name: string) => void
  onColor: (color: ColorKey) => void
  onDelete: () => void
  onAddItem: (text: string) => void
  onToggleItem: (item: TodoItem) => void
  onDeleteItem: (itemId: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: listSortableId(list.id),
    data: { type: 'list' as const, listId: list.id },
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  }

  return (
    <ListColumn
      list={list}
      items={items}
      setNodeRef={setNodeRef}
      style={style}
      isDragging={isDragging}
      dragHandleProps={{ attributes, listeners }}
      onRename={onRename}
      onColor={onColor}
      onDelete={onDelete}
      onAddItem={onAddItem}
      onToggleItem={onToggleItem}
      onDeleteItem={onDeleteItem}
    />
  )
}
