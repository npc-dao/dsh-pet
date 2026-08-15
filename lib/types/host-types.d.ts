/** Structural Host service types required by the plugin entry. */
import type { IncomingMessage, ServerResponse } from 'node:http';
/** DSH Host connection trust classifier. */
export interface HostConnectionHandle {
    isTrustedRequest(request: IncomingMessage, policy: 'loopback'): boolean;
}
/** One prefix route registered with the DSH Host Web server. */
export interface WebRoute {
    kind: 'prefix';
    path: string;
    handler(request: IncomingMessage, response: ServerResponse): Promise<void>;
}
/** DSH Host Web route registry. */
export interface WebServer {
    register(route: WebRoute): () => void;
}
/** DSH invariant registry surface used by the companion entry. */
export interface InvariantRegistry {
    register(packageName: string, installer: () => void): () => void;
}
