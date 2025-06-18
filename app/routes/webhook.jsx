import { shopify } from "../shopify.server";

export const action = async ({ request, context }) => {
    const { topic, shop, session, payload } = await shopify(context).authenticate.webhook(request);

    if (!topic) {
        console.log("No topic in webhook");
        return new Response();
    }

    if (!shop) {
        console.log("No shop in webhook");
        return new Response();
    }

    switch (topic) {
        case "app/uninstalled":
            // Handle app uninstallation
            console.log("App uninstalled from shop:", shop);
            break;

        case "shop/update":
            // Handle shop update events
            console.log("Shop updated:", shop);
            console.log("Update payload:", payload);
            break;

        case "products/update":
            // Handle product updates
            console.log("Product updated in shop:", shop);
            console.log("Product update payload:", payload);
            break;

        case "customers/data_request":
            // Tutaj możesz zaimplementować logikę zwracania danych klienta
            // Na przykład wyszukanie wszystkich danych związanych z customer_id z payload
            const customerData = {
                customer_id: payload.customer.id,
                // Dodaj tutaj dane klienta z Twojej bazy danych
                // orders: [],
                // preferences: {},
                // etc.
            };
            console.log('Data request received for customer:', customerData);
            break;

        case "customers/redact":
            // Tutaj zaimplementuj usuwanie danych klienta
            // Usuń lub zanonimizuj wszystkie dane związane z customer_id z payload
            const customerToRedact = {
                shop_id: shop,
                customer_id: payload.customer.id,
            };
            console.log('Customer data redaction request received:', customerToRedact);
            break;

        case "shop/redact":
            // Usuń wszystkie dane związane ze sklepem
            try {
                await db(context.cloudflare.env.DATABASE_URL).dCDecimalDiscountsSes.deleteMany({
                    where: { shop }
                });
                console.log('Shop data deletion request received for:', shop);
            } catch (error) {
                console.error('Error deleting shop data:', error);
                return new Response(null, { status: 500 });
            }
            break;

        default:
            console.log(`Unhandled webhook topic: ${topic}`);
    }

    return new Response();
}; 