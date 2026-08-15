/** Durable preferences for the DSH Web pet surface. */

/** Settings namespace owned by the pet plugin. */
export const PET_SETTINGS_NAMESPACE = 'dsh-pet'

/** Codex's default mascot width in CSS pixels. */
export const DEFAULT_PET_SIZE = 112

/** Smallest mascot width accepted by Codex and this renderer. */
export const MIN_PET_SIZE = 80

/** Largest mascot width accepted by Codex and this renderer. */
export const MAX_PET_SIZE = 224

/** Persistent pet preferences shared by the Host schema and browser scope. */
export interface PetSettings {
  /** Whether the mascot is visible inside the DSH Web frame. */
  enabled: boolean
  /** Selected DSH or Codex preset id, or a `custom:<directory>` id. */
  selectedId: string
  /** Rendered mascot width in CSS pixels. */
  size: number
}

/** Defaults used before the user settings document carries overrides. */
export const DEFAULT_PET_SETTINGS: Readonly<PetSettings> = Object.freeze({
  enabled: true,
  selectedId: 'dsh',
  size: DEFAULT_PET_SIZE,
})
