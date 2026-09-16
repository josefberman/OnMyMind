import { useCallback, useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'
import { auth, googleProvider, isFirebaseConfigured } from './firebase'
import {
  subscribeLists,
  subscribeItems,
  createList,
  renameList,
  updateListColor,
  deleteList,
  moveList,
  addItem,
  toggleItem,
  deleteItem,
  reorderItems,
} from './api'
import SignIn from './components/SignIn'
import TopBar from './components/TopBar'
import Board from './components/Board'
import type { ColorKey, TodoItem, TodoList } from './types'

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [lists, setLists] = useState<TodoList[]>([])
  const [itemsByList, setItemsByList] = useState<Record<string, TodoItem[]>>({})
  const [ghostOpen, setGhostOpen] = useState(false)
  const [dataError, setDataError] = useState<string | null>(null)

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setAuthReady(true)
      return
    }
    return onAuthStateChanged(auth, (u) => {
      setUser(u)
      setAuthReady(true)
    })
  }, [])

  useEffect(() => {
    if (!user) {
      setLists([])
      setItemsByList({})
      return
    }
    return subscribeLists(
      user.uid,
      setLists,
      (err) => setDataError(err.message),
    )
  }, [user])

  useEffect(() => {
    if (!user) return
    const unsubs = lists.map((list) =>
      subscribeItems(
        user.uid,
        list.id,
        (items) => {
          setItemsByList((prev) => ({ ...prev, [list.id]: items }))
        },
        (err) => setDataError(err.message),
      ),
    )
    return () => unsubs.forEach((u) => u())
  }, [user, lists])

  const handleSignIn = useCallback(async () => {
    if (!auth) return
    setAuthError(null)
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Sign-in failed')
    }
  }, [])

  const handleSignOut = useCallback(async () => {
    if (!auth) return
    await signOut(auth)
  }, [])

  const openGhost = useCallback(() => setGhostOpen(true), [])

  if (!authReady) {
    return (
      <div className="app-shell">
        <div className="blob blob-lavender" aria-hidden />
        <div className="blob blob-peach" aria-hidden />
        <div className="loading">Loading…</div>
      </div>
    )
  }

  if (!user) {
    return (
      <SignIn
        onSignIn={handleSignIn}
        configured={isFirebaseConfigured}
        error={authError}
      />
    )
  }

  return (
    <div className="app-shell">
      <div className="blob blob-lavender" aria-hidden />
      <div className="blob blob-peach" aria-hidden />
      <TopBar user={user} onNewList={openGhost} onSignOut={handleSignOut} />
      {dataError && (
        <div className="config-warning" style={{ margin: '8px 20px', zIndex: 2 }}>
          {dataError}
        </div>
      )}
      <Board
        lists={lists}
        itemsByList={itemsByList}
        ghostOpen={ghostOpen}
        onGhostOpen={openGhost}
        onGhostClose={() => setGhostOpen(false)}
        onCreateList={async (name, color) => {
          await createList(user.uid, name, color, lists)
          setGhostOpen(false)
        }}
        onRenameList={(listId, name) => renameList(user.uid, listId, name)}
        onColorList={(listId, color: ColorKey) =>
          updateListColor(user.uid, listId, color)
        }
        onDeleteList={(listId) => deleteList(user.uid, listId)}
        onMoveList={(listId, col, row) =>
          moveList(user.uid, listId, col, row, lists)
        }
        onAddItem={(listId, text) => {
          const open = (itemsByList[listId] ?? []).filter((i) => !i.done)
          return addItem(user.uid, listId, text, open)
        }}
        onToggleItem={(listId, item) =>
          toggleItem(user.uid, listId, item, itemsByList[listId] ?? [])
        }
        onDeleteItem={(listId, itemId) =>
          deleteItem(user.uid, listId, itemId)
        }
        onReorderItems={(listId, orderedIds) =>
          reorderItems(user.uid, listId, orderedIds)
        }
      />
    </div>
  )
}
