import { db } from "@/lib/db";
import { PageTitle, Stat, StatusBadge } from "@/components/Shell";
import { fmtMoney } from "@/lib/commission";
import Link from "next/link";

export default async function AdminDashboard() {
  const [leadsTotal, byStatus, conv, pending, clients, recent] = await Promise.all([
    db.lead.count(),
    db.lead.groupBy({ by: ["status"], _count: { _all: true } }),
    db.conversion.aggregate({
      _sum: { dealAmount: true, commission: true },
      where: { status: "APPROVED" },
    }),
    db.conversion.count({ where: { status: "PENDING" } }),
    db.client.count({ where: { active: true } }),
    db.lead.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { client: true },
    }),
  ]);

  const converted = byStatus.find((s) => s.status === "CONVERTED")?._count._all ?? 0;
  const rate = leadsTotal ? ((converted / leadsTotal) * 100).toFixed(1) : "0.0";

  return (
    <div>
      <PageTitle title="Dashboard" subtitle="Overview across all clients" />
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Stat label="Total Leads" value={leadsTotal} />
        <Stat label="Converted" value={converted} hint={`${rate}% conversion rate`} />
        <Stat label="Pending Approvals" value={pending} hint="Conversions awaiting review" />
        <Stat label="Active Clients" value={clients} />
        <Stat
          label="Approved Revenue"
          value={fmtMoney(conv._sum.dealAmount ?? 0)}
          hint={`Commission paid: ${fmtMoney(conv._sum.commission ?? 0)}`}
        />
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="font-medium">Recent Leads</h2>
          <Link href="/admin/leads" className="btn-ghost">View all</Link>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Ref</th>
              <th>Customer</th>
              <th>Client</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((l) => (
              <tr key={l.id}>
                <td className="font-mono text-xs">{l.ref}</td>
                <td>{l.customerName}<div className="text-xs text-muted">{l.customerPhone}</div></td>
                <td>{l.client.name}</td>
                <td><StatusBadge status={l.status} /></td>
                <td className="text-muted">{l.createdAt.toLocaleString()}</td>
              </tr>
            ))}
            {!recent.length && (
              <tr><td colSpan={5} className="text-center text-muted py-8">No leads yet. Add one from the Leads page.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
