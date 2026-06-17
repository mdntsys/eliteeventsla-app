"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const LoginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export type LoginState = { error: string } | undefined;

/** Only allow same-origin relative paths as a post-login destination. */
function safeRedirect(target: FormDataEntryValue | null): string {
  const t = typeof target === "string" ? target : "";
  return t.startsWith("/") && !t.startsWith("//") ? t : "/dashboard";
}

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Enter a valid email and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { error: "Invalid email or password." };
  }

  // redirect() throws to perform the navigation — must be outside try/catch.
  redirect(safeRedirect(formData.get("redirectTo")));
}
