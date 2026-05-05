import { requireClient } from "@/lib/auth";
import { Shell } from "@/components/Shell";

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const user = await requireClient();
  return (
    <Shell
      user={{ name: user.name, role: "Client" }}
      nav={[
        { href: "/client", label: "Dashboard" },
        { href: "/client/leads", label: "My Leads" },
      ]}
    >
      {children}
    </Shell>
  );
}
