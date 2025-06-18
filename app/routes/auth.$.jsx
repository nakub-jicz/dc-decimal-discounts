export const loader = async ({ request, context }) => {
  const { shopify } = await import("../shopify.server");
  await shopify(context).authenticate.admin(request);

  return null;
};
