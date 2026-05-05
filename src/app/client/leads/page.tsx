import { db } from "@/lib/db";
import { requireClient } from "@/lib/auth";
import { PageTitle, StatusBadge } from "@/components/Shell";
import Link from "next/link";

export default async function ClientLeads({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requireClient();
  const sp = await searchParams;
  const where: { clientId: string; status?: any } = { clientId: user.clientId! };
  if (sp.status) where.status = sp.status;
  const leads = await db.lead.findMany({ where, orderBy: { createdAt: "desc" }, include: { conversion: true } });

  return (
    <div>
      <PageTitle title="My Leads" />
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2 flex-wrap">
          <Link href="/client/leads" className="btn-ghost">All</Link>
          {["ASSIGNED","CONTACTED","QUOTED","NEGOTIATING","CONVERTED","LOST"].map(s => (
            <Link key={s} href={`/client/leads?status=${s}`} className="btn-ghost">{s}</Link>
          ))}
        </div>
        <table className="tbl">
          <thead><tr><th>Ref</th><th>Customer</th><th>Status</th><th>Conversion</th><th>Created</th><th></th></tr></thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id}>
                <td className="font-mono text-xs">{l.ref}</td>
                <td>{l.customerName}<div className="text-xs text-muted">{l.customerPhone}</div></td>
                <td><StatusBadge status={l.status} /></td>
                <td className="text-xs">{l.conversion ? <StatusBadge status={l.conversion.status} /> : "—"}</td>
                <td className="text-xs text-muted">{l.createdAt.toLocaleString()}</td>
                <td><Link href={`/client/leads/${l.id}`} className="btn-ghost">Open</Link></td>
              </tr>
            ))}
            {!leads.length && <tr><td colSpan={6} className="text-center text-muted py-8">No leads.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
