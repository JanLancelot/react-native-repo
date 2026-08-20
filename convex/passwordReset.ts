import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { modifyAccountCredentials } from "@convex-dev/auth/server";

const RESET_CODE_EXPIRATION_MS = 15 * 60 * 1000; // 15 minutes

/**
 * 1. Request Password Reset
 * Generates a 6-digit OTP code for the given user email and saves it to Convex database.
 */
export const requestPasswordReset = mutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();

    // Check if user exists by email
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (!user) {
      // Return generic message for security, preventing email enumeration
      return {
        success: true,
        message: "If an account with that email exists, a password reset code has been sent.",
      };
    }

    if (user.isActive === false) {
      throw new ConvexError("Account is suspended or inactive. Please contact support.");
    }

    // Invalidate any existing unused reset tokens for this email
    const existingTokens = await ctx.db
      .query("passwordResetTokens")
      .withIndex("by_email", (q) => q.eq("email", email))
      .collect();

    for (const tokenDoc of existingTokens) {
      if (!tokenDoc.used) {
        await ctx.db.patch(tokenDoc._id, { used: true });
      }
    }

    // Generate a 6-digit OTP reset code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const now = Date.now();
    const expiresAt = now + RESET_CODE_EXPIRATION_MS;

    await ctx.db.insert("passwordResetTokens", {
      email,
      code,
      expiresAt,
      used: false,
      createdAt: now,
    });

    return {
      success: true,
      message: "If an account with that email exists, a password reset code has been sent.",
      code, // Included for easy development and debugging
    };
  },
});

/**
 * 2. Verify Reset Code
 * Checks if a given email & 6-digit code combination is valid and not expired.
 */
export const verifyResetCode = query({
  args: {
    email: v.string(),
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const code = args.code.trim();

    const tokenDoc = await ctx.db
      .query("passwordResetTokens")
      .withIndex("by_email_and_code", (q) =>
        q.eq("email", email).eq("code", code)
      )
      .first();

    if (!tokenDoc || tokenDoc.used || tokenDoc.expiresAt < Date.now()) {
      return { valid: false, message: "Invalid or expired reset code." };
    }

    return { valid: true, message: "Reset code is valid." };
  },
});

/**
 * 3. Reset Password
 * Verifies the reset code and updates the user's password in Convex Auth.
 */
export const resetPassword = mutation({
  args: {
    email: v.string(),
    code: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const code = args.code.trim();
    const newPassword = args.newPassword;

    if (newPassword.length < 8) {
      throw new ConvexError("New password must be at least 8 characters long.");
    }

    // Verify token validity
    const tokenDoc = await ctx.db
      .query("passwordResetTokens")
      .withIndex("by_email_and_code", (q) =>
        q.eq("email", email).eq("code", code)
      )
      .first();

    if (!tokenDoc || tokenDoc.used || tokenDoc.expiresAt < Date.now()) {
      throw new ConvexError("Invalid or expired password reset code.");
    }

    // Mark token as used immediately to prevent reuse
    await ctx.db.patch(tokenDoc._id, { used: true });

    // Update account credentials in Convex Auth
    try {
      await modifyAccountCredentials(ctx as any, {
        provider: "password",
        account: { id: email, secret: newPassword },
      });
    } catch (err: any) {
      throw new ConvexError(
        err.message || "Failed to update password. Account not found in auth provider."
      );
    }

    return {
      success: true,
      message: "Your password has been successfully reset. You can now log in with your new password.",
    };
  },
});
