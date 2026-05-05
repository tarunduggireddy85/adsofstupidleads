import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, verifyPassword, getCurrentUser } from "@/lib/auth";

async function loginAction(formData: FormData) {
  "use server";
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const user = await db.user.findUnique({ where: { email } });
  if (!user) redirect("/login?error=Invalid+credentials");
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) redirect("/login?error=Invalid+credentials");
  await createSession({ uid: user.id, role: user.role });
  redirect(user.role === "ADMIN" ? "/admin" : "/client");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const u = await getCurrentUser();
  if (u) redirect(u.role === "ADMIN" ? "/admin" : "/client");
  const { error } = await searchParams;
  return (
    <div className="min-h-screen grid place-items-center p-6">
      <form action={loginAction} className="card w-full max-w-sm p-6 space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Ads of Stupid Leads</h1>
          <p className="text-sm text-muted">Sign in to continue</p>
        </div>
        {error && (
          <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded p-2">
            {error}
          </div>
        )}
        <div>
          <label className="label">Email</label>
          <input name="email" type="email" required className="input" autoComplete="email" />
        </div>
        <div>
          <label className="label">Password</label>
          <input name="password" type="password" required className="input" autoComplete="current-password" />
        </div>
        <button type="submit" className="btn-primary w-full">Sign in</button>
      </form>
    </div>
  );
}
