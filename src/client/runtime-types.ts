/** Structural DSH browser types kept local so development does not install the Host bundle. */

import type { ReactNode } from 'react'
import type { PetKey } from './locales.ts'
import type { SnapshotStore } from './snapshot-store.ts'

/** Read-only observable accepted by DSH selector hooks. */
export type Observable<T> = Pick<SnapshotStore<T>, 'getSnapshot' | 'subscribe'>

/** Durable settings namespace snapshot exposed by DSH Web. */
export interface SettingsScopeSnapshot<T> {
  status: string
  value: T | undefined
  base: T | undefined
  user: T | undefined
  revision: number
  writable: boolean
  mode: string
}

/** Mutable durable namespace handle exposed by DSH Web. */
export interface SettingsScope<T> extends Observable<SettingsScopeSnapshot<T>> {
  set<K extends keyof T>(field: K, value: T[K]): Promise<void>
}

/** One row in the global DSH session list. */
export interface SessionSummary {
  id: string
  displayTitle: string
  running: boolean
  blank: boolean
  updatedAt: number
  pendingInteraction?: string
  completed?: boolean
}

/** Session list fields used to derive the mascot state. */
export interface SessionListState {
  ids: string[]
  byId: Record<string, SessionSummary>
  current?: string | undefined
  phase?: string
  subagentsByParent?: Record<string, unknown>
  jobsBySession?: Record<string, unknown>
  currentAddress?: unknown
}

/** Selected conversation fields used to detect a latest-turn failure. */
export interface ConversationSnapshot {
  sessionId: string
  running: boolean
  lastAgentError: string | null
  chat: {
    timeline: {
      turnOrder: readonly (string | number)[]
      turns: Map<string | number, {
        end?: { data: { reason: { kind: string } } }
      }>
    }
  }
}

/** Selector hook synthesized by the DSH slot runtime. */
export type SelectorHook<T> = <R>(selector: (value: T) => R) => R

/** Browser settings binding service used during plugin registration. */
export interface SettingsScopeService {
  bind<T>(options: { namespace: string }): SettingsScope<T>
}

/** Browser context surface required by the DSH pet client entry. */
export interface ClientContext {
  effect(installer: () => void | (() => void | Promise<void>), label?: string): void
  on(event: 'connection/reset', listener: () => void): () => void
  locale: {
    register(namespace: string, dictionaries: object): () => void
    bind(namespace: string): (key: PetKey) => string
  }
  settingsScope: SettingsScopeService
  slots: {
    inject(name: string, installer: () => (() => void) | Generator<() => void, void>): void
    register(options: Record<string, unknown>, component: unknown): () => void
  }
}

/** Root overlay renderer supplied by the DSH slot runtime. */
export interface PetOverlayRootRuntimeProps {
  renderSlot(name: 'shell.overlay.pet', props: object): ReactNode
}
