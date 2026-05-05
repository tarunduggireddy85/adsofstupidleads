import { db } from "@/lib/db";
import { requireClient } from "@/lib/auth";
import { PageTitle, Stat, StatusBadge } from "@/components/Shell";
import { fmtMoney } from "@/lib/commission";
import Link from "next/link";

export default async function ClientDashboard() {
  const user = await requireClient();
  const clientId = user.clientId!;
  const client = await db.client.findUnique({ where: { id: clientId } });
  const [total, byStatus, conv, recent] = await Promise.all([
    db.lead.count({ where: { clientId } }),
    db.lead.groupBy({ by: ["status"], _count: { _all: true }, where: { clientId } }),
    db.conversion.aggregate({
      _sum: { commission: true, dealAmount: true },
      where: { lead: { clientId }, status: "APPROVED" },
    }),
    db.lead.findMany({ where: { clientId }, orderBy: { createdAt: "desc" }, take: 8 }),
  ]);
  const converted = byStatus.find((s) => s.status === "CONVERTED")?._count._all ?? 0;
  const open = total - converted - (byStatus.find((s) => s.status === "LOST")?._count._all ?? 0) - (byStatus.find((s) => s.status === "REJECTED")?._count._all ?? 0);

  return (
    <div>
      <PageTitle title={`Welcome, ${user.name}`} subtitle="Your assigned leads and earnings" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Total Leads" value={total} />
        <Stat label="Open" value={open} hint="In your pipeline" />
        <Stat label="Converted" value={converted} />
        <Stat label="Approved Commission" value={fmtMoney(conv._sum.commission ?? 0, client?.currency)} hint={`Deals: ${fmtMoney(conv._sum.dealAmount ?? 0, client?.currency)}`} />
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="font-medium">Recent leads</h2>
          <Link href="/client/leads" className="btn-ghost">All leads</Link>
        </div>
        <table className="tbl">
          <thead><tr><th>Ref</th><th>Customer</th><th>Status</th><th>Created</th><th></th></tr></thead>
          <tbody>
            {recent.map((l) => (
              <tr key={l.id}>
                <td className="font-mono text-xs">{l.ref}</td>
                <td>{l.customerName}<div className="text-xs text-muted">{l.customerPhone}</div></td>
                <td><StatusBadge status={l.status} /></td>
                <td className="text-xs text-muted">{l.createdAt.toLocaleString()}</td>
                <td><Link href={`/client/leads/${l.id}`} className="btn-ghost">Open</Link></td>
              </tr>
            ))}
            {!recent.length && <tr><td colSpan={5} className="text-center text-muted py-8">No leads yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
