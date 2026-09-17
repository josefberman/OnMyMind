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
  useDraggable,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
  type DragMoveEvent,
} from '@dnd-kit/core'
import {
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
import {
  COLORS,
  GRID_CELL_H,
  GRID_CELL_W,
  GRID_PAD_X,
  GRID_PAD_Y,
  cellPosition,
  findNextCell,
  type ColorKey,
  type TodoItem,
  type TodoList,
} from '../types'

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
  onMoveList: (listId: string, col: number, row: number) => void
  onAddItem: (listId: string, text: string) => void
  onToggleItem: (listId: string, item: TodoItem) => void
  onDeleteItem: (listId: string, itemId: string) => void
  onReorderItems: (listId: string, orderedIds: string[]) => void
}

type ActiveDrag =
  | {
      type: 'list'
      listId: string
      name: string
      color: ColorKey
      preview: string[]
      col: number
      row: number
    }
  | { type: 'item'; listId: string; itemId: string; text: string; done: boolean }
  | null

function snapCoord(origin: number, delta: number, cell: number) {
  return Math.max(0, Math.round(origin + delta / cell))
}

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
  onMoveList,
  onAddItem,
  onToggleItem,
  onDeleteItem,
  onReorderItems,
}: Props) {
  const [active, setActive] = useState<ActiveDrag>(null)
  const [snapHint, setSnapHint] = useState<{ col: number; row: number } | null>(
    null,
  )
  const [itemOrderOverride, setItemOrderOverride] = useState<Record<
    string,
    TodoItem[]
  > | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const itemsFor = (listId: string) =>
    itemOrderOverride?.[listId] ?? itemsByList[listId] ?? []

  const layoutExtent = useMemo(() => {
    const cols = lists.map((l) => l.col)
    const rows = lists.map((l) => l.row)
    if (snapHint) {
      cols.push(snapHint.col)
      rows.push(snapHint.row)
    }
    const ghostCell = findNextCell(lists)
    cols.push(ghostCell.col)
    rows.push(ghostCell.row)
    const maxCol = Math.max(2, ...cols) + 1
    const maxRow = Math.max(1, ...rows) + 1
    return {
      width: GRID_PAD_X * 2 + maxCol * GRID_CELL_W,
      height: GRID_PAD_Y * 2 + maxRow * GRID_CELL_H,
      ghostCell,
    }
  }, [lists, snapHint])

  const onDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id)
    const listIdFromId = parseListSortableId(id)
    const itemIdFromId = parseItemSortableId(id)

    if (listIdFromId || event.active.data.current?.type === 'list') {
      const listId =
        listIdFromId ?? (event.active.data.current?.listId as string | undefined)
      const list = lists.find((l) => l.id === listId)
      if (!list) return
      const preview = (itemsByList[list.id] ?? [])
        .filter((i) => !i.done)
        .sort((a, b) => a.order - b.order)
        .slice(0, 4)
        .map((i) => i.text)
      setActive({
        type: 'list',
        listId: list.id,
        name: list.name,
        color: list.color,
        preview,
        col: list.col,
        row: list.row,
      })
      setSnapHint({ col: list.col, row: list.row })
      return
    }

    if (itemIdFromId || event.active.data.current?.type === 'item') {
      const itemId =
        itemIdFromId ?? (event.active.data.current?.itemId as string | undefined)
      const listId = event.active.data.current?.listId as string | undefined
      if (!itemId || !listId) return
      const item = (itemsByList[listId] ?? []).find((i) => i.id === itemId)
      if (!item) return
      setActive({
        type: 'item',
        listId,
        itemId,
        text: item.text,
        done: item.done,
      })
      setItemOrderOverride({ ...itemsByList })
    }
  }

  const onDragMove = (event: DragMoveEvent) => {
    if (event.active.data.current?.type !== 'list') return
    const listId = parseListSortableId(String(event.active.id))
    const list = lists.find((l) => l.id === listId)
    if (!list) return
    setSnapHint({
      col: snapCoord(list.col, event.delta.x, GRID_CELL_W),
      row: snapCoord(list.row, event.delta.y, GRID_CELL_H),
    })
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
    const { active: a } = event
    const dragType = a.data.current?.type
    const delta = event.delta
    setActive(null)
    setSnapHint(null)

    if (dragType === 'list') {
      const listId = parseListSortableId(String(a.id))
      const list = lists.find((l) => l.id === listId)
      if (!list) return
      const col = snapCoord(list.col, delta.x, GRID_CELL_W)
      const row = snapCoord(list.row, delta.y, GRID_CELL_H)
      onMoveList(list.id, col, row)
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
    setSnapHint(null)
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
        onDragMove={onDragMove}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        <div
          className={`board board-grid${active?.type === 'list' ? ' is-dragging-list' : ''}${active ? ' is-dragging' : ''}`}
          style={{
            width: layoutExtent.width,
            minHeight: layoutExtent.height,
          }}
        >
          {active?.type === 'list' && snapHint && (
            <div
              className="grid-snap-hint"
              style={cellPosition(snapHint.col, snapHint.row)}
              aria-hidden
            />
          )}

          {lists.map((list) => (
            <DraggableListColumn
              key={list.id}
              list={list}
              items={itemsFor(list.id)}
              isDragSource={active?.type === 'list' && active.listId === list.id}
              onRename={(name) => onRenameList(list.id, name)}
              onColor={(color) => onColorList(list.id, color)}
              onDelete={() => onDeleteList(list.id)}
              onAddItem={(text) => onAddItem(list.id, text)}
              onToggleItem={(item) => onToggleItem(list.id, item)}
              onDeleteItem={(itemId) => onDeleteItem(list.id, itemId)}
            />
          ))}

          <div
            className="ghost-slot"
            style={cellPosition(
              layoutExtent.ghostCell.col,
              layoutExtent.ghostCell.row,
            )}
          >
            <NewListGhost
              lists={lists}
              open={ghostOpen}
              onOpen={onGhostOpen}
              onClose={onGhostClose}
              onCreate={onCreateList}
            />
          </div>
        </div>

        <DragOverlay dropAnimation={null} style={{ zIndex: 1000 }}>
          {active?.type === 'list' ? (
            <div className="list-column-ghost">
              <div
                className="list-header"
                style={{ background: COLORS[active.color] }}
              >
                <span className="list-title" style={{ cursor: 'grabbing' }}>
                  {active.name}
                </span>
              </div>
              <div className="list-body">
                {active.preview.length === 0 ? (
                  <div className="item-row" style={{ color: 'var(--muted)' }}>
                    Empty list
                  </div>
                ) : (
                  active.preview.map((text, i) => (
                    <div key={`${i}-${text}`} className="item-row">
                      <span className="item-text">{text}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}
          {active?.type === 'item' ? (
            <div
              className={`item-row item-row-ghost${active.done ? ' is-done' : ''}`}
            >
              <span className="drag-handle" aria-hidden>
                ⠿
              </span>
              <span className="item-text">{active.text}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

function DraggableListColumn({
  list,
  items,
  isDragSource,
  onRename,
  onColor,
  onDelete,
  onAddItem,
  onToggleItem,
  onDeleteItem,
}: {
  list: TodoList
  items: TodoItem[]
  isDragSource: boolean
  onRename: (name: string) => void
  onColor: (color: ColorKey) => void
  onDelete: () => void
  onAddItem: (text: string) => void
  onToggleItem: (item: TodoItem) => void
  onDeleteItem: (itemId: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: listSortableId(list.id),
      data: { type: 'list' as const, listId: list.id },
    })

  const pos = cellPosition(list.col, list.row)
  const style: React.CSSProperties = {
    position: 'absolute',
    left: pos.left,
    top: pos.top,
    width: 'var(--col-width)',
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging || isDragSource ? 5 : 1,
  }

  // Item SortableContexts live inside ListColumn; list uses useDraggable only.
  return (
    <div ref={setNodeRef} style={style} className="list-slot">
      <ListColumn
        list={list}
        items={items}
        isDragging={isDragging || isDragSource}
        dragHandleProps={{ attributes, listeners }}
        onRename={onRename}
        onColor={onColor}
        onDelete={onDelete}
        onAddItem={onAddItem}
        onToggleItem={onToggleItem}
        onDeleteItem={onDeleteItem}
      />
    </div>
  )
}
