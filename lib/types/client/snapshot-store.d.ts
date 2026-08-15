/** Small observable store used by the browser half without importing Host packages. */
/** Readable mutable snapshot consumed by DSH slot selector hooks. */
export interface SnapshotStore<T> {
    /** Read the current immutable-by-convention value. */
    getSnapshot(): T;
    /** Observe future publications. */
    subscribe(listener: () => void): () => void;
    /** Publish one complete replacement. */
    set(value: T): void;
    /** Publish a shallow-cloned draft after an in-place mutation. */
    update(mutator: (draft: T) => void): void;
}
/**
 * Create a synchronous selector-compatible snapshot store.
 * @param initial - first published value.
 * @returns a store whose notifications run after each publication.
 */
export declare function createSnapshotStore<T>(initial: T): SnapshotStore<T>;
