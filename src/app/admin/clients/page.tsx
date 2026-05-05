import { db } from "@/lib/db";
import { PageTitle } from "@/components/Shell";
import { hashPassword, requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import Link from "next/link";

async function createClient(formData: FormData) {
  "use server";
  const admin = await requireAdmin();
  const name = String(formData.get("name") || "").trim();
  const businessName = String(formData.get("businessName") || "").trim() || null;
  const whatsappNumber = String(formData.get("whatsappNumber") || "").trim() || null;
  const commissionType = String(formData.get("commissionType") || "NONE") as "NONE" | "PERCENT" | "FIXED";
  const commissionValue = Number(formData.get("commissionValue") || 0);
  const currency = String(formData.get("currency") || "INR");
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  if (!name || !email || !password) return;

  const client = await db.client.create({
    data: { name, businessName, whatsappNumber, commissionType, commissionValue, currency },
  });
  const passwordHash = await hashPassword(password);
  await db.user.create({
    data: { email, name, passwordHash, role: "CLIENT", clientId: client.id },
  });
  await audit(admin.id, "ADMIN", "client.create", `client:${client.id}`, { name, email });
  revalidatePath("/admin/clients");
}

async function toggleActive(formData: FormData) {
  "use server";
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  const c = await db.client.findUnique({ where: { id } });
  if (!c) return;
  await db.client.update({ where: { id }, data: { active: !c.active } });
  await audit(admin.id, "ADMIN", "client.toggle", `client:${id}`, { active: !c.active });
  revalidatePath("/admin/clients");
}

export default async function ClientsPage() {
  const clients = await db.client.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: true, _count: { select: { leads: true } } },
  });

  return (
    <div>
      <PageTitle title="Clients" subtitle="Create accounts for the people you forward leads to" />

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-1">
          <form action={createClient} className="card p-4 space-y-3">
            <h3 className="font-medium">Add a client</h3>
            <div>
              <label className="label">Name</label>
              <input name="name" required className="input" />
            </div>
            <div>
              <label className="label">Business Name</label>
              <input name="businessName" className="input" />
            </div>
            <div>
              <label className="label">WhatsApp Number</label>
              <input name="whatsappNumber" className="input" placeholder="+91…" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Commission</label>
                <select name="commissionType" className="input">
                  <option value="NONE">None</option>
                  <option value="PERCENT">% of deal</option>
                  <option value="FIXED">Fixed amount</option>
                </select>
              </div>
              <div>
                <label className="label">Value</label>
                <input name="commissionValue" type="number" step="0.01" defaultValue={0} className="input" />
              </div>
            </div>
            <div>
              <label className="label">Currency</label>
              <input name="currency" defaultValue="INR" className="input" />
            </div>
            <div className="border-t border-border pt-3 mt-2">
              <h4 className="text-sm font-medium mb-2">Login for client</h4>
              <div>
                <label className="label">Email</label>
                <input name="email" type="email" required className="input" />
              </div>
              <div className="mt-2">
                <label className="label">Password</label>
                <input name="password" type="text" required className="input" />
              </div>
              <p className="text-xs text-muted mt-1">Share these with your client.</p>
            </div>
            <button className="btn-primary w-full">Create client</button>
          </form>
        </div>

        <div className="lg:col-span-2 card overflow-hidden">
          <table className="tbl">
            <thead>
              <tr>
                <th>Client</th>
                <th>Login</th>
                <th>Commission</th>
                <th>Leads</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted">{c.businessName ?? ""} {c.whatsappNumber ? `· ${c.whatsappNumber}` : ""}</div>
                  </td>
                  <td className="text-xs">{c.user?.email}</td>
                  <td className="text-xs">
                    {c.commissionType === "NONE"
                      ? "—"
                      : c.commissionType === "PERCENT"
                      ? `${c.commissionValue}%`
                      : `${c.currency} ${c.commissionValue}`}
                  </td>
                  <td>{c._count.leads}</td>
                  <td>
                    <span className={c.active ? "badge bg-emerald-500/20 text-emerald-300" : "badge bg-gray-500/20 text-gray-300"}>
                      {c.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <form action={toggleActive}>
                      <input type="hidden" name="id" value={c.id} />
                      <button className="btn-ghost">{c.active ? "Deactivate" : "Activate"}</button>
                    </form>
                  </td>
                </tr>
              ))}
              {!clients.length && (
                <tr><td colSpan={6} className="text-center text-muted py-8">No clients yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6">
        <Link href="/admin" className="text-sm text-muted hover:text-white">← Back to dashboard</Link>
      </div>
    </div>
  );
}
