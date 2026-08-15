import { describe, expect, it, vi } from 'vitest'
import { createSnapshotStore } from '../src/client/snapshot-store.ts'

describe('createSnapshotStore', () => {
  it('publishes replacements and shallow object updates until unsubscribed', () => {
    const store = createSnapshotStore({ count: 1 })
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)

    store.update((draft) => { draft.count += 1 })
    expect(store.getSnapshot()).toEqual({ count: 2 })
    store.set({ count: 4 })
    expect(listener).toHaveBeenCalledTimes(2)

    unsubscribe()
    store.set({ count: 5 })
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('shallow-clones arrays before mutation', () => {
    const initial = [1]
    const store = createSnapshotStore(initial)
    store.update((draft) => { draft.push(2) })

    expect(initial).toEqual([1])
    expect(store.getSnapshot()).toEqual([1, 2])
  })
})
