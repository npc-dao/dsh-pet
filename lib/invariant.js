//#region src/invariant.ts
const PACKAGE_NAME = "@deepseek-ai/dsh-pet";
/** Cordis companion plugin name. */
const name = "dsh-pet-invariant";
/** Service required before the companion can reserve package ownership. */
const inject = ["invariants"];
/**
* No runtime invariant: catalog parsing is a durable file-input boundary,
* route ownership and disposal are proven by Host specs, while browser slot
* registration and animation teardown are proven by Client specs. The plugin
* owns no cross-plugin mutable relationship an invariant can inspect.
*/
const install = () => {};
/**
* Register this package's invariant companion.
* @param ctx - Cordis context carrying the invariant service.
* @returns the installed registration's disposer after setup succeeds.
*/
const apply = (ctx) => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install));
//#endregion
export { apply, inject, name };
