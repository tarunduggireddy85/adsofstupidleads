import { db } from "@/lib/db";
import { requireClient } from "@/lib/auth";
import { PageTitle, StatusBadge } from "@/components/Shell";
import { audit } from "@/lib/audit";
import { computeCommission, fmtMoney } from "@/lib/commission";
import { saveUpload } from "@/lib/upload";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";

const CLIENT_STATUSES = ["CONTACTED", "QUOTED", "NEGOTIATING", "LOST"] as const;

async function updateStatus(formData: FormData) {
  "use server";
  const user = await requireClient();
  const id = String(formData.get("id"));
  const toStatus = String(formData.get("toStatus")) as typeof CLIENT_STATUSES[number];
  const note = String(formData.get("note") || "").trim() || null;
  const lead = await db.lead.findUnique({ where: { id } });
  if (!lead || lead.clientId !== user.clientId) return;
  if (!CLIENT_STATUSES.includes(toStatus)) return;
  if (lead.status === toStatus) return;

  await db.$transaction(async (tx) => {
    await tx.lead.update({ where: { id }, data: { status: toStatus } });
    await tx.statusEvent.create({
      data: { leadId: id, fromStatus: lead.status, toStatus, actorId: user.id, actorRole: "CLIENT", note },
    });
  });
  await audit(user.id, "CLIENT", "lead.status", `lead:${id}`, { from: lead.status, to: toStatus });
  revalidatePath(`/client/leads/${id}`);
}

async function reportConversion(formData: FormData) {
  "use server";
  const user = await requireClient();
  const id = String(formData.get("id"));
  const dealAmount = Number(formData.get("dealAmount") || 0);
  const note = String(formData.get("note") || "").trim() || null;
  const proof = formData.get("proof") as File | null;

  if (!dealAmount || dealAmount <= 0) return;

  const lead = await db.lead.findUnique({ where: { id }, include: { client: true } });
  if (!lead || lead.clientId !== user.clientId) return;

  let proofPath: string | null = null;
  if (proof && typeof proof === "object" && proof.size > 0) {
    proofPath = await saveUpload(proof, "proofs");
  }

  const commission = computeCommission(lead.client.commissionType, lead.client.commissionValue, dealAmount);

  await db.$transaction(async (tx) => {
    await tx.conversion.upsert({
      where: { leadId: id },
      update: { dealAmount, commission, proofPath: proofPath ?? undefined, status: "PENDING", submittedById: user.id },
      create: { leadId: id, dealAmount, commission, proofPath, status: "PENDING", submittedById: user.id },
    });
    await tx.statusEvent.create({
      data: { leadId: id, fromStatus: lead.status, toStatus: lead.status, actorId: user.id, actorRole: "CLIENT", note: `Reported conversion · ${dealAmount} · ${note ?? ""}`.trim() },
    });
  });
  await audit(user.id, "CLIENT", "conversion.submit", `lead:${id}`, { dealAmount });
  revalidatePath(`/client/leads/${id}`);
}

export default async function ClientLeadDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireClient();
  const { id } = await params;
  const lead = await db.lead.findUnique({
    where: { id },
    include: { client: true, events: { orderBy: { createdAt: "desc" } }, conversion: true },
  });
  if (!lead || lead.clientId !== user.clientId) notFound();

  const isClosed = ["CONVERTED", "REJECTED"].includes(lead.status);

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
              <dt className="text-muted">Customer</dt><dd>{lead.customerName}</dd>
              <dt className="text-muted">Phone</dt><dd><a href={`https://wa.me/${lead.customerPhone.replace(/[^0-9]/g, "")}`} target="_blank" className="text-accent underline">{lead.customerPhone}</a></dd>
              <dt className="text-muted">Source</dt><dd>{lead.source ?? "—"}</dd>
              <dt className="text-muted">Notes</dt><dd>{lead.notes ?? "—"}</dd>
              <dt className="text-muted">Commission</dt>
              <dd>
                {lead.client.commissionType === "NONE" ? "None" :
                  lead.client.commissionType === "PERCENT" ? `${lead.client.commissionValue}% of deal` :
                  `${lead.client.currency} ${lead.client.commissionValue} fixed`}
              </dd>
            </dl>
          </div>

          {lead.conversion && (
            <div className="card p-4">
              <h3 className="font-medium mb-2">Your conversion report</h3>
              <div className="text-sm">
                Deal: <strong>{fmtMoney(lead.conversion.dealAmount, lead.client.currency)}</strong> ·
                Commission: <strong>{fmtMoney(lead.conversion.commission, lead.client.currency)}</strong> ·
                Status: <StatusBadge status={lead.conversion.status} />
              </div>
              {lead.conversion.proofPath && <a href={lead.conversion.proofPath} target="_blank" className="text-accent text-sm underline mt-2 inline-block">View uploaded proof</a>}
              {lead.conversion.reviewNote && <div className="text-xs text-muted mt-2">Admin note: {lead.conversion.reviewNote}</div>}
            </div>
          )}

          <div className="card p-4">
            <h3 className="font-medium mb-3">Timeline</h3>
            <ul className="space-y-3">
              {lead.events.map((e) => (
                <li key={e.id} className="border-l-2 border-border pl-3">
                  <div className="text-sm">{e.fromStatus ? `${e.fromStatus} → ` : ""}<strong>{e.toStatus}</strong>
                    <span className="text-xs text-muted ml-2">{e.createdAt.toLocaleString()} · {e.actorRole}</span></div>
                  {e.note && <div className="text-xs text-muted">{e.note}</div>}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-5">
          {!isClosed && (
            <form action={updateStatus} className="card p-4 space-y-3">
              <h3 className="font-medium">Update status</h3>
              <input type="hidden" name="id" value={lead.id} />
              <div>
                <label className="label">New status</label>
                <select name="toStatus" className="input" defaultValue="CONTACTED">
                  {CLIENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div><label className="label">Note</label><textarea name="note" className="input" rows={2} /></div>
              <button className="btn-primary w-full">Save</button>
            </form>
          )}

          {!isClosed && (
            <form action={reportConversion} className="card p-4 space-y-3" encType="multipart/form-data">
              <h3 className="font-medium">Report conversion</h3>
              <p className="text-xs text-muted">Upload payment screenshot or quotation. Admin will review.</p>
              <input type="hidden" name="id" value={lead.id} />
              <div>
                <label className="label">Deal amount ({lead.client.currency})</label>
                <input name="dealAmount" type="number" step="0.01" required className="input" />
              </div>
              <div>
                <label className="label">Proof (image/pdf)</label>
                <input name="proof" type="file" accept="image/*,application/pdf" className="input" />
              </div>
              <div>
                <label className="label">Note</label>
                <textarea name="note" className="input" rows={2} />
              </div>
              <button className="btn-primary w-full">Submit for approval</button>
            </form>
          )}

          {isClosed && (
            <div className="card p-4 text-sm text-muted">This lead is closed.</div>
          )}
        </div>
      </div>
    </div>
  );
}
