import { db } from "@/lib/db";
import { PageTitle, StatusBadge } from "@/components/Shell";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { computeCommission, fmtMoney } from "@/lib/commission";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

const ALL_STATUSES = ["NEW","ASSIGNED","CONTACTED","QUOTED","NEGOTIATING","CONVERTED","REJECTED","LOST"] as const;

async function changeStatus(formData: FormData) {
  "use server";
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  const toStatus = String(formData.get("toStatus")) as typeof ALL_STATUSES[number];
  const note = String(formData.get("note") || "").trim() || null;
  const lead = await db.lead.findUnique({ where: { id }, include: { client: true } });
  if (!lead) return;
  if (lead.status === toStatus) return;

  // If forcing to CONVERTED via admin, require dealAmount
  let dealAmount: number | null = null;
  if (toStatus === "CONVERTED") {
    dealAmount = Number(formData.get("dealAmount") || 0);
    if (!dealAmount || dealAmount <= 0) return;
  }

  await db.$transaction(async (tx) => {
    await tx.lead.update({
      where: { id },
      data: { status: toStatus, dealAmount: dealAmount ?? lead.dealAmount },
    });
    await tx.statusEvent.create({
      data: { leadId: id, fromStatus: lead.status, toStatus, actorId: admin.id, actorRole: "ADMIN", note },
    });
    if (toStatus === "CONVERTED" && dealAmount) {
      const commission = computeCommission(lead.client.commissionType, lead.client.commissionValue, dealAmount);
      await tx.conversion.upsert({
        where: { leadId: id },
        update: { dealAmount, commission, status: "APPROVED", reviewedById: admin.id, reviewedAt: new Date() },
        create: { leadId: id, dealAmount, commission, status: "APPROVED", submittedById: admin.id, reviewedById: admin.id, reviewedAt: new Date() },
      });
    }
  });
  await audit(admin.id, "ADMIN", "lead.status", `lead:${id}`, { from: lead.status, to: toStatus, dealAmount });
  revalidatePath(`/admin/leads/${id}`);
  revalidatePath("/admin/leads");
}

async function deleteLead(formData: FormData) {
  "use server";
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  await db.lead.delete({ where: { id } });
  await audit(admin.id, "ADMIN", "lead.delete", `lead:${id}`);
  redirect("/admin/leads");
}

export default async function LeadDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await db.lead.findUnique({
    where: { id },
    include: {
      client: true,
      events: { orderBy: { createdAt: "desc" } },
      conversion: true,
    },
  });
  if (!lead) notFound();

  return (
    <div>
      <PageTitle
        title={`Lead ${lead.ref}`}
        subtitle={`${lead.customerName} · ${lead.customerPhone}`}
        action={<StatusBadge status={lead.status} />}
      />
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <div className="card p-4">
            <h3 className="font-medium mb-2">Details</h3>
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-muted">Client</dt><dd>{lead.client.name}</dd>
              <dt className="text-muted">Source</dt><dd>{lead.source ?? "—"}</dd>
              <dt className="text-muted">Notes</dt><dd>{lead.notes ?? "—"}</dd>
              <dt className="text-muted">Created</dt><dd>{lead.createdAt.toLocaleString()}</dd>
              <dt className="text-muted">Commission</dt>
              <dd>
                {lead.client.commissionType === "NONE" ? "None" :
                  lead.client.commissionType === "PERCENT" ? `${lead.client.commissionValue}%` :
                  `${lead.client.currency} ${lead.client.commissionValue} fixed`}
              </dd>
            </dl>
          </div>

          {lead.conversion && (
            <div className="card p-4">
              <h3 className="font-medium mb-2">Conversion</h3>
              <div className="text-sm">
                Deal: <strong>{fmtMoney(lead.conversion.dealAmount, lead.client.currency)}</strong> ·
                Commission: <strong>{fmtMoney(lead.conversion.commission, lead.client.currency)}</strong> ·
                Status: <StatusBadge status={lead.conversion.status} />
              </div>
              {lead.conversion.proofPath && (
                <a href={lead.conversion.proofPath} target="_blank" className="text-accent text-sm underline mt-2 inline-block">View proof</a>
              )}
            </div>
          )}

          <div className="card p-4">
            <h3 className="font-medium mb-3">Timeline</h3>
            <ul className="space-y-3">
              {lead.events.map((e) => (
                <li key={e.id} className="border-l-2 border-border pl-3">
                  <div className="text-sm">
                    {e.fromStatus ? `${e.fromStatus} → ` : ""}<strong>{e.toStatus}</strong>
                    <span className="text-xs text-muted ml-2">{e.createdAt.toLocaleString()} · {e.actorRole}</span>
                  </div>
                  {e.note && <div className="text-xs text-muted">{e.note}</div>}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-5">
          <form action={changeStatus} className="card p-4 space-y-3">
            <h3 className="font-medium">Update status</h3>
            <input type="hidden" name="id" value={lead.id} />
            <div>
              <label className="label">New status</label>
              <select name="toStatus" className="input" defaultValue={lead.status}>
                {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Deal amount (only if CONVERTED)</label>
              <input name="dealAmount" type="number" step="0.01" className="input" />
            </div>
            <div>
              <label className="label">Note</label>
              <textarea name="note" className="input" rows={2} />
            </div>
            <button className="btn-primary w-full">Save</button>
          </form>

          <form action={deleteLead} className="card p-4">
            <input type="hidden" name="id" value={lead.id} />
            <button className="btn-danger w-full">Delete lead</button>
          </form>
        </div>
      </div>
    </div>
  );
}
