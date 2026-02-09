/**
 * Schéma Drizzle E-commerce - Extension du schéma existant
 * Tables pour plateforme e-commerce complète
 */
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  numeric,
  jsonb,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { users } from "./schema";

const timestamptz = () => timestamp({ withTimezone: true });
const timestamptzDefault = () => timestamptz().defaultNow();

// ============================================
// CATÉGORIES DE PRODUITS
// ============================================
export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    parentId: uuid("parent_id"),
    name: varchar("name", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 250 }).notNull().unique(),
    description: text("description"),
    imageUrl: text("image_url"),
    displayOrder: integer("display_order").default(0),
    isActive: boolean("is_active").default(true),
    metaTitle: varchar("meta_title", { length: 60 }),
    metaDescription: varchar("meta_description", { length: 160 }),
    createdAt: timestamptzDefault(),
    updatedAt: timestamptzDefault(),
  },
  (t) => ({
    idxSlug: index("idx_categories_slug").on(t.slug),
    idxActive: index("idx_categories_active").on(t.isActive),
    idxParent: index("idx_categories_parent").on(t.parentId),
  })
);

// ============================================
// MARQUES
// ============================================
export const brands = pgTable(
  "brands",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 200 }).notNull().unique(),
    slug: varchar("slug", { length: 250 }).notNull().unique(),
    logoUrl: text("logo_url"),
    description: text("description"),
    website: varchar("website", { length: 255 }),
    isActive: boolean("is_active").default(true),
    createdAt: timestamptzDefault(),
    updatedAt: timestamptzDefault(),
  },
  (t) => ({
    idxSlug: index("idx_brands_slug").on(t.slug),
    idxActive: index("idx_brands_active").on(t.isActive),
  })
);

// ============================================
// PRODUITS
// ============================================
export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sku: varchar("sku", { length: 100 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 300 }).notNull().unique(),
    description: text("description"),
    shortDescription: varchar("short_description", { length: 500 }),
    
    // Catégorisation
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    brandId: uuid("brand_id").references(() => brands.id, { onDelete: "set null" }),
    tags: text("tags").array().default([]),
    
    // Prix
    price: numeric("price", { precision: 10, scale: 2 }).notNull(),
    compareAtPrice: numeric("compare_at_price", { precision: 10, scale: 2 }),
    costPrice: numeric("cost_price", { precision: 10, scale: 2 }),
    currency: varchar("currency", { length: 3 }).default("EUR"),
    
    // Stock
    trackInventory: boolean("track_inventory").default(true),
    stockQuantity: integer("stock_quantity").default(0),
    lowStockThreshold: integer("low_stock_threshold").default(10),
    allowBackorder: boolean("allow_backorder").default(false),
    
    // Médias
    images: text("images").array().default([]),
    featuredImage: text("featured_image"),
    videoUrl: text("video_url"),
    
    // SEO
    metaTitle: varchar("meta_title", { length: 60 }),
    metaDescription: varchar("meta_description", { length: 160 }),
    metaKeywords: text("meta_keywords").array().default([]),
    
    // État
    status: varchar("status", { length: 20 }).default("draft"), // draft, active, archived
    isFeatured: boolean("is_featured").default(false),
    isOnSale: boolean("is_on_sale").default(false),
    
    // Dimensions (pour livraison)
    weightKg: numeric("weight_kg", { precision: 8, scale: 2 }),
    lengthCm: numeric("length_cm", { precision: 8, scale: 2 }),
    widthCm: numeric("width_cm", { precision: 8, scale: 2 }),
    heightCm: numeric("height_cm", { precision: 8, scale: 2 }),
    
    // Stats
    viewsCount: integer("views_count").default(0),
    salesCount: integer("sales_count").default(0),
    averageRating: numeric("average_rating", { precision: 3, scale: 2 }).default("0"),
    reviewsCount: integer("reviews_count").default(0),
    
    createdAt: timestamptzDefault(),
    updatedAt: timestamptzDefault(),
  },
  (t) => ({
    idxSku: index("idx_products_sku").on(t.sku),
    idxSlug: index("idx_products_slug").on(t.slug),
    idxCategory: index("idx_products_category").on(t.categoryId),
    idxBrand: index("idx_products_brand").on(t.brandId),
    idxStatus: index("idx_products_status").on(t.status),
    idxFeatured: index("idx_products_featured").on(t.isFeatured),
  })
);

