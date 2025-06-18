import { createRequestHandler } from "@remix-run/cloudflare";
import * as build from "./build/server/index.js";

const handleRequest = createRequestHandler(build, {
    mode: process.env.NODE_ENV,
});

export default {
    async fetch(request, env, ctx) {
        try {
            if (request.method === "OPTIONS") {
                return new Response(null, {
                    headers: {
                        "Access-Control-Allow-Origin": "*",
                        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                        "Access-Control-Allow-Headers": "Content-Type",
                    },
                });
            }

            const loadContext = {
                env,
                cloudflare: {
                    cf: request.cf,
                    ctx: {
                        waitUntil: ctx.waitUntil.bind(ctx),
                        passThroughOnException: ctx.passThroughOnException.bind(ctx),
                    },
                    caches,
                    env,
                },
            };

            return await handleRequest(request, loadContext);
        } catch (error) {
            console.error("Request handling error:", error);
            return new Response("An unexpected error occurred", { status: 500 });
        }
    },
}; 