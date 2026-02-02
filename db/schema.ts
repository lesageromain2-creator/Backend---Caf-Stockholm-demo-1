/**
 * Schéma Drizzle - LE SAGE DEV
 * Aligné sur supabase/DATABASE_SCHEMA.sql (29 tables)
 * Utilisé par drizzle-kit (backend a drizzle-orm dans node_modules)
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
  date,
  time,
  jsonb,
  inet,
  index,
} from "drizzle-orm/pg-core";

const timestamptz = () => timestamp({ withTimezone: true });
const timestamptzDefault = () => timestamptz().defaultNow();

// ============================================
// TABLE 1: users
// ============================================
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    firstname: varchar("firstname", { length: 100 }).notNull(),
    lastname: varchar("lastname", { length: 100 }).notNull(),
    companyName: varchar("company_name", { length: 200 }),
    phone: varchar("phone", { length: 20 }),
    role: varchar("role", { length: 20 }).default("client"),
    avatarUrl: text("avatar_url"),
    isActive: boolean("is_active").default(true),
    emailVerified: boolean("email_verified").default(false),
    createdAt: timestamptzDefault(),
    updatedAt: timestamptzDefault(),
    lastLogin: timestamptz("last_login"),
  },
  (t) => ({
    idxEmail: index("idx_users_email").on(t.email),
    idxRole: index("idx_users_role").on(t.role),
  })
);

// ============================================
// TABLE 2: client_projects
// ============================================
export const clientProjects = pgTable(
  "client_projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    projectType: varchar("project_type", { length: 50 }).notNull(),
    status: varchar("status", { length: 30 }).default("discovery"),
    progress: integer("progress").default(0),
    startDate: date("start_date"),
    estimatedDelivery: date("estimated_delivery"),
    deliveredAt: timestamptz("delivered_at"),
    totalPrice: numeric("total_price", { precision: 10, scale: 2 }),
    depositPaid: boolean("deposit_paid").default(false),
    depositAmount: numeric("deposit_amount", { precision: 10, scale: 2 }),
    finalPaid: boolean("final_paid").default(false),
    stagingUrl: text("staging_url"),
    productionUrl: text("production_url"),
    priority: varchar("priority", { length: 20 }).default("medium"),
    assignedTo: uuid("assigned_to").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamptzDefault(),
    updatedAt: timestamptzDefault(),
  },
  (t) => ({
    idxUser: index("idx_client_projects_user").on(t.userId),
    idxStatus: index("idx_client_projects_status").on(t.status),
    idxAssigned: index("idx_client_projects_assigned").on(t.assignedTo),
  })
);

// ============================================
// TABLE 3: project_files
// ============================================
export const projectFiles = pgTable(
  "project_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => clientProjects.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    fileUrl: text("file_url").notNull(),
    fileType: varchar("file_type", { length: 100 }),
    fileSize: integer("file_size"),
    mimeType: varchar("mime_type", { length: 100 }),
    cloudinaryPublicId: varchar("cloudinary_public_id", { length: 255 }),
    thumbnailUrl: text("thumbnail_url"),
    metadata: jsonb("metadata"),
    isDeleted: boolean("is_deleted").default(false),
    deletedAt: timestamptz("deleted_at"),
    createdAt: timestamptzDefault(),
  },
  (t) => ({
    idxProject: index("idx_project_files_project").on(t.projectId),
    idxUser: index("idx_project_files_user").on(t.userId),
  })
);

// ============================================
// TABLE 4: project_tasks
// ============================================
export const projectTasks = pgTable(
  "project_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => clientProjects.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    status: varchar("status", { length: 30 }).default("todo"),
    priority: varchar("priority", { length: 20 }).default("normal"),
    assignedTo: uuid("assigned_to").references(() => users.id, { onDelete: "set null" }),
    dueDate: date("due_date"),
    completedAt: timestamptz("completed_at"),
    createdAt: timestamptzDefault(),
    updatedAt: timestamptzDefault(),
  },
  (t) => ({
    idxProject: index("idx_project_tasks_project").on(t.projectId),
    idxAssigned: index("idx_project_tasks_assigned").on(t.assignedTo),
    idxStatus: index("idx_project_tasks_status").on(t.status),
  })
);

// ============================================
// TABLE 5: project_updates
// ============================================
export const projectUpdates = pgTable(
  "project_updates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => clientProjects.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    title: varchar("title", { length: 255 }).notNull(),
    message: text("message").notNull(),
    updateType: varchar("update_type", { length: 50 }).default("info"),
    isRead: boolean("is_read").default(false),
    createdAt: timestamptzDefault(),
  },
  (t) => ({
    idxProject: index("idx_project_updates_project").on(t.projectId),
    idxCreatedBy: index("idx_project_updates_created_by").on(t.createdBy),
  })
);

// ============================================
// TABLE 6: project_comments
// ============================================
export const projectComments = pgTable(
  "project_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => clientProjects.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    parentCommentId: uuid("parent_comment_id").references(() => projectComments.id, { onDelete: "cascade" }),
    comment: text("comment").notNull(),
    isInternal: boolean("is_internal").default(false),
    createdAt: timestamptzDefault(),
    updatedAt: timestamptzDefault(),
  },
  (t) => ({
    idxProject: index("idx_project_comments_project").on(t.projectId),
    idxAuthor: index("idx_project_comments_author").on(t.authorId),
    idxParent: index("idx_project_comments_parent").on(t.parentCommentId),
  })
);

// ============================================
// TABLE 7: project_milestones
// ============================================
export const projectMilestones = pgTable("project_milestones", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => clientProjects.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  sequence: integer("sequence").default(0),
  dueDate: date("due_date"),
  completedAt: timestamptz("completed_at"),
  status: varchar("status", { length: 30 }).default("pending"),
  progress: integer("progress").default(0),
  isVisibleToClient: boolean("is_visible_to_client").default(true),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamptzDefault(),
  updatedAt: timestamptzDefault(),
});

// ============================================
// TABLE 8: reservations
// ============================================
export const reservations = pgTable(
  "reservations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    reservationDate: date("reservation_date").notNull(),
    reservationTime: time("reservation_time").notNull(),
    duration: integer("duration").default(60),
    meetingType: varchar("meeting_type", { length: 20 }).default("visio"),
    projectType: varchar("project_type", { length: 50 }),
    estimatedBudget: varchar("estimated_budget", { length: 50 }),
    message: text("message"),
    status: varchar("status", { length: 20 }).default("pending"),
    confirmedBy: uuid("confirmed_by").references(() => users.id, { onDelete: "set null" }),
    cancelledAt: timestamptz("cancelled_at"),
    cancellationReason: text("cancellation_reason"),
    createdAt: timestamptzDefault(),
    updatedAt: timestamptzDefault(),
  },
  (t) => ({
    idxUser: index("idx_reservations_user").on(t.userId),
    idxDate: index("idx_reservations_date").on(t.reservationDate),
    idxStatus: index("idx_reservations_status").on(t.status),
  })
);

// ============================================
// TABLE 9: contact_messages
// ============================================
export const contactMessages = pgTable(
  "contact_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 150 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 20 }),
    company: varchar("company", { length: 200 }),
    subject: varchar("subject", { length: 255 }),
    projectType: varchar("project_type", { length: 50 }),
    budgetRange: varchar("budget_range", { length: 50 }),
    message: text("message").notNull(),
    ipAddress: inet("ip_address"),
    userAgent: text("user_agent"),
    isRead: boolean("is_read").default(false),
    status: varchar("status", { length: 20 }).default("new"),
    priority: varchar("priority", { length: 20 }).default("normal"),
    assignedTo: uuid("assigned_to").references(() => users.id, { onDelete: "set null" }),
    repliedBy: uuid("replied_by").references(() => users.id, { onDelete: "set null" }),
    repliedAt: timestamptz("replied_at"),
    createdAt: timestamptzDefault(),
  },
  (t) => ({
    idxRead: index("idx_contact_messages_read").on(t.isRead),
    idxStatus: index("idx_contact_messages_status").on(t.status),
  })
);

// ============================================
// TABLE 10: contact_message_replies
// ============================================
export const contactMessageReplies = pgTable(
  "contact_message_replies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id").notNull().references(() => contactMessages.id, { onDelete: "cascade" }),
    adminId: uuid("admin_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    replyText: text("reply_text").notNull(),
    sentViaEmail: boolean("sent_via_email").default(true),
    createdAt: timestamptzDefault(),
  },
  (t) => ({
    idxMessage: index("idx_contact_replies_message").on(t.messageId),
    idxAdmin: index("idx_contact_replies_admin").on(t.adminId),
  })
);

// ============================================
// TABLE 11: portfolio_projects
// ============================================
export const portfolioProjects = pgTable(
  "portfolio_projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: varchar("title", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 250 }).notNull().unique(),
    description: text("description"),
    clientName: varchar("client_name", { length: 150 }),
    category: varchar("category", { length: 50 }).notNull(),
    thumbnailUrl: text("thumbnail_url").notNull(),
    imagesUrls: text("images_urls").array(),
    videoUrl: text("video_url"),
    technologies: text("technologies").array(),
    liveUrl: text("live_url"),
    githubUrl: text("github_url"),
    featured: boolean("featured").default(false),
    completionDate: date("completion_date"),
    displayOrder: integer("display_order").default(0),
    isPublished: boolean("is_published").default(true),
    testimonial: text("testimonial"),
    testimonialAuthor: varchar("testimonial_author", { length: 100 }),
    testimonialCompany: varchar("testimonial_company", { length: 150 }),
    createdAt: timestamptzDefault(),
    updatedAt: timestamptzDefault(),
  },
  (t) => ({
    idxSlug: index("idx_portfolio_slug").on(t.slug),
    idxCategory: index("idx_portfolio_category").on(t.category),
    idxFeatured: index("idx_portfolio_featured").on(t.featured),
  })
);

// ============================================
// TABLE 12: portfolio_images
// ============================================
export const portfolioImages = pgTable(
  "portfolio_images",
  {
  id: uuid("id").primaryKey().defaultRandom(),
  portfolioProjectId: uuid("portfolio_project_id").notNull().references(() => portfolioProjects.id, { onDelete: "cascade" }),
  cloudinaryPublicId: varchar("cloudinary_public_id", { length: 255 }).notNull(),
  imageUrl: text("image_url").notNull(),
  thumbnailUrl: text("thumbnail_url").notNull(),
  mediumUrl: text("medium_url"),
  displayOrder: integer("display_order").default(0),
  altText: varchar("alt_text", { length: 255 }),
  caption: text("caption"),
  width: integer("width"),
  height: integer("height"),
  isFeatured: boolean("is_featured").default(false),
  createdAt: timestamptzDefault(),
  updatedAt: timestamptzDefault(),
  },
  (t) => ({
    idxProject: index("idx_portfolio_images_project").on(t.portfolioProjectId),
  })
);

// ============================================
// TABLE 13: testimonials
// ============================================
export const testimonials = pgTable(
  "testimonials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    projectId: uuid("project_id").references(() => portfolioProjects.id, { onDelete: "set null" }),
    authorName: varchar("author_name", { length: 150 }).notNull(),
    authorRole: varchar("author_role", { length: 150 }),
    authorCompany: varchar("author_company", { length: 200 }),
    authorAvatarUrl: text("author_avatar_url"),
    content: text("content").notNull(),
    rating: integer("rating"),
    isFeatured: boolean("is_featured").default(false),
    isApproved: boolean("is_approved").default(false),
    displayOrder: integer("display_order").default(0),
    createdAt: timestamptzDefault(),
    updatedAt: timestamptzDefault(),
  },
  (t) => ({
    idxUser: index("idx_testimonials_user").on(t.userId),
    idxProject: index("idx_testimonials_project").on(t.projectId),
    idxApproved: index("idx_testimonials_approved").on(t.isApproved),
    idxFeatured: index("idx_testimonials_featured").on(t.isFeatured),
  })
);

// ============================================
// TABLE 14: blog_posts
// ============================================
export const blogPosts = pgTable(
  "blog_posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    title: varchar("title", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 300 }).notNull().unique(),
    excerpt: text("excerpt"),
    content: text("content").notNull(),
    metaDescription: varchar("meta_description", { length: 500 }),
    metaKeywords: text("meta_keywords").array(),
    featuredImageUrl: text("featured_image_url"),
    category: varchar("category", { length: 50 }),
    tags: text("tags").array(),
    status: varchar("status", { length: 20 }).default("draft"),
    isFeatured: boolean("is_featured").default(false),
    viewsCount: integer("views_count").default(0),
    publishedAt: timestamptz("published_at"),
    createdAt: timestamptzDefault(),
    updatedAt: timestamptzDefault(),
  },
  (t) => ({
    idxAuthor: index("idx_blog_posts_author").on(t.authorId),
    idxSlug: index("idx_blog_posts_slug").on(t.slug),
    idxStatus: index("idx_blog_posts_status").on(t.status),
    idxCategory: index("idx_blog_posts_category").on(t.category),
    idxFeatured: index("idx_blog_posts_featured").on(t.isFeatured),
  })
);

// ============================================
// TABLE 15: offers
// ============================================
export const offers = pgTable(
  "offers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 300 }).notNull().unique(),
    description: text("description").notNull(),
    shortDescription: varchar("short_description", { length: 500 }),
    priceFrom: numeric("price_from", { precision: 10, scale: 2 }),
    priceTo: numeric("price_to", { precision: 10, scale: 2 }),
    priceType: varchar("price_type", { length: 20 }).default("range"),
    priceStartingAt: numeric("price_starting_at", { precision: 10, scale: 2 }),
    currency: varchar("currency", { length: 3 }).default("EUR"),
    durationWeeks: integer("duration_weeks"),
    category: varchar("category", { length: 50 }),
    features: text("features").array(),
    deliverables: text("deliverables").array(),
    timelineMin: integer("timeline_min"),
    timelineMax: integer("timeline_max"),
    icon: varchar("icon", { length: 50 }),
    imageUrl: text("image_url"),
    colorTheme: varchar("color_theme", { length: 50 }),
    displayOrder: integer("display_order").default(0),
    isActive: boolean("is_active").default(true),
    isFeatured: boolean("is_featured").default(false),
    createdAt: timestamptzDefault(),
    updatedAt: timestamptzDefault(),
  },
  (t) => ({
    idxSlug: index("idx_offers_slug").on(t.slug),
    idxActive: index("idx_offers_active").on(t.isActive),
    idxCategory: index("idx_offers_category").on(t.category),
  })
);

// ============================================
// TABLE 16: email_logs
// ============================================
export const emailLogs = pgTable(
  "email_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recipientEmail: varchar("recipient_email", { length: 255 }).notNull(),
    recipientName: varchar("recipient_name", { length: 255 }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    emailType: varchar("email_type", { length: 100 }).notNull(),
    subject: varchar("subject", { length: 500 }).notNull(),
    templateName: varchar("template_name", { length: 100 }),
    context: jsonb("context"),
    variables: jsonb("variables"),
    status: varchar("status", { length: 30 }).default("pending"),
    errorMessage: text("error_message"),
    provider: varchar("provider", { length: 50 }).default("nodemailer"),
    providerMessageId: varchar("provider_message_id", { length: 255 }),
    sentAt: timestamptz("sent_at"),
    deliveredAt: timestamptz("delivered_at"),
    openedAt: timestamptz("opened_at"),
    clickedAt: timestamptz("clicked_at"),
    bouncedAt: timestamptz("bounced_at"),
    createdAt: timestamptzDefault(),
    updatedAt: timestamptzDefault(),
  },
  (t) => ({
    idxUser: index("idx_email_logs_user").on(t.userId),
    idxType: index("idx_email_logs_type").on(t.emailType),
    idxStatus: index("idx_email_logs_status").on(t.status),
    idxCreated: index("idx_email_logs_created").on(t.createdAt),
  })
);

// ============================================
// TABLE 17: email_templates
// ============================================
export const emailTemplates = pgTable(
  "email_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    templateKey: varchar("template_key", { length: 100 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    subject: varchar("subject", { length: 500 }).notNull(),
    htmlBody: text("html_body").notNull(),
    textBody: text("text_body"),
    availableVariables: jsonb("available_variables"),
    category: varchar("category", { length: 50 }),
    isActive: boolean("is_active").default(true),
    version: integer("version").default(1),
    lastUsedAt: timestamptz("last_used_at"),
    usageCount: integer("usage_count").default(0),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamptzDefault(),
    updatedAt: timestamptzDefault(),
  },
  (t) => ({
    idxKey: index("idx_email_templates_key").on(t.templateKey),
    idxCategory: index("idx_email_templates_category").on(t.category),
    idxActive: index("idx_email_templates_active").on(t.isActive),
  })
);

// ============================================
// TABLE 18: email_preferences
// ============================================
export const emailPreferences = pgTable("email_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  emailNotifications: boolean("email_notifications").default(true),
  marketingEmails: boolean("marketing_emails").default(true),
  reservationConfirmations: boolean("reservation_confirmations").default(true),
  reservationReminders: boolean("reservation_reminders").default(true),
  projectUpdates: boolean("project_updates").default(true),
  projectStatusChanges: boolean("project_status_changes").default(true),
  paymentNotifications: boolean("payment_notifications").default(true),
  newsletter: boolean("newsletter").default(true),
  digestFrequency: varchar("digest_frequency", { length: 20 }).default("immediate"),
  createdAt: timestamptzDefault(),
  updatedAt: timestamptzDefault(),
});

// ============================================
// TABLE 19: email_verification_tokens
// ============================================
export const emailVerificationTokens = pgTable(
  "email_verification_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    token: varchar("token", { length: 255 }).notNull().unique(),
    expiresAt: timestamptz("expires_at").notNull(),
    usedAt: timestamptz("used_at"),
    createdAt: timestamptzDefault(),
  },
  (t) => ({
    idxUser: index("idx_email_verification_user").on(t.userId),
    idxToken: index("idx_email_verification_token").on(t.token),
  })
);

// ============================================
// TABLE 20: password_reset_tokens
// ============================================
export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    token: varchar("token", { length: 255 }).notNull().unique(),
    expiresAt: timestamptz("expires_at").notNull(),
    used: boolean("used").default(false),
    usedAt: timestamptz("used_at"),
    ipAddress: inet("ip_address"),
    createdAt: timestamptzDefault(),
  },
  (t) => ({
    idxUser: index("idx_password_reset_user").on(t.userId),
    idxToken: index("idx_password_reset_token").on(t.token),
  })
);

// ============================================
// TABLE 21: login_attempts
// ============================================
export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull(),
    ipAddress: inet("ip_address"),
    userAgent: text("user_agent"),
    success: boolean("success").default(false),
    failureReason: varchar("failure_reason", { length: 100 }),
    createdAt: timestamptzDefault(),
  },
  (t) => ({
    idxEmail: index("idx_login_attempts_email").on(t.email),
    idxIp: index("idx_login_attempts_ip").on(t.ipAddress),
    idxCreated: index("idx_login_attempts_created").on(t.createdAt),
  })
);

// ============================================
// TABLE 22: newsletter_subscribers
// ============================================
export const newsletterSubscribers = pgTable(
  "newsletter_subscribers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    firstname: varchar("firstname", { length: 100 }),
    lastname: varchar("lastname", { length: 100 }),
    status: varchar("status", { length: 20 }).default("active"),
    subscriptionSource: varchar("subscription_source", { length: 50 }),
    ipAddress: inet("ip_address"),
    userAgent: text("user_agent"),
    subscribedAt: timestamptzDefault(),
    unsubscribedAt: timestamptz("unsubscribed_at"),
    lastEmailSentAt: timestamptz("last_email_sent_at"),
    createdAt: timestamptzDefault(),
  },
  (t) => ({
    idxEmail: index("idx_newsletter_email").on(t.email),
    idxStatus: index("idx_newsletter_status").on(t.status),
  })
);

// ============================================
// TABLE 23: user_notifications
// ============================================
export const userNotifications = pgTable(
  "user_notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    message: text("message").notNull(),
    type: varchar("type", { length: 50 }).default("info"),
    relatedType: varchar("related_type", { length: 50 }),
    relatedId: uuid("related_id"),
    isRead: boolean("is_read").default(false),
    readAt: timestamptz("read_at"),
    actionUrl: text("action_url"),
    createdAt: timestamptzDefault(),
  },
  (t) => ({
    idxUser: index("idx_notifications_user").on(t.userId),
    idxRead: index("idx_notifications_read").on(t.isRead),
    idxType: index("idx_notifications_type").on(t.type),
  })
);

// ============================================
// TABLE 24: admin_activity_logs
// ============================================
export const adminActivityLogs = pgTable(
  "admin_activity_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adminUserId: uuid("admin_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    action: varchar("action", { length: 100 }).notNull(),
    resourceType: varchar("resource_type", { length: 50 }),
    resourceId: uuid("resource_id"),
    details: jsonb("details"),
    ipAddress: inet("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamptzDefault(),
  },
  (t) => ({
    idxUser: index("idx_admin_logs_user").on(t.adminUserId),
    idxAction: index("idx_admin_logs_action").on(t.action),
    idxResource: index("idx_admin_logs_resource").on(t.resourceType, t.resourceId),
    idxCreated: index("idx_admin_logs_created").on(t.createdAt),
  })
);

// ============================================
// TABLE 25: admin_alerts
// ============================================
export const adminAlerts = pgTable(
  "admin_alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    alertType: varchar("alert_type", { length: 50 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    message: text("message"),
    severity: varchar("severity", { length: 20 }).default("info"),
    isResolved: boolean("is_resolved").default(false),
    relatedResourceType: varchar("related_resource_type", { length: 50 }),
    relatedResourceId: uuid("related_resource_id"),
    resolvedAt: timestamptz("resolved_at"),
    resolvedBy: uuid("resolved_by").references(() => users.id, { onDelete: "set null" }),
    expiresAt: timestamptz("expires_at"),
    createdAt: timestamptzDefault(),
  },
  (t) => ({
    idxResolved: index("idx_admin_alerts_resolved").on(t.isResolved),
    idxSeverity: index("idx_admin_alerts_severity").on(t.severity),
    idxCreated: index("idx_admin_alerts_created").on(t.createdAt),
  })
);

// ============================================
// TABLE 26: message_templates
// ============================================
export const messageTemplates = pgTable(
  "message_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull().unique(),
    subject: varchar("subject", { length: 255 }).notNull(),
    body: text("body").notNull(),
    category: varchar("category", { length: 50 }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamptzDefault(),
    updatedAt: timestamptzDefault(),
  },
  (t) => ({
    idxName: index("idx_message_templates_name").on(t.name),
    idxCategory: index("idx_message_templates_category").on(t.category),
  })
);

// ============================================
// TABLE 27: settings
// ============================================
export const settings = pgTable(
  "settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    settingKey: varchar("setting_key", { length: 100 }).notNull().unique(),
    settingValue: text("setting_value"),
    settingType: varchar("setting_type", { length: 20 }).default("text"),
    description: text("description"),
    createdAt: timestamptzDefault(),
    updatedAt: timestamptzDefault(),
  },
  (t) => ({
    idxKey: index("idx_settings_key").on(t.settingKey),
  })
);

// ============================================
// TABLE 28: chat_conversations
// ============================================
export const chatConversations = pgTable(
  "chat_conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    adminId: uuid("admin_id").references(() => users.id, { onDelete: "set null" }),
    projectId: uuid("project_id").references(() => clientProjects.id, { onDelete: "set null" }),
    subject: varchar("subject", { length: 255 }),
    status: varchar("status", { length: 20 }).default("active"),
    lastMessageAt: timestamptzDefault(),
    unreadUser: integer("unread_user").default(0),
    unreadAdmin: integer("unread_admin").default(0),
    createdAt: timestamptzDefault(),
    updatedAt: timestamptzDefault(),
  },
  (t) => ({
    idxUser: index("idx_chat_conversations_user").on(t.userId),
    idxAdmin: index("idx_chat_conversations_admin").on(t.adminId),
    idxStatus: index("idx_chat_conversations_status").on(t.status),
  })
);

// ============================================
// TABLE 29: chat_messages
// ============================================
export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id").notNull().references(() => chatConversations.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    message: text("message").notNull(),
    messageType: varchar("message_type", { length: 20 }).default("text"),
    fileUrl: text("file_url"),
    fileName: varchar("file_name", { length: 255 }),
    isRead: boolean("is_read").default(false),
    readAt: timestamptz("read_at"),
    isDeleted: boolean("is_deleted").default(false),
    deletedAt: timestamptz("deleted_at"),
    createdAt: timestamptzDefault(),
  },
  (t) => ({
    idxConversation: index("idx_chat_messages_conversation").on(t.conversationId),
    idxSender: index("idx_chat_messages_sender").on(t.senderId),
    idxCreated: index("idx_chat_messages_created").on(t.createdAt),
  })
);

// ============================================
// BETTER AUTH TABLES
// ============================================
export const betterAuthUser = pgTable("better_auth_user", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  createdAt: timestamptzDefault(),
  updatedAt: timestamptzDefault(),
  twoFactorEnabled: boolean("twoFactorEnabled").default(false),
});

export const betterAuthSession = pgTable("better_auth_session", {
  id: text("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => betterAuthUser.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamptz("expiresAt").notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  createdAt: timestamptzDefault(),
  updatedAt: timestamptzDefault(),
});

export const betterAuthAccount = pgTable("better_auth_account", {
  id: text("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => betterAuthUser.id, { onDelete: "cascade" }),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  expiresAt: timestamptz("expiresAt"),
  password: text("password"),
  createdAt: timestamptzDefault(),
  updatedAt: timestamptzDefault(),
});

export const betterAuthVerification = pgTable("better_auth_verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamptz("expiresAt").notNull(),
  createdAt: timestamptzDefault(),
  updatedAt: timestamptzDefault(),
});

export const betterAuthTwoFactor = pgTable("better_auth_two_factor", {
  id: text("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => betterAuthUser.id, { onDelete: "cascade" }),
  secret: text("secret").notNull(),
  backupCodes: text("backupCodes").notNull(),
});
