/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-pet`.
 * @module @deepseek-ai/dsh-pet/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-pet'

/** Cordis companion plugin name. */
export const name = 'dsh-pet-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: catalog parsing is a durable file-input boundary,
 * route ownership and disposal are proven by Host specs, while browser slot
 * registration and animation teardown are proven by Client specs. The plugin
 * owns no cross-plugin mutable relationship an invariant can inspect.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
