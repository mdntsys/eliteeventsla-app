"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireSuperAdmin } from "@/lib/auth/dal";
import {
  APP_ROLES,
  AREAS,
  ROLE_AREA_DEFAULTS,
  type Area,
  type AppRole,
} from "@/lib/auth/roles";
import { sendEmail } from "@/lib/email/send";
import { welcomeEmail } from "@/lib/email/templates";
import { headers } from "next/headers";
import { randomBytes } from "crypto";

/**
 * Write paths for the Team console. EVERY action gates on requireSuperAdmin()
 * (people/permission management is the super-admin tier only) — defense in depth
 * alongside RLS. Non-invite mutations use the normal authed server client so the
 * super admin's JWT drives the trigger/RLS; only inviteUser needs the
 * service-role client (and degrades gracefully if the key is absent).
 */

export type ActionState =
  | { error?: string; success?: boolean; notice?: string }
  | undefined;

const roleEnum = z.enum(APP_ROLES);
const areaEnum = z.enum(AREAS);

/** Pull the first zod issue message for a friendly action error. */
function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Please check your input.";
}

// --- Role / status / super-admin toggles ------------------------------------

const SetRoleSchema = z.object({
  userId: z.uuid("A user is required."),
  // "" => clear the role (pending user).
  role: z
    .union([roleEnum, z.literal("")])
    .transform((v) => (v === "" ? null : v)),
});

export async function setUserRole(
  userId: string,
  role: AppRole | null,
): Promise<ActionState> {
  await requireSuperAdmin();

  const parsed = SetRoleSchema.safeParse({ userId, role: role ?? "" });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ role: parsed.data.role, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.userId);

  if (error) return { error: error.message };

  revalidatePath("/admin/team");
  return { success: true };
}

const ToggleSuperAdminSchema = z.object({
  userId: z.uuid("A user is required."),
  value: z.boolean(),
});

export async function toggleSuperAdmin(
  userId: string,
  value: boolean,
): Promise<ActionState> {
  await requireSuperAdmin();

  const parsed = ToggleSuperAdminSchema.safeParse({ userId, value });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      is_super_admin: parsed.data.value,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.userId);

  if (error) return { error: error.message };

  revalidatePath("/admin/team");
  return { success: true };
}

const SetActiveSchema = z.object({
  userId: z.uuid("A user is required."),
  value: z.boolean(),
});

export async function setUserActive(
  userId: string,
  value: boolean,
): Promise<ActionState> {
  await requireSuperAdmin();

  const parsed = SetActiveSchema.safeParse({ userId, value });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      is_active: parsed.data.value,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.userId);

  if (error) return { error: error.message };

  revalidatePath("/admin/team");
  return { success: true };
}

// --- Per-area View/Edit matrix ----------------------------------------------

const SetAreaPermissionSchema = z.object({
  userId: z.uuid("A user is required."),
  area: areaEnum,
  can_view: z.boolean(),
  can_edit: z.boolean(),
});

/**
 * Set a user's explicit View/Edit override for one area. Edit implies view.
 *
 * "Start full, dial back": rows exist only to RESTRICT below the role preset, so
 * when the requested {view,edit} EQUALS the user's current role-preset default
 * for that area we DELETE the row instead of writing it (a true "reset").
 */
