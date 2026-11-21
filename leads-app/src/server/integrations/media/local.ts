import "server-only";
import crypto from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/server/env";
import type { MediaStore } from "./index";

/**
 * Development-only store, used when Cloudinary isn't configured. Photos go to LOCAL_UPLOADS_DIR
 * (default `public/uploads`, served by Next as static files); documents go to
 * LOCAL_DOCUMENTS_DIR (default `.data/documents`, outside `public/`, never served). Both are
 * gitignored. `mediaStore()` only loads this module outside production, so production builds
 * don't contain it.
 */
const dirFor = (kind: "image" | "document") => (kind === "image" ? env().LOCAL_UPLOADS_DIR : env().LOCAL_DOCUMENTS_DIR);

const safe = (s: string) => s.replace(/[^a-z0-9._-]/gi, "-").replace(/^\.+/, "").slice(0, 80) || "file";

async function save(dir: string, folder: string, name: string, data: Buffer): Promise<string> {
  const rel = path.join(...folder.split("/").map(safe), `${crypto.randomUUID()}-${safe(name)}`);
  await mkdir(path.join(dir, path.dirname(rel)), { recursive: true });
  await writeFile(path.join(dir, rel), data);
  return rel;
}

export const localStore: MediaStore = {
  async putImage(data, folder) {
    const rel = await save(dirFor("image"), folder, "photo.jpg", data); // photos are re-encoded to JPEG
    return { id: rel, url: `/uploads/${rel.split(path.sep).join("/")}` };
  },
  async putDocument(data, folder, fileName) {
    return { id: await save(dirFor("document"), folder, fileName, data) };
  },
  async remove(id, kind) {
    const dir = dirFor(kind);
    const target = path.join(dir, id);
    const rel = path.relative(dir, target);
    // ids are our own relative paths; never touch anything outside the folder
    if (rel && !rel.startsWith("..") && !path.isAbsolute(rel)) await rm(target, { force: true });
  },
};
