import { useEffect, useRef, useState } from 'react'
import { COLOR_KEYS, COLORS, nextColor, type ColorKey, type TodoList } from '../types'

type Props = {
  lists: TodoList[]
  open: boolean
  onOpen: () => void
  onClose: () => void
  onCreate: (name: string, color: ColorKey) => void
}

export default function NewListGhost({
  lists,
  open,
  onOpen,
  onClose,
  onCreate,
}: Props) {
  const [name, setName] = useState('')
  const [color, setColor] = useState<ColorKey>(() =>
    nextColor(lists.map((l) => l.color)),
  )
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setName('')
      setColor(nextColor(lists.map((l) => l.color)))
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open, lists])

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) {
      inputRef.current?.focus()
      return
    }
    onCreate(trimmed, color)
    onClose()
  }

  return (
    <div className={`ghost-column${open ? ' is-open' : ''}`}>
      {!open ? (
        <button type="button" className="ghost-prompt" onClick={onOpen}>
          <PlusLarge />
          New list
        </button>
      ) : (
        <form
          className="ghost-form"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="List name"
            aria-label="List name"
          />
          <div className="color-dots" role="radiogroup" aria-label="List color">
            {COLOR_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                className={`color-dot${color === key ? ' is-selected' : ''}`}
                style={{ background: COLORS[key] }}
                aria-label={key}
                aria-checked={color === key}
                role="radio"
                onClick={() => setColor(key)}
              />
            ))}
          </div>
          <div className="ghost-actions">
            <button type="submit" className="btn-pill">
              Create
            </button>
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

function PlusLarge() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
      <path
        d="M14 6v16M6 14h16"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  )
}
