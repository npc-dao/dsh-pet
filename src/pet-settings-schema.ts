/** Host-only schema for durable pet preferences. */

import z from '@deepseek-ai/schemastery'
import {
  DEFAULT_PET_SETTINGS, MAX_PET_SIZE, MIN_PET_SIZE, type PetSettings,
} from './pet-settings.ts'

/** Durable pet settings schema. */
export const PetSettingsSchema: z<PetSettings> = z.object({
  enabled: z.boolean().default(DEFAULT_PET_SETTINGS.enabled),
  selectedId: z.string().min(1).max(512).default(DEFAULT_PET_SETTINGS.selectedId),
  size: z.natural().min(MIN_PET_SIZE).max(MAX_PET_SIZE).default(DEFAULT_PET_SETTINGS.size),
})
