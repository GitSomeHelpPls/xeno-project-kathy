require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Your Shopify Store Details
const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

// Validate environment variables
if (!SHOPIFY_STORE_URL || !SHOPIFY_ACCESS_TOKEN) {
  console.error('❌ Missing required environment variables:');
  if (!SHOPIFY_STORE_URL) console.error('  - SHOPIFY_STORE_URL');
  if (!SHOPIFY_ACCESS_TOKEN) console.error('  - SHOPIFY_ACCESS_TOKEN');
  console.error('Please check your .env file');
  process.exit(1);
}

async function main() {
  console.log('INFO: Starting data ingestion...');

  // --- UPSERT STORE ---
  // Ensure a default user exists
  const defaultUserEmail = 'admin@xeno.local';
  const defaultUserPassword = 'changeme'; 
  const user = await prisma.user.upsert({
    where: { email: defaultUserEmail },
    update: {},
    create: {
      email: defaultUserEmail,
      password: defaultUserPassword,
    },
  });

  // Upsert store with userId
  const store = await prisma.store.upsert({
    where: { shopName: SHOPIFY_STORE_URL },
    update: { accessToken: SHOPIFY_ACCESS_TOKEN, userId: user.id },
    create: {
      shopName: SHOPIFY_STORE_URL,
      accessToken: SHOPIFY_ACCESS_TOKEN,
      userId: user.id,
    },
  });
  console.log(`INFO: Ensured store record exists for: ${store.shopName}`);

  // --- UPSERT PRODUCTS ---
  console.log('INFO: Fetching and upserting products...');
  const productsResponse = await fetch(`https://${SHOPIFY_STORE_URL}/admin/api/2023-10/products.json`, {
    headers: { 'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN },
  });
  if (!productsResponse.ok) throw new Error('Failed to fetch products');
  const { products } = await productsResponse.json();
  console.log(`INFO: Fetched ${products.length} products from Shopify.`);

  for (const product of products) {
    await prisma.product.upsert({
      where: { shopifyProductId: product.id.toString() },
      update: {
        title: product.title,
        price: parseFloat(product.variants[0].price),
      },
      create: {
        shopifyProductId: product.id.toString(),
        title: product.title,
        price: parseFloat(product.variants[0].price),
        storeId: store.id,
      },
    });
  }
  console.log('SUCCESS: Successfully upserted products.');

  // --- UPSERT CUSTOMERS ---
  console.log('INFO: Fetching and upserting customers...');
  const customersResponse = await fetch(`https://${SHOPIFY_STORE_URL}/admin/api/2023-10/customers.json`, {
    headers: { 'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN },
  });
  if (!customersResponse.ok) throw new Error('Failed to fetch customers');
  const { customers } = await customersResponse.json();
  console.log(`Fetched ${customers.length} customers from Shopify.`);

  for (const customer of customers) {
    if (!customer.email) continue; // Skip customers without an email
    await prisma.customer.upsert({
      where: { shopifyCustomerId: customer.id.toString() },
      update: {
        email: customer.email,
        firstName: customer.first_name,
        lastName: customer.last_name,
      },
      create: {
        shopifyCustomerId: customer.id.toString(),
        email: customer.email,
        firstName: customer.first_name,
        lastName: customer.last_name,
        storeId: store.id,
      },
    });
  }
  console.log('Successfully upserted customers.');

  // --- UPSERT ORDERS ---
  console.log('Fetching and upserting orders...');
  const ordersResponse = await fetch(`https://${SHOPIFY_STORE_URL}/admin/api/2023-10/orders.json?status=any`, {
    headers: { 'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN },
  });
  if (!ordersResponse.ok) throw new Error('Failed to fetch orders');
  const { orders } = await ordersResponse.json();
  console.log(`Fetched ${orders.length} orders from Shopify.`);

  for (const order of orders) {
    if (!order.customer || !order.customer.id) continue; // Skip orders without a customer

    const dbCustomer = await prisma.customer.findUnique({
      where: { shopifyCustomerId: order.customer.id.toString() },
    });
    if (!dbCustomer) continue; // Skip if we can't find the customer in our DB

    await prisma.order.upsert({
      where: { shopifyOrderId: order.id.toString() },
      update: {
        totalPrice: parseFloat(order.total_price),
      },
      create: {
        shopifyOrderId: order.id.toString(),
        totalPrice: parseFloat(order.total_price),
        createdAt: new Date(order.created_at),
        storeId: store.id,
        customerId: dbCustomer.id,
      },
    });
    // Note: A full implementation would also upsert line items, but this is sufficient for the project.
  }
  console.log('Successfully upserted orders.');

  console.log('Data ingestion complete!');
}

main()
  .catch(async (e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

