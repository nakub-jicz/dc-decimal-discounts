import { createRequestHandler } from "@remix-run/cloudflare";
// eslint-disable-next-line import/no-unresolved
import * as build from "./build/server/index.js";
import { getLoadContext } from "./load-context";

const handleRemixRequest = createRequestHandler(build, {
    mode: process.env.NODE_ENV,
});

/**
 * @typedef {Object} ExportedHandler
 * @property {Function} fetch
 */

/**
 * @type {ExportedHandler}
 */
export default {
    async fetch(request, env, ctx) {
        try {
            console.log("Incoming request method:", request.method);
            const loadContext = {
                env,
                cloudflare: {
                    // This object matches the return value from Wrangler's
                    // `getPlatformProxy` used during development via Remix's
                    // `cloudflareDevProxyVitePlugin`:
                    // https://developers.cloudflare.com/workers/wrangler/api/#getplatformproxy
                    cf: request.cf,
                    ctx: {
                        waitUntil: ctx.waitUntil.bind(ctx),
                        passThroughOnException: ctx.passThroughOnException.bind(ctx),
                    },
                    caches,
                    env,
                },
            };
            // Explicitly handle CORS if needed
            if (request.method === "OPTIONS") {
                return new Response(null, {
                    headers: {
                        "Access-Control-Allow-Origin": "*",
                        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                        "Access-Control-Allow-Headers": "Content-Type",
                    },
                });
            }
            return await handleRemixRequest(request, loadContext);
        } catch (error) {
            console.error("Request handling error:", error);
            return new Response("An unexpected error occurred", { status: 500 });
        }
    },
};