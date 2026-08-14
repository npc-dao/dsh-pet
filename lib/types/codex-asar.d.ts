/** Minimal, bounds-checked ASAR reader for Codex's bundled pet atlases. */
/** Conventional Codex Desktop ASAR location on macOS. */
export declare const DEFAULT_CODEX_APP_ASAR_PATH = "/Applications/ChatGPT.app/Contents/Resources/app.asar";
/** Maximum ASAR JSON index accepted by this focused reader. */
export declare const MAX_ASAR_HEADER_BYTES: number;
/** One packed ASAR member with a range already proved inside the archive. */
export interface AsarEntry {
    /** Slash-separated member path. */
    readonly path: string;
    /** Member byte length. */
    readonly size: number;
    /** Absolute byte offset inside the archive. */
    readonly offset: number;
    /** Optional SHA-256 recorded by Electron's packager. */
    readonly integrityHash?: string;
}
/** Parsed ASAR index used for later bounded member reads. */
export interface AsarIndex {
    /** Host-only archive path. */
    readonly archivePath: string;
    /** Archive size observed while parsing. */
    readonly archiveSize: number;
    /** Opaque filesystem revision observed while parsing this index. */
    readonly archiveRevision: string;
    /** First byte of packed member data. */
    readonly contentOffset: number;
    /** Packed files keyed by slash-separated member path. */
    readonly entries: ReadonlyMap<string, AsarEntry>;
}
/** Host-only reference to one dynamically discovered Codex built-in atlas. */
export interface CodexBuiltinAsset {
    /** Stable built-in pet id. */
    readonly id: string;
    /** Parsed archive index containing the atlas. */
    readonly index: AsarIndex;
    /** Packed atlas member. */
    readonly entry: AsarEntry;
}
/**
 * Parse and validate an ASAR index without reading packed file bodies.
 * @param archivePath - local `app.asar` path.
 * @returns validated index of packed members.
 */
export declare function readAsarIndex(archivePath: string): Promise<AsarIndex>;
/**
 * Read one indexed ASAR member from a revision-stable archive and verify any
 * packager-provided SHA-256 integrity value.
 * @param index - validated index returned by {@link readAsarIndex}.
 * @param entry - member from that index.
 * @returns exact member bytes.
 */
export declare function readAsarEntry(index: AsarIndex, entry: AsarEntry): Promise<Buffer>;
/**
 * Locate hashed Codex spritesheet members for stable built-in ids.
 * Missing and malformed archives reject; callers decide whether their path
 * was an explicit referent or an optional automatic candidate.
 * @param ids - built-in ids whose hashed filenames should be located.
 * @param appAsarPath - configured archive path, or the conventional macOS path.
 * @returns discovered Host-only asset references keyed by id.
 */
export declare function discoverCodexBuiltinAssets(ids: readonly string[], appAsarPath?: string): Promise<ReadonlyMap<string, CodexBuiltinAsset>>;
/**
 * Build the conventional Windows archive path when LocalAppData is known.
 * @param localAppData - Windows LocalAppData directory.
 * @returns candidate ChatGPT ASAR path.
 */
export declare function windowsCodexAppAsarPath(localAppData: string): string;
//# sourceMappingURL=codex-asar.d.ts.map