// ============================================
// VARIANTES PRODUITS
// ============================================
export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    sku: varchar("sku", { length: 100 }).notNull().unique(),
    name: varchar("name", { length: 255 }),
    
    // Options (jusqu'à 3 niveaux)
    option1Name: varchar("option1_name", { length: 50 }),
    option1Value: varchar("option1_value", { length: 100 }),
    option2Name: varchar("option2_name", { length: 50 }),
    option2Value: varchar("option2_value", { length: 100 }),
    option3Name: varchar("option3_name", { length: 50 }),
    option3Value: varchar("option3_value", { length: 100 }),
    
    // Prix/Stock spécifiques
    priceAdjustment: numeric("price_adjustment", { precision: 10, scale: 2 }).default("0"),
    stockQuantity: integer("stock_quantity").default(0),
    
    imageUrl: text("image_url"),
    barcode: varchar("barcode", { length: 100 }),
    isActive: boolean("is_active").default(true),
    createdAt: timestamptzDefault(),
    updatedAt: timestamptzDefault(),
  },
  (t) => ({
    idxProduct: index("idx_variants_product").on(t.productId),
    idxSku: index("idx_variants_sku").on(t.sku),
  })
);

// ============================================
// MOUVEMENTS INVENTAIRE
// ============================================
export const inventoryMovements = pgTable(
  "inventory_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id").references(() => products.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 30 }).notNull(), // purchase, sale, adjustment, return
    quantity: integer("quantity").notNull(),
    reference: varchar("reference", { length: 255 }),
    note: text("note"),
    adminId: uuid("admin_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamptzDefault(),
  },
  (t) => ({
    idxProduct: index("idx_inventory_product").on(t.productId),
    idxVariant: index("idx_inventory_variant").on(t.variantId),
    idxType: index("idx_inventory_type").on(t.type),
    idxCreated: index("idx_inventory_created").on(t.createdAt),
  })
);

// ============================================
// PANIERS
// ============================================
export const carts = pgTable(
  "carts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    sessionId: varchar("session_id", { length: 255 }),
    expiresAt: timestamptz("expires_at"),
    createdAt: timestamptzDefault(),
    updatedAt: timestamptzDefault(),
  },
  (t) => ({
    idxUser: index("idx_carts_user").on(t.userId),
    idxSession: index("idx_carts_session").on(t.sessionId),
  })
);

// ============================================
// ITEMS PANIER
// ============================================
export const cartItems = pgTable(
  "cart_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cartId: uuid("cart_id").notNull().references(() => carts.id, { onDelete: "cascade" }),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(1),
    priceSnapshot: numeric("price_snapshot", { precision: 10, scale: 2 }).notNull(),
    addedAt: timestamptzDefault(),
  },
  (t) => ({
    idxCart: index("idx_cart_items_cart").on(t.cartId),
    idxProduct: index("idx_cart_items_product").on(t.productId),
  })
);

