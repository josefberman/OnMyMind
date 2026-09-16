import { useEffect, useRef, useState } from 'react'
import type { User } from 'firebase/auth'

type Props = {
  user: User
  onNewList: () => void
  onSignOut: () => void
}

export default function TopBar({ user, onNewList, onSignOut }: Props) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const initial =
    user.displayName?.charAt(0)?.toUpperCase() ||
    user.email?.charAt(0)?.toUpperCase() ||
    '?'

  return (
    <header className="topbar">
      <div className="mark">
        <span className="mark-icon" aria-hidden>
          ✦
        </span>
        OnMyMind
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          type="button"
          className="btn-pill btn-pill-label"
          onClick={onNewList}
        >
          <PlusIcon />
          New list
        </button>
        <button
          type="button"
          className="btn-pill btn-pill-icon"
          onClick={onNewList}
          aria-label="New list"
        >
          <PlusIcon />
        </button>

        <div className="avatar-wrap" ref={wrapRef}>
          <button
            type="button"
            className="avatar-btn"
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {user.photoURL ? (
              <img src={user.photoURL} alt="" referrerPolicy="no-referrer" />
            ) : (
              <span className="avatar-fallback">{initial}</span>
            )}
          </button>
          {open && (
            <div className="avatar-menu" role="menu">
              <div className="name">{user.displayName || 'Signed in'}</div>
              <div className="email">{user.email}</div>
              <hr />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  onSignOut()
                }}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M8 3v10M3 8h10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}
