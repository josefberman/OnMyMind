import { useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  sortableKeyboardCoordinates,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import ListColumn from './ListColumn'
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
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const ids = useMemo(() => lists.map((l) => l.id), [lists])
  const activeList = lists.find((l) => l.id === activeId) ?? null

  const onDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }

  const onDragEnd = (event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = ids.indexOf(String(active.id))
    const newIndex = ids.indexOf(String(over.id))
    if (oldIndex < 0 || newIndex < 0) return
    const next = arrayMove(ids, oldIndex, newIndex)
    onReorderLists(next)
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
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className={`board${activeId ? ' is-dragging' : ''}`}>
          <SortableContext items={ids} strategy={horizontalListSortingStrategy}>
            {lists.map((list) => (
              <SortableListColumn
                key={list.id}
                list={list}
                items={itemsByList[list.id] ?? []}
                onRename={(name) => onRenameList(list.id, name)}
                onColor={(color) => onColorList(list.id, color)}
                onDelete={() => onDeleteList(list.id)}
                onAddItem={(text) => onAddItem(list.id, text)}
                onToggleItem={(item) => onToggleItem(list.id, item)}
                onDeleteItem={(itemId) => onDeleteItem(list.id, itemId)}
                onReorderItems={(orderedIds) =>
                  onReorderItems(list.id, orderedIds)
                }
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
  onReorderItems,
}: {
  list: TodoList
  items: TodoItem[]
  onRename: (name: string) => void
  onColor: (color: ColorKey) => void
  onDelete: () => void
  onAddItem: (text: string) => void
  onToggleItem: (item: TodoItem) => void
  onDeleteItem: (itemId: string) => void
  onReorderItems: (orderedIds: string[]) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: list.id })

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
      onReorderItems={onReorderItems}
    />
  )
}