// ============================================
// COMMANDES
// ============================================
export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderNumber: varchar("order_number", { length: 50 }).notNull().unique(),
    
    // Client
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    guestEmail: varchar("guest_email", { length: 255 }),
    
    // Adresses
    billingAddress: jsonb("billing_address").notNull(),
    shippingAddress: jsonb("shipping_address").notNull(),
    
    // Montants
    subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
    shippingCost: numeric("shipping_cost", { precision: 10, scale: 2 }).default("0"),
    taxAmount: numeric("tax_amount", { precision: 10, scale: 2 }).default("0"),
    discountAmount: numeric("discount_amount", { precision: 10, scale: 2 }).default("0"),
    totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).default("EUR"),
    
    // Codes promo
    couponCode: varchar("coupon_code", { length: 50 }),
    couponDiscount: numeric("coupon_discount", { precision: 10, scale: 2 }).default("0"),
    
    // Paiement
    paymentMethod: varchar("payment_method", { length: 50 }),
    paymentStatus: varchar("payment_status", { length: 30 }).default("pending"),
    stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
    paidAt: timestamptz("paid_at"),
    
    // Livraison
    shippingMethod: varchar("shipping_method", { length: 100 }),
    shippingCarrier: varchar("shipping_carrier", { length: 100 }),
    trackingNumber: varchar("tracking_number", { length: 255 }),
    shippingStatus: varchar("shipping_status", { length: 30 }).default("pending"),
    shippedAt: timestamptz("shipped_at"),
    deliveredAt: timestamptz("delivered_at"),
    
    // Statut global
    status: varchar("status", { length: 30 }).default("pending"),
    
    // Notes
    customerNote: text("customer_note"),
    adminNote: text("admin_note"),
    
    createdAt: timestamptzDefault(),
    updatedAt: timestamptzDefault(),
    cancelledAt: timestamptz("cancelled_at"),
  },
  (t) => ({
    idxOrderNumber: index("idx_orders_number").on(t.orderNumber),
    idxUser: index("idx_orders_user").on(t.userId),
    idxEmail: index("idx_orders_email").on(t.guestEmail),
    idxStatus: index("idx_orders_status").on(t.status),
    idxPaymentStatus: index("idx_orders_payment_status").on(t.paymentStatus),
    idxCreated: index("idx_orders_created").on(t.createdAt),
  })
);

// ============================================
// ITEMS COMMANDE
// ============================================
export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "set null" }),
    
    // Snapshot au moment commande
    productName: varchar("product_name", { length: 255 }).notNull(),
    variantName: varchar("variant_name", { length: 255 }),
    sku: varchar("sku", { length: 100 }),
    price: numeric("price", { precision: 10, scale: 2 }).notNull(),
    quantity: integer("quantity").notNull(),
    subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
    
    imageUrl: text("image_url"),
    createdAt: timestamptzDefault(),
  },
  (t) => ({
    idxOrder: index("idx_order_items_order").on(t.orderId),
    idxProduct: index("idx_order_items_product").on(t.productId),
  })
);

// ============================================
// HISTORIQUE STATUTS COMMANDE
// ============================================
export const orderStatusHistory = pgTable(
  "order_status_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    fromStatus: varchar("from_status", { length: 30 }),
    toStatus: varchar("to_status", { length: 30 }).notNull(),
    comment: text("comment"),
    adminId: uuid("admin_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamptzDefault(),
  },
  (t) => ({
    idxOrder: index("idx_order_status_order").on(t.orderId),
    idxCreated: index("idx_order_status_created").on(t.createdAt),
  })
);

// ============================================
// CODES PROMO / COUPONS
// ============================================
export const coupons = pgTable(
  "coupons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 50 }).notNull().unique(),
    description: text("description"),
    
    // Type réduction
    discountType: varchar("discount_type", { length: 30 }).notNull(), // percentage, fixed_amount, free_shipping
    discountValue: numeric("discount_value", { precision: 10, scale: 2 }).notNull(),
    
    // Limites
    minPurchaseAmount: numeric("min_purchase_amount", { precision: 10, scale: 2 }),
    maxDiscountAmount: numeric("max_discount_amount", { precision: 10, scale: 2 }),
    usageLimit: integer("usage_limit"),
    usageCount: integer("usage_count").default(0),
    usageLimitPerUser: integer("usage_limit_per_user").default(1),
    
    // Validité
    validFrom: timestamptz("valid_from"),
    validTo: timestamptz("valid_to"),
    
    // Restrictions
    applicableTo: varchar("applicable_to", { length: 30 }).default("all"), // all, categories, products
    applicableIds: text("applicable_ids").array().default([]),
    excludedIds: text("excluded_ids").array().default([]),
    
    // État
    isActive: boolean("is_active").default(true),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamptzDefault(),
    updatedAt: timestamptzDefault(),
  },
  (t) => ({
    idxCode: index("idx_coupons_code").on(t.code),
    idxActive: index("idx_coupons_active").on(t.isActive),
  })
);

