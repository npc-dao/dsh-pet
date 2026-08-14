/** Host registration for the DSH pet catalog, Codex-compatible imports, and Web asset routes. */

import type { Context } from '@deepseek-ai/cordis'
import type { HostConnectionHandle } from '@deepseek-ai/dsh-client-connection/types'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { expandHomePath } from '@deepseek-ai/dsh-home-paths'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import z from '@deepseek-ai/schemastery'
import { createPetCatalog } from './pet-catalog.ts'
import { PET_HTTP_PREFIX } from './pet-endpoints.ts'
import { createPetHttpHandler } from './pet-http.ts'
import {
  PET_SETTINGS_NAMESPACE, PetSettingsSchema,
} from './pet-settings.ts'

export {
  CODEX_BUILTIN_PETS,
  CODEX_PET_ATLASES,
  CODEX_PET_ATLAS_V1,
  CODEX_PET_ATLAS_V2,
  DSH_BUILTIN_PET,
  PET_PRESETS,
  type BuiltinPetId,
  type PetCatalogSnapshot,
  type PetDescriptor,
  type PetSpriteVersion,
  type PetState,
} from './pet-contract.ts'
export {
  PET_ASSET_PREFIX,
  PET_CATALOG_ENDPOINT,
  PET_HTTP_PREFIX,
  PET_REFRESH_ENDPOINT,
  petAssetPath,
  petAssetUrl,
} from './pet-endpoints.ts'
export {
  DEFAULT_PET_SETTINGS,
  DEFAULT_PET_SIZE,
  MAX_PET_SIZE,
  MIN_PET_SIZE,
  PET_SETTINGS_NAMESPACE,
  type PetSettings,
} from './pet-settings.ts'

/** Stable Cordis plugin name. */
export const name = 'dsh-pet'

/** Optional Host paths overriding Codex's conventional local locations. */
export interface Config {
  /** Codex home; blank uses `$CODEX_HOME`, then `~/.codex`. */
  codexHome?: string
  /** Codex Desktop `app.asar`; blank enables platform discovery. */
  appAsarPath?: string
}

/** Host plugin configuration schema. */
export const Config: z<Config> = z.object({
  codexHome: z.string(),
  appAsarPath: z.string(),
})

/** Host services required to persist selection and serve local pet assets safely. */
export const inject = ['connection', 'settings', 'webServer']

/**
 * Register durable settings, discover the first catalog generation, and
 * publish its loopback-trusted HTTP surface before activation completes.
 * @param ctx - Host plugin context.
 * @param config - optional local Codex path overrides.
 * @returns activation completion after the first catalog generation is ready.
 */
export async function apply(ctx: Context, config: Config = {}): Promise<void> {
  ctx.settings.register(
    settingsNamespace(PET_SETTINGS_NAMESPACE),
    PetSettingsSchema,
  )
  const codexHome = config.codexHome?.trim()
  const appAsarPath = config.appAsarPath?.trim()
  const catalog = await createPetCatalog({
    ...(codexHome === undefined || codexHome === '' ? {} : { codexHome: expandHomePath(codexHome) }),
    ...(appAsarPath === undefined || appAsarPath === '' ? {} : { appAsarPath: expandHomePath(appAsarPath) }),
  })
  const connection = (ctx as Context & { readonly connection: HostConnectionHandle }).connection
  const handler = createPetHttpHandler(
    catalog,
    request => connection.isTrustedRequest(request, 'loopback'),
  )
  ctx.effect(() => {
    const pending = new Set<Promise<void>>()
    const trackedHandler: typeof handler = (request, response) => {
      const task = handler(request, response)
      const tracked = task.finally(() => { pending.delete(tracked) })
      pending.add(tracked)
      return tracked
    }
    const unregister = ctx.webServer.register({
      kind: 'prefix',
      path: PET_HTTP_PREFIX,
      handler: trackedHandler,
    })
    return async () => {
      unregister()
      await Promise.allSettled([...pending])
    }
  }, 'dsh-pet: catalog and atlas routes')
}
