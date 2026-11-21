import { badInput } from "@/server/http/errors";
import { ok } from "@/server/http/response";
import { route } from "@/server/http/route";
import { ownerOf } from "@/server/modules/account/service";
import { documentKind } from "@/server/modules/listings/schema";
import { setDocument } from "@/server/modules/listings/service";
import { DOCUMENT_MAX_BYTES, fileFrom } from "@/server/modules/listings/uploads";

// POST /api/listings/:id/documents multipart { file, kind } -> 201 { document }. Replaces the previous one.
export const POST = route({
  auth: "listing:update:own",
  limits: [{ key: "listing-document", limit: 30, windowSeconds: 3600 }],
  handler: async ({ request, auth, params }) => {
    const { file, form } = await fileFrom(request, DOCUMENT_MAX_BYTES);
    const kind = documentKind.safeParse(form.get("kind"));
    if (!kind.success) throw badInput({ kind: "Pick the document type." });
    return ok(await setDocument(ownerOf(auth.user), String(params.id), kind.data, file), 201);
  },
});
