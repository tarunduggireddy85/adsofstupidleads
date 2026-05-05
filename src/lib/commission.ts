import type { CommissionType } from "@prisma/client";

export function computeCommission(
  type: CommissionType,
  value: number,
  dealAmount: number
): number {
  if (!dealAmount || dealAmount <= 0) return 0;
  if (type === "PERCENT") return +(dealAmount * (value / 100)).toFixed(2);
  if (type === "FIXED") return +value.toFixed(2);
  return 0;
}

export function shortRef(): string {
  // Like LD-7K3F2 — short, unique-ish, easy to say on a call
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 5; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `LD-${s}`;
}

export function fmtMoney(n: number, currency = "INR") {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
  } catch {
    return `${currency} ${n.toFixed(0)}`;
  }
}
