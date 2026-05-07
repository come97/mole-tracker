// In-memory queue for photos waiting to be dispatched to a body zone.
// Used by /import to let the user batch-pick zones for many files at once.
// State lives in module scope (singleton); cleared on tab close. We don't
// persist Files anywhere — they only exist as long as the tab is open.

export type ImportItem = {
  id: string
  file: File
}

let items: ImportItem[] = []
const listeners = new Set<() => void>()

function notify() {
  for (const l of listeners) l()
}

export const importQueue = {
  add(files: File[] | FileList): ImportItem[] {
    const arr = Array.from(files)
    const added: ImportItem[] = arr.map(file => ({
      id: crypto.randomUUID(),
      file,
    }))
    items = [...items, ...added]
    notify()
    return added
  },

  remove(id: string): void {
    items = items.filter(i => i.id !== id)
    notify()
  },

  removeMany(ids: string[]): void {
    const toRemove = new Set(ids)
    items = items.filter(i => !toRemove.has(i.id))
    notify()
  },

  clear(): void {
    items = []
    notify()
  },

  list(): ImportItem[] {
    // Return the stable reference — mutations always replace `items` with a
    // new array, so callers can safely treat this as immutable. Returning a
    // fresh slice here breaks useSyncExternalStore (infinite re-renders).
    return items
  },

  size(): number {
    return items.length
  },

  subscribe(fn: () => void): () => void {
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
    }
  },
}
