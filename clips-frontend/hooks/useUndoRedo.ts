'use client'

import { useState, useCallback, useEffect } from 'react'

export function useUndoRedo<T>(initialState: T, maxDepth = 50) {
  const [state, setState] = useState<T>(initialState)
  const [past, setPast] = useState<T[]>([])
  const [future, setFuture] = useState<T[]>([])

  const canUndo = past.length > 0
  const canRedo = future.length > 0

  const undo = useCallback(() => {
    if (!canUndo) return

    const previous = past[past.length - 1]
    const newPast = past.slice(0, past.length - 1)

    setPast(newPast)
    setFuture([state, ...future])
    setState(previous)

    // Announcement for screen readers
    const message = "Action undone"
    const announcement = document.createElement('div')
    announcement.setAttribute('aria-live', 'polite')
    announcement.innerText = message
    document.body.appendChild(announcement)
    setTimeout(() => document.body.removeChild(announcement), 1000)
  }, [canUndo, past, state, future])

  const redo = useCallback(() => {
    if (!canRedo) return

    const next = future[0]
    const newFuture = future.slice(1)

    setPast([...past, state])
    setFuture(newFuture)
    setState(next)

    // Announcement for screen readers
    const message = "Action redone"
    const announcement = document.createElement('div')
    announcement.setAttribute('aria-live', 'polite')
    announcement.innerText = message
    document.body.appendChild(announcement)
    setTimeout(() => document.body.removeChild(announcement), 1000)
  }, [canRedo, future, past, state])

  const set = useCallback((newState: T | ((prev: T) => T)) => {
    const value = newState instanceof Function ? newState(state) : newState
    
    if (JSON.stringify(value) === JSON.stringify(state)) return

    setPast(prev => {
      const nextPast = [...prev, state]
      return nextPast.slice(-maxDepth)
    })
    setFuture([])
    setState(value)
  }, [state, maxDepth])

  const clear = useCallback(() => {
    setPast([])
    setFuture([])
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          redo()
        } else {
          undo()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo])

  return { state, set, undo, redo, canUndo, canRedo, clear }
}
