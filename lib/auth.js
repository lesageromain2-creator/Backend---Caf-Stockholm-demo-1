// backend/lib/auth.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db";
import * as schema from "../db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.betterAuthUser,
      session: schema.betterAuthSession,
      account: schema.betterAuthAccount,
      verification: schema.betterAuthVerification,
    },
  }),

  // Email/Password
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
  },

  // OAuth Providers
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      enabled: !!process.env.GOOGLE_CLIENT_ID,
    },
    apple: {
      clientId: process.env.APPLE_CLIENT_ID || "",
      clientSecret: process.env.APPLE_CLIENT_SECRET || "",
      enabled: !!process.env.APPLE_CLIENT_ID,
    },
  },

  // 2FA
  twoFactor: {
    enabled: true,
    issuer: "LeSageDev",
  },

  // Session
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 jours
    updateAge: 60 * 60 * 24, // 1 jour
  },

  // Emails avec Resend (utilise votre emailService existant)
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url, token }) => {
      // Utiliser votre emailService existant
      const emailService = require("../services/emailService");
      
      try {
        await emailService.sendEmailVerification(user.email, {
          name: user.name || user.email,
          verificationUrl: url,
          token,
        });
      } catch (error) {
        console.error("❌ Erreur envoi email vérification:", error);
        throw error;
      }
    },
  },

  // Reset password
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url, token }) => {
      const emailService = require("../services/emailService");
      
      try {
        await emailService.sendPasswordReset(user.email, {
          name: user.name || user.email,
          resetUrl: url,
          token,
        });
      } catch (error) {
        console.error("❌ Erreur envoi email reset:", error);
        throw error;
      }
    },
  },

  // Origins autorisées
  trustedOrigins: [
    process.env.FRONTEND_URL || "http://localhost:3000",
  ],
});

export type Session = typeof auth.$Infer.Session;