// ============================================
// USAGE COUPONS
// ============================================
export const couponUsage = pgTable(
  "coupon_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    couponId: uuid("coupon_id").notNull().references(() => coupons.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    discountAmount: numeric("discount_amount", { precision: 10, scale: 2 }).notNull(),
    usedAt: timestamptzDefault(),
  },
  (t) => ({
    idxCoupon: index("idx_coupon_usage_coupon").on(t.couponId),
    idxUser: index("idx_coupon_usage_user").on(t.userId),
    idxOrder: index("idx_coupon_usage_order").on(t.orderId),
  })
);

// ============================================
// PROMOTIONS AUTOMATIQUES
// ============================================
export const promotions = pgTable(
  "promotions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    
    // Type
    type: varchar("type", { length: 50 }).notNull(), // category_discount, buy_x_get_y, flash_sale
    
    // Réduction
    discountType: varchar("discount_type", { length: 30 }),
    discountValue: numeric("discount_value", { precision: 10, scale: 2 }),
    
    // Règles (configuration flexible)
    rules: jsonb("rules"),
    
    // Priorité
    priority: integer("priority").default(0),
    
    // Validité
    startsAt: timestamptz("starts_at"),
    endsAt: timestamptz("ends_at"),
    
    isActive: boolean("is_active").default(true),
    createdAt: timestamptzDefault(),
    updatedAt: timestamptzDefault(),
  },
  (t) => ({
    idxActive: index("idx_promotions_active").on(t.isActive),
    idxType: index("idx_promotions_type").on(t.type),
    idxDates: index("idx_promotions_dates").on(t.startsAt, t.endsAt),
  })
);

// ============================================
// AVIS / REVIEWS
// ============================================
export const productReviews = pgTable(
  "product_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    
    rating: integer("rating").notNull(), // 1-5
    title: varchar("title", { length: 255 }),
    comment: text("comment"),
    
    // Médias
    images: text("images").array().default([]),
    
    // Modération
    isApproved: boolean("is_approved").default(false),
    isVerifiedPurchase: boolean("is_verified_purchase").default(false),
    
    // Utilité
    helpfulCount: integer("helpful_count").default(0),
    notHelpfulCount: integer("not_helpful_count").default(0),
    
    // Réponse vendeur
    sellerResponse: text("seller_response"),
    respondedAt: timestamptz("responded_at"),
    
    createdAt: timestamptzDefault(),
    updatedAt: timestamptzDefault(),
  },
  (t) => ({
    idxProduct: index("idx_reviews_product").on(t.productId),
    idxUser: index("idx_reviews_user").on(t.userId),
    idxApproved: index("idx_reviews_approved").on(t.isApproved),
    idxCreated: index("idx_reviews_created").on(t.createdAt),
  })
);

// ============================================
// FAVORIS / WISHLIST
// ============================================
export const wishlistItems = pgTable(
  "wishlist_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "cascade" }),
    addedAt: timestamptzDefault(),
  },
  (t) => ({
    idxUser: index("idx_wishlist_user").on(t.userId),
    idxProduct: index("idx_wishlist_product").on(t.productId),
    uniqueUserProduct: unique("unique_wishlist_user_product").on(t.userId, t.productId),
  })
);