export async function setAreaPermission(
  userId: string,
  area: Area,
  can_view: boolean,
  can_edit: boolean,
): Promise<ActionState> {
  const admin = await requireSuperAdmin();

  // Edit implies view.
  const view = can_view || can_edit;
  const edit = can_edit;

  const parsed = SetAreaPermissionSchema.safeParse({
    userId,
    area,
    can_view: view,
    can_edit: edit,
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const supabase = await createClient();

  // Look up the target user's role so we can compare against its preset.
  const { data: target, error: targetErr } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", parsed.data.userId)
    .single();
  if (targetErr) return { error: targetErr.message };

  const role = target?.role as AppRole | null;
  const preset = role ? ROLE_AREA_DEFAULTS[role]?.[parsed.data.area] : undefined;
  const presetView = !!preset?.view;
  const presetEdit = !!preset?.edit;

  // If the requested permission equals the role preset, no override is needed —
  // delete any existing row so the user follows the preset again.
  if (parsed.data.can_view === presetView && parsed.data.can_edit === presetEdit) {
    const { error } = await supabase
      .from("user_module_permissions")
      .delete()
      .eq("user_id", parsed.data.userId)
      .eq("module", parsed.data.area);
    if (error) return { error: error.message };
    revalidatePath("/admin/team");
    return { success: true };
  }

  const { error } = await supabase.from("user_module_permissions").upsert(
    {
      user_id: parsed.data.userId,
      module: parsed.data.area,
      can_view: parsed.data.can_view,
      can_edit: parsed.data.can_edit,
      updated_by: admin.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,module" },
  );
  if (error) return { error: error.message };

  revalidatePath("/admin/team");
  return { success: true };
}

/** Reset a single area back to the role preset by deleting its override row. */
export async function resetAreaPermission(
  userId: string,
  area: Area,
): Promise<ActionState> {
  await requireSuperAdmin();

  const parsed = z
    .object({ userId: z.uuid("A user is required."), area: areaEnum })
    .safeParse({ userId, area });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("user_module_permissions")
    .delete()
    .eq("user_id", parsed.data.userId)
    .eq("module", parsed.data.area);
  if (error) return { error: error.message };

  revalidatePath("/admin/team");
  return { success: true };
}

// --- Invite ------------------------------------------------------------------

const InviteSchema = z.object({
  email: z.email("Enter a valid email."),
  fullName: z
    .string()
    .transform((v) => v.trim())
    .transform((v) => (v === "" ? null : v)),
  role: z
    .union([roleEnum, z.literal("")])
    .transform((v) => (v === "" ? null : v)),
});

/**
 * Invite a user by email. Public signup is disabled, so we create the account
 * with the SERVICE-ROLE admin client (a strong temp password, email pre-confirmed),
 * set their role via the SUPER ADMIN's own session (the service client has no
 * auth.uid(), so the privilege trigger would block a role change), and email a
 * branded welcome with the temp password + a link, via Resend. Degrades
 * gracefully if the service-role key (or Resend) is absent.
 *
 * Bound via useActionState (prev, formData).
 */
export async function inviteUser(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireSuperAdmin();

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: "Add SUPABASE_SERVICE_ROLE_KEY to create users." };
  }

  const parsed = InviteSchema.safeParse({
    email: formData.get("email"),
    fullName: formData.get("fullName") ?? "",
    role: formData.get("role") ?? "",
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const { email, fullName, role } = parsed.data;

  let service: ReturnType<typeof createServiceClient>;
  try {
    service = createServiceClient();
  } catch {
    return { error: "Add SUPABASE_SERVICE_ROLE_KEY to create users." };
  }

  const tempPassword = "Elite2026!" + randomBytes(4).toString("hex");
  const { data: created, error } = await service.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: fullName ? { full_name: fullName } : undefined,
  });

  if (error) {
    const exists = /already|registered|exists/i.test(error.message);
    return { error: exists ? "That email already has an account." : error.message };
  }

  // Set role + name via the SUPER ADMIN's session (RLS + the privilege trigger
  // allow it; the service client would be blocked since it has no auth.uid()).
  const newId = created?.user?.id;
  if (newId && (role || fullName)) {
    const supabase = await createClient();
    const update: { role?: AppRole; full_name?: string } = {};
    if (role) update.role = role;
    if (fullName) update.full_name = fullName;
    await supabase.from("profiles").update(update).eq("id", newId);
  }

  // Branded welcome email (temp password + sign-in link) via Resend.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "app.eliteeventsla.com";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const sent = await sendEmail({
    to: email,
    ...welcomeEmail({
      fullName,
      email,
      tempPassword,
      signInUrl: `${proto}://${host}/login`,
    }),
  });

  revalidatePath("/admin/team");

  if (sent.skipped) {
    return {
      success: true,
      notice: `Created ${email}. Email is off (no RESEND_API_KEY) — temporary password: ${tempPassword}`,
    };
  }
  if (!sent.ok) {
    return {
      success: true,
      notice: `Created ${email}, but the welcome email failed (${sent.error ?? "unknown"}). Share this temporary password manually: ${tempPassword}`,
    };
  }
  return {
    success: true,
    notice: `Invited ${email} — a welcome email with their temporary password was sent.`,
  };
}
