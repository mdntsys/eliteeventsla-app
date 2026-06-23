"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/dal";

/**
 * Self-service account actions. changePassword verifies the user's CURRENT
 * password (via a sessionless token request, so the live session is untouched)
 * before calling updateUser — defense against an unlocked-session takeover.
 */

export type ActionState = { error?: string; success?: boolean } | undefined;

const ChangePasswordSchema = z
  .object({
    current_password: z.string().min(1, "Enter your current password."),
    new_password: z
      .string()
      .min(8, "New password must be at least 8 characters."),
    confirm_password: z.string().min(1, "Confirm your new password."),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: "New passwords don't match.",
    path: ["confirm_password"],
  })
  .refine((d) => d.new_password !== d.current_password, {
    message: "New password must be different from your current one.",
    path: ["new_password"],
  });

export async function changePassword(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = ChangePasswordSchema.safeParse({
    current_password: formData.get("current_password"),
    new_password: formData.get("new_password"),
    confirm_password: formData.get("confirm_password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check your input." };
  }
  if (!user.email) {
    return { error: "Your account has no email on file." };
  }

  // Verify the current password against GoTrue without touching the session.
  const verify = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: user.email,
        password: parsed.data.current_password,
      }),
    },
  );
  if (!verify.ok) {
    return { error: "Your current password is incorrect." };
  }

  // Update the password on the live (cookie) session.
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.new_password,
  });
  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
