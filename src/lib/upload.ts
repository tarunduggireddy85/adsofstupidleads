import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function saveUpload(file: File, subdir = "proofs"): Promise<string> {
  const buf = Buffer.from(await file.arrayBuffer());
  const dir = path.join(process.cwd(), "public", "uploads", subdir);
  await mkdir(dir, { recursive: true });
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safe}`;
  await writeFile(path.join(dir, filename), buf);
  return `/uploads/${subdir}/${filename}`;
}
