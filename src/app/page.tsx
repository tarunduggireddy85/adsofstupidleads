import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function Home() {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  if (u.role === "ADMIN") redirect("/admin");
  redirect("/client");
}
