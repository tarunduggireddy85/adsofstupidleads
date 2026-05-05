import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ads of Stupid Leads",
  description: "Lead tracking & commission platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
