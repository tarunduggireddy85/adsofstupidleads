import { db } from "@/lib/db";
import { PageTitle, StatusBadge } from "@/components/Shell";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { shortRef } from "@/lib/commission";
import { revalidatePath } from "next/cache";
import Link from "next/link";

async function createLead(formData: FormData) {
  "use server";
  const admin = await requireAdmin();
  const customerName = String(formData.get("customerName") || "").trim();
  const customerPhone = String(formData.get("customerPhone") || "").trim();
  const clientId = String(formData.get("clientId") || "");
  const source = String(formData.get("source") || "").trim() || null;
  const notes = String(formData.get("notes") || "").trim() || null;
  if (!customerName || !customerPhone || !clientId) return;

  // Generate unique ref
  let ref = shortRef();
  for (let i = 0; i < 5; i++) {
    const exists = await db.lead.findUnique({ where: { ref } });
    if (!exists) break;
    ref = shortRef();
  }

  const lead = await db.lead.create({
    data: { ref, customerName, customerPhone, clientId, source, notes, status: "ASSIGNED" },
  });
  await db.statusEvent.create({
    data: { leadId: lead.id, fromStatus: null, toStatus: "ASSIGNED", actorId: admin.id, actorRole: "ADMIN", note: "Lead created and assigned" },
  });
  await audit(admin.id, "ADMIN", "lead.create", `lead:${lead.id}`, { ref, clientId });
  revalidatePath("/admin/leads");
}

async function bulkImport(formData: FormData) {
  "use server";
  const admin = await requireAdmin();
  const clientId = String(formData.get("clientId") || "");
  const text = String(formData.get("bulk") || "");
  if (!clientId || !text.trim()) return;
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    // Format: Name, Phone[, Source]
    const [name, phone, ...rest] = line.split(",").map((s) => s.trim());
    if (!name || !phone) continue;
    let ref = shortRef();
    for (let i = 0; i < 5; i++) {
      if (!(await db.lead.findUnique({ where: { ref } }))) break;
      ref = shortRef();
    }
    const lead = await db.lead.create({
      data: { ref, customerName: name, customerPhone: phone, clientId, source: rest.join(", ") || null, status: "ASSIGNED" },
    });
    await db.statusEvent.create({
      data: { leadId: lead.id, toStatus: "ASSIGNED", actorId: admin.id, actorRole: "ADMIN", note: "Bulk import" },
    });
  }
  await audit(admin.id, "ADMIN", "lead.bulk_import", `client:${clientId}`, { count: lines.length });
  revalidatePath("/admin/leads");
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const where: { clientId?: string; status?: any } = {};
  if (sp.client) where.clientId = sp.client;
  if (sp.status) where.status = sp.status;

  const [clients, leads] = await Promise.all([
    db.client.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.lead.findMany({
      where,
      include: { client: true, conversion: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  return (
    <div>
      <PageTitle title="Leads" subtitle="Add leads and assign to a client" />

      <div className="grid lg:grid-cols-3 gap-5 mb-5">
        <form action={createLead} className="card p-4 space-y-3">
          <h3 className="font-medium">New lead</h3>
          <div><label className="label">Customer name</label><input name="customerName" required className="input" /></div>
          <div><label className="label">Customer phone</label><input name="customerPhone" required className="input" placeholder="+91…" /></div>
          <div>
            <label className="label">Assign to client</label>
            <select name="clientId" required className="input">
              <option value="">— Select —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div><label className="label">Source</label><input name="source" className="input" placeholder="Meta Ads — Campaign X" /></div>
          <div><label className="label">Notes</label><textarea name="notes" className="input" rows={2} /></div>
          <button className="btn-primary w-full">Create lead</button>
        </form>

        <form action={bulkImport} className="card p-4 space-y-3 lg:col-span-2">
          <h3 className="font-medium">Bulk import</h3>
          <div>
            <label className="label">Client</label>
            <select name="clientId" required className="input">
              <option value="">— Select —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Paste leads (one per line: Name, Phone, Source)</label>
            <textarea name="bulk" className="input font-mono" rows={6} placeholder={"Rohan, +919812345678, Meta Ads\nPriya, +919876543210"} />
          </div>
          <button className="btn-primary">Import all</button>
        </form>
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-3 flex-wrap">
          <span className="text-sm text-muted">Filter:</span>
          <Link href="/admin/leads" className="btn-ghost">All</Link>
          {["NEW","ASSIGNED","CONTACTED","QUOTED","NEGOTIATING","CONVERTED","REJECTED","LOST"].map(s => (
            <Link key={s} href={`/admin/leads?status=${s}`} className="btn-ghost">{s}</Link>
          ))}
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Ref</th><th>Customer</th><th>Client</th><th>Status</th><th>Deal</th><th>Created</th><th></th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id}>
                <td className="font-mono text-xs">{l.ref}</td>
                <td>{l.customerName}<div className="text-xs text-muted">{l.customerPhone}</div></td>
                <td>{l.client.name}</td>
                <td><StatusBadge status={l.status} /></td>
                <td className="text-xs">{l.conversion ? `${l.client.currency} ${l.conversion.dealAmount}` : "—"}</td>
                <td className="text-muted text-xs">{l.createdAt.toLocaleString()}</td>
                <td><Link href={`/admin/leads/${l.id}`} className="btn-ghost">Open</Link></td>
              </tr>
            ))}
            {!leads.length && <tr><td colSpan={7} className="text-center text-muted py-8">No leads.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
