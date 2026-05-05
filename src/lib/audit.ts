import { db } from "./db";
import type { Role } from "@prisma/client";

export async function audit(
  actorId: string,
  actorRole: Role,
  action: string,
  target: string,
  meta?: Record<string, unknown>
) {
  await db.auditLog.create({
    data: { actorId, actorRole, action, target, meta: meta ? JSON.stringify(meta) : null },
  });
}
