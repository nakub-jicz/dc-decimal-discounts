export function getLoadContext({ request, context }) {
    return {
        ...context,
        env: context.cloudflare.env,
    };
}

