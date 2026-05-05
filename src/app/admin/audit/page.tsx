import { db } from "@/lib/db";
import { PageTitle } from "@/components/Shell";

export default async function AuditPage() {
  const logs = await db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  const userIds = Array.from(new Set(logs.map((l) => l.actorId)));
  const users = await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } });
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  return (
    <div>
      <PageTitle title="Audit log" subtitle="Every change, by whom, when" />
      <div className="card overflow-hidden">
        <table className="tbl">
          <thead>
            <tr><th>Time</th><th>Actor</th><th>Role</th><th>Action</th><th>Target</th><th>Details</th></tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="text-xs text-muted">{l.createdAt.toLocaleString()}</td>
                <td className="text-xs">{userMap[l.actorId]?.email ?? l.actorId}</td>
                <td className="text-xs">{l.actorRole}</td>
                <td className="text-xs font-mono">{l.action}</td>
                <td className="text-xs font-mono">{l.target}</td>
                <td className="text-xs text-muted">{l.meta ?? ""}</td>
              </tr>
            ))}
            {!logs.length && <tr><td colSpan={6} className="text-center text-muted py-8">No activity yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
