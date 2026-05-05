import { requireAdmin } from "@/lib/auth";
import { Shell } from "@/components/Shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  return (
    <Shell
      user={{ name: user.name, role: "Admin" }}
      nav={[
        { href: "/admin", label: "Dashboard" },
        { href: "/admin/leads", label: "Leads" },
        { href: "/admin/clients", label: "Clients" },
        { href: "/admin/conversions", label: "Conversions" },
        { href: "/admin/audit", label: "Audit Log" },
      ]}
    >
      {children}
    </Shell>
  );
}
