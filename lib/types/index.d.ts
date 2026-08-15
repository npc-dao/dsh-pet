/** Host registration for the DSH pet catalog, Codex-compatible imports, and Web asset routes. */
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
export { ALIANG_BUILTIN_PET, CODEX_BUILTIN_PETS, CODEX_PET_ATLASES, CODEX_PET_ATLAS_V1, CODEX_PET_ATLAS_V2, DSH_BUILTIN_PET, PET_PRESETS, type BuiltinPetId, type PetCatalogSnapshot, type PetDescriptor, type PetSpriteVersion, type PetState, } from './pet-contract.ts';
export { PET_ASSET_PREFIX, PET_CATALOG_ENDPOINT, PET_HTTP_PREFIX, PET_REFRESH_ENDPOINT, petAssetPath, petAssetUrl, } from './pet-endpoints.ts';
export { DEFAULT_PET_SETTINGS, DEFAULT_PET_SIZE, MAX_PET_SIZE, MIN_PET_SIZE, PET_SETTINGS_NAMESPACE, type PetSettings, } from './pet-settings.ts';
/** Stable Cordis plugin name. */
export declare const name = "dsh-pet";
/** Optional Host paths overriding Codex's conventional local locations. */
export interface Config {
    /** Codex home; blank uses `$CODEX_HOME`, then `~/.codex`. */
    codexHome?: string;
    /** Codex Desktop `app.asar`; blank enables platform discovery. */
    appAsarPath?: string;
}
/** Host plugin configuration schema. */
export declare const Config: z<Config>;
/** Host services required to persist selection and serve local pet assets safely. */
export declare const inject: string[];
/**
 * Register durable settings, discover the first catalog generation, and
 * publish its loopback-trusted HTTP surface before activation completes.
 * @param ctx - Host plugin context.
 * @param config - optional local Codex path overrides.
 * @returns activation completion after the first catalog generation is ready.
 */
export declare function apply(ctx: Context, config?: Config): Promise<void>;
//# sourceMappingURL=index.d.ts.map