// ============================================
// TICKETS SAV
// ============================================
export const supportTickets = pgTable(
  "support_tickets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketNumber: varchar("ticket_number", { length: 50 }).notNull().unique(),
    
    // Client
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    email: varchar("email", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    
    // Contexte
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    
    // Ticket
    subject: varchar("subject", { length: 255 }).notNull(),
    category: varchar("category", { length: 50 }),
    priority: varchar("priority", { length: 20 }).default("normal"),
    status: varchar("status", { length: 30 }).default("open"),
    
    description: text("description").notNull(),
    
    // Affectation
    assignedTo: uuid("assigned_to").references(() => users.id, { onDelete: "set null" }),
    
    // Résolution
    resolution: text("resolution"),
    resolvedAt: timestamptz("resolved_at"),
    closedAt: timestamptz("closed_at"),
    
    createdAt: timestamptzDefault(),
    updatedAt: timestamptzDefault(),
  },
  (t) => ({
    idxTicketNumber: index("idx_tickets_number").on(t.ticketNumber),
    idxUser: index("idx_tickets_user").on(t.userId),
    idxStatus: index("idx_tickets_status").on(t.status),
    idxAssigned: index("idx_tickets_assigned").on(t.assignedTo),
  })
);

// ============================================
// MESSAGES TICKETS
// ============================================
export const ticketMessages = pgTable(
  "ticket_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: uuid("ticket_id").notNull().references(() => supportTickets.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id").references(() => users.id, { onDelete: "set null" }),
    senderType: varchar("sender_type", { length: 20 }).notNull(), // customer, admin
    message: text("message").notNull(),
    attachments: text("attachments").array().default([]),
    isInternal: boolean("is_internal").default(false),
    createdAt: timestamptzDefault(),
  },
  (t) => ({
    idxTicket: index("idx_ticket_messages_ticket").on(t.ticketId),
    idxSender: index("idx_ticket_messages_sender").on(t.senderId),
  })
);

// ============================================
// DEMANDES DE RETOUR
// ============================================
export const returnRequests = pgTable(
  "return_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    
    items: jsonb("items").notNull(), // [{order_item_id, quantity, reason}]
    reason: varchar("reason", { length: 100 }).notNull(),
    detailedReason: text("detailed_reason"),
    
    status: varchar("status", { length: 30 }).default("pending"),
    
    refundMethod: varchar("refund_method", { length: 50 }),
    refundAmount: numeric("refund_amount", { precision: 10, scale: 2 }),
    refundedAt: timestamptz("refunded_at"),
    
    adminNote: text("admin_note"),
    approvedBy: uuid("approved_by").references(() => users.id, { onDelete: "set null" }),
    approvedAt: timestamptz("approved_at"),
    
    createdAt: timestamptzDefault(),
    updatedAt: timestamptzDefault(),
  },
  (t) => ({
    idxOrder: index("idx_returns_order").on(t.orderId),
    idxUser: index("idx_returns_user").on(t.userId),
    idxStatus: index("idx_returns_status").on(t.status),
  })
);

// ============================================
// ADRESSES CLIENTS
// ============================================
export const customerAddresses = pgTable(
  "customer_addresses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    company: varchar("company", { length: 200 }),
    
    addressLine1: varchar("address_line1", { length: 255 }).notNull(),
    addressLine2: varchar("address_line2", { length: 255 }),
    city: varchar("city", { length: 100 }).notNull(),
    state: varchar("state", { length: 100 }),
    postalCode: varchar("postal_code", { length: 20 }).notNull(),
    country: varchar("country", { length: 2 }).notNull(), // Code ISO
    
    phone: varchar("phone", { length: 20 }),
    
    isDefault: boolean("is_default").default(false),
    isBilling: boolean("is_billing").default(false),
    isShipping: boolean("is_shipping").default(false),
    
    createdAt: timestamptzDefault(),
    updatedAt: timestamptzDefault(),
  },
  (t) => ({
    idxUser: index("idx_addresses_user").on(t.userId),
    idxDefault: index("idx_addresses_default").on(t.isDefault),
  })
);
