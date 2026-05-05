import { db } from "@/lib/db";
import { PageTitle, StatusBadge } from "@/components/Shell";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { computeCommission, fmtMoney } from "@/lib/commission";
import { revalidatePath } from "next/cache";

async function review(formData: FormData) {
  "use server";
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  const decision = String(formData.get("decision")) as "APPROVED" | "DISPUTED";
  const reviewNote = String(formData.get("reviewNote") || "").trim() || null;
  const adjustedAmount = Number(formData.get("adjustedAmount") || 0);

  const conv = await db.conversion.findUnique({ where: { id }, include: { lead: { include: { client: true } } } });
  if (!conv) return;

  let dealAmount = conv.dealAmount;
  let commission = conv.commission;
  if (adjustedAmount > 0 && adjustedAmount !== conv.dealAmount) {
    dealAmount = adjustedAmount;
    commission = computeCommission(conv.lead.client.commissionType, conv.lead.client.commissionValue, dealAmount);
  }

  await db.$transaction(async (tx) => {
    await tx.conversion.update({
      where: { id },
      data: { status: decision, reviewNote, reviewedById: admin.id, reviewedAt: new Date(), dealAmount, commission },
    });
    if (decision === "APPROVED") {
      await tx.lead.update({ where: { id: conv.leadId }, data: { status: "CONVERTED", dealAmount } });
      await tx.statusEvent.create({
        data: { leadId: conv.leadId, fromStatus: conv.lead.status, toStatus: "CONVERTED", actorId: admin.id, actorRole: "ADMIN", note: `Approved · ${reviewNote ?? ""}`.trim() },
      });
    } else {
      await tx.statusEvent.create({
        data: { leadId: conv.leadId, fromStatus: conv.lead.status, toStatus: conv.lead.status, actorId: admin.id, actorRole: "ADMIN", note: `Disputed · ${reviewNote ?? ""}`.trim() },
      });
    }
  });
  await audit(admin.id, "ADMIN", "conversion.review", `conversion:${id}`, { decision, dealAmount });
  revalidatePath("/admin/conversions");
}

export default async function ConversionsPage() {
  const conversions = await db.conversion.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { lead: { include: { client: true } } },
  });

  return (
    <div>
      <PageTitle title="Conversions" subtitle="Review what clients reported" />
      <div className="card overflow-hidden">
        <table className="tbl">
          <thead>
            <tr>
              <th>Lead</th><th>Client</th><th>Deal</th><th>Commission</th><th>Proof</th><th>Status</th><th>Action</th>
            </tr>
          </thead>
          <tbody>
            {conversions.map((c) => (
              <tr key={c.id}>
                <td>
                  <div className="font-mono text-xs">{c.lead.ref}</div>
                  <div className="text-xs text-muted">{c.lead.customerName}</div>
                </td>
                <td>{c.lead.client.name}</td>
                <td>{fmtMoney(c.dealAmount, c.lead.client.currency)}</td>
                <td>{fmtMoney(c.commission, c.lead.client.currency)}</td>
                <td>
                  {c.proofPath
                    ? <a href={c.proofPath} target="_blank" className="text-accent underline">View</a>
                    : <span className="text-muted text-xs">—</span>}
                </td>
                <td><StatusBadge status={c.status} /></td>
                <td>
                  {c.status === "PENDING" ? (
                    <details>
                      <summary className="btn-ghost cursor-pointer">Review</summary>
                      <form action={review} className="mt-2 space-y-2 p-2 bg-bg/50 rounded border border-border w-72">
                        <input type="hidden" name="id" value={c.id} />
                        <div>
                          <label className="label">Adjust amount (optional)</label>
                          <input name="adjustedAmount" type="number" step="0.01" className="input" placeholder={String(c.dealAmount)} />
                        </div>
                        <div>
                          <label className="label">Note</label>
                          <textarea name="reviewNote" className="input" rows={2} />
                        </div>
                        <div className="flex gap-2">
                          <button name="decision" value="APPROVED" className="btn-primary flex-1">Approve</button>
                          <button name="decision" value="DISPUTED" className="btn-danger flex-1">Dispute</button>
                        </div>
                      </form>
                    </details>
                  ) : (
                    <span className="text-xs text-muted">{c.reviewedAt?.toLocaleDateString()}</span>
                  )}
                </td>
              </tr>
            ))}
            {!conversions.length && (
              <tr><td colSpan={7} className="text-center text-muted py-8">No conversions submitted yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
