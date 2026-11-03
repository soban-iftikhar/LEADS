"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { Button, Icon, Modal, Segmented, useToast } from "@/components/ui";
import {
  ApiError,
  createListing,
  deleteListingImage,
  getListing,
  getLocalities,
  patchListing,
  reorderListingImages,
  submitListing,
  uploadListingDocument,
  uploadListingImage,
} from "@/lib/api";
import { formatPkr, formatRelative, groupPk } from "@/lib/format";
import type { DocumentKind, ListingCategory, ListingDetail, ListingPatch, Locality, QualityCheck, SizeUnit } from "@/types/api";
import { QualityStrip } from "./QualityStrip";

const REGIONS = [
  { id: "reg_isb", slug: "islamabad" as const, name: "Islamabad" },
  { id: "reg_rwp", slug: "rawalpindi" as const, name: "Rawalpindi" },
];

// shown before the draft exists (keys and labels match the API's checks)
const EMPTY_CHECKS: QualityCheck[] = [
  { key: "basics", label: "Type, size, location", passed: false, hint: null },
  { key: "price", label: "Price", passed: false, hint: null },
  { key: "description", label: "Description", passed: false, hint: null },
  { key: "photos", label: "5 photos", passed: false, hint: null },
  { key: "ownership_doc", label: "Ownership document", passed: false, hint: null },
  { key: "whatsapp", label: "WhatsApp number", passed: true, hint: null },
];

const UNITS: { value: SizeUnit; label: string }[] = [
  { value: "MARLA", label: "Marla" },
  { value: "KANAL", label: "Kanal" },
  { value: "SQFT", label: "Sq ft" },
];

const DOC_KINDS: { value: DocumentKind; label: string }[] = [
  { value: "REGISTRY", label: "Registry" },
  { value: "TRANSFER_LETTER", label: "Transfer letter" },
  { value: "ALLOTMENT_LETTER", label: "Allotment letter" },
];

type Form = {
  category: ListingCategory;
  sizeValue: string;
  sizeUnit: SizeUnit;
  bedrooms: string;
  bathrooms: string;
  price: string; // digits only
  regionId: string;
  localityId: string;
  localityName: string;
  description: string;
};

function fromListing(l: ListingDetail | null): Form {
  return {
    category: l?.category ?? "HOUSE",
    sizeValue: l?.sizeValue ?? "",
    sizeUnit: l?.sizeUnit ?? "MARLA",
    bedrooms: l?.bedrooms != null ? String(l.bedrooms) : "",
    bathrooms: l?.bathrooms != null ? String(l.bathrooms) : "",
    price: l && Number(l.pricePkr) > 0 ? l.pricePkr : "",
    regionId: REGIONS.find((r) => r.name === l?.locality.regionName)?.id ?? "reg_isb",
    localityId: l?.locality.id ?? "",
    localityName: l?.locality.name ?? "",
    description: l?.description ?? "",
  };
}

/** Downscale a picked photo to a small JPEG data URL for the mock store. TODO(api): send the file as multipart. */
async function previewOf(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, 480 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.8);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function AreaCombobox({ region, value, onPick, hint }: { region: "islamabad" | "rawalpindi"; value: string; onPick: (l: Locality | null, text: string) => void; hint: string | null }) {
  const id = useId();
  const [text, setText] = useState(value);
  const [items, setItems] = useState<Locality[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [prevValue, setPrevValue] = useState(value);
  if (prevValue !== value) {
    setPrevValue(value);
    setText(value);
  }
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      getLocalities(region, text)
        .then((r) => setItems(r.items))
        .catch(() => setItems([]));
    }, 200);
    return () => clearTimeout(t);
  }, [text, region, open]);
  const pick = (l: Locality) => {
    setText(l.name);
    setOpen(false);
    onPick(l, l.name);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(items.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter" && open && items[active]) {
      e.preventDefault();
      pick(items[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };
  return (
    <div className="combo">
      <label className="lbl" htmlFor={`${id}-in`}>
        Area and block
      </label>
      <div className="inp">
        <input
          id={`${id}-in`}
          role="combobox"
          aria-expanded={open && items.length > 0}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${id}-o${active}` : undefined}
          aria-describedby={hint ? `${id}-h` : undefined}
          autoComplete="off"
          placeholder="e.g. G-13/2"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKey}
        />
      </div>
      {open && items.length > 0 && (
        <ul className="combo-list" id={`${id}-list`} role="listbox">
          {items.map((l, i) => (
            <li
              key={l.id}
              id={`${id}-o${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? "on" : ""}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(l);
              }}
            >
              {l.name}
              {l.parentName && <span className="muted"> · {l.parentName}</span>}
            </li>
          ))}
        </ul>
      )}
      {hint && (
        <div className="hint" id={`${id}-h`}>
          {hint}
        </div>
      )}
    </div>
  );
}

export function ListingForm({ listing, now }: { listing: ListingDetail | null; now: string }) {
  const router = useRouter();
  const toast = useToast();
  const fid = useId();
  const [id, setId] = useState<string | null>(listing?.id ?? null);
  const [status, setStatus] = useState(listing?.status ?? "DRAFT");
  const [f, setF] = useState<Form>(() => fromListing(listing));
  const [checks, setChecks] = useState<QualityCheck[]>(listing?.quality.checks ?? EMPTY_CHECKS);
  const [benchmark, setBenchmark] = useState(listing?.benchmark ?? null);
  const [images, setImages] = useState(listing?.images ?? []);
  const [doc, setDoc] = useState(listing?.documents[0] ?? null);
  const [savedAt, setSavedAt] = useState<string | null>(listing ? now : null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmLive, setConfirmLive] = useState(false);
  const [tick, setTick] = useState(() => new Date(now).getTime());
  const [uploading, setUploading] = useState(0);
  const [dragFrom, setDragFrom] = useState<number | null>(null);

  const pending = useRef<ListingPatch>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const creating = useRef<Promise<string> | null>(null);
  const idRef = useRef(id);
  useEffect(() => {
    idRef.current = id;
  }, [id]);

  // keep "Draft saved 2 min ago" fresh
  useEffect(() => {
    const t = setInterval(() => setTick(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const ensureId = useCallback(async (): Promise<string> => {
    if (idRef.current) return idRef.current;
    if (!creating.current) {
      creating.current = createListing(f.category).then(({ id: newId }) => {
        idRef.current = newId;
        setId(newId);
        // same form stays mounted; only the address changes to the edit URL
        window.history.replaceState(null, "", `/listings/${newId}/edit`);
        return newId;
      });
    }
    return creating.current;
  }, [f.category]);

  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const patch = pending.current;
    pending.current = {};
    const lid = await ensureId();
    if (!Object.keys(patch).length) return;
    setSaving(true);
    try {
      const fresh = await patchListing(lid, patch);
      setChecks(fresh.quality.checks);
      setBenchmark(fresh.benchmark);
      setStatus(fresh.status);
      setSavedAt(new Date().toISOString());
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't save. We'll try again on your next change.");
      pending.current = { ...patch, ...pending.current };
    } finally {
      setSaving(false);
    }
  }, [ensureId, toast]);

  const queue = (patch: ListingPatch) => {
    pending.current = { ...pending.current, ...patch };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      flush().catch(() => toast("Couldn't create the draft. Try again."));
    }, 800);
  };

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const set = <K extends keyof Form>(k: K, v: Form[K], patch: ListingPatch) => {
    setF((x) => ({ ...x, [k]: v }));
    queue(patch);
  };

  const isPlot = f.category === "PLOT";
  const passedAll = checks.every((c) => c.passed);
  const region = REGIONS.find((r) => r.id === f.regionId) ?? REGIONS[0];
  const unitLabel = UNITS.find((u) => u.value === f.sizeUnit)?.label ?? "Marla";
  const benchHint =
    benchmark && f.localityName && f.sizeValue
      ? `Similar ${f.sizeValue} ${unitLabel} ${isPlot ? "plots" : f.category === "FLAT" ? "flats" : "houses"} in ${f.localityName} list for PKR ${formatPkr(benchmark.minPkr).replace(/ (Cr|Lac)$/, "")}–${formatPkr(benchmark.maxPkr)}.`
      : null;

  const addPhotos = async (files: File[]) => {
    if (!files.length) return;
    const lid = await ensureId();
    for (const file of files) {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
        toast(`${file.name}: use a JPG, PNG or WebP photo.`);
        continue;
      }
      if (file.size > 8 * 1024 * 1024) {
        toast(`${file.name} is over 8 MB.`);
        continue;
      }
      setUploading((u) => u + 1);
      try {
        const { image } = await uploadListingImage(lid, await previewOf(file));
        setImages((im) => [...im, image]);
      } catch (e) {
        toast(e instanceof ApiError ? e.message : `Couldn't upload ${file.name}.`);
      } finally {
        setUploading((u) => u - 1);
      }
    }
    await refreshChecks(lid);
  };

  const refreshChecks = async (lid: string) => {
    try {
      const fresh = await getListing(lid);
      setChecks(fresh.quality.checks);
      setStatus(fresh.status);
    } catch {
      // the strip refreshes again on the next save
    }
  };

  const removePhoto = async (imageId: string) => {
    if (!id) return;
    const prev = images;
    setImages((im) => im.filter((i) => i.id !== imageId));
    try {
      await deleteListingImage(id, imageId);
      await refreshChecks(id);
    } catch {
      setImages(prev);
      toast("Couldn't remove the photo.");
    }
  };

  const move = async (from: number, to: number) => {
    if (!id || from === to || to < 0 || to >= images.length) return;
    const next = [...images];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    const prev = images;
    setImages(next);
    try {
      await reorderListingImages(id, next.map((i) => i.id));
    } catch {
      setImages(prev);
      toast("Couldn't change the order.");
    }
  };

  const onDrop = (e: DragEvent, to: number) => {
    e.preventDefault();
    if (dragFrom !== null) move(dragFrom, to);
    setDragFrom(null);
  };

  // TODO(api): the kind should come from the person or the reviewer; registry is the common case
  const addDoc = async (file: File | undefined, kind: DocumentKind = doc?.kind ?? "REGISTRY") => {
    if (!file) return;
    if (!/^(application\/pdf|image\/(jpeg|png))$/.test(file.type)) return toast("Use a PDF, JPG or PNG.");
    if (file.size > 10 * 1024 * 1024) return toast("That file is over 10 MB.");
    const lid = await ensureId();
    try {
      const { document } = await uploadListingDocument(lid, kind, file.name);
      setDoc(document);
      await refreshChecks(lid);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't upload the document.");
    }
  };

  const saveDraft = async () => {
    try {
      await flush();
      toast(status === "DRAFT" ? "Draft saved" : "Saved");
    } catch {
      toast("Couldn't save. Try again.");
    }
  };

  const doSubmit = async () => {
    setSubmitting(true);
    try {
      await flush();
      const lid = await ensureId();
      await submitListing(lid);
      router.push(`/listings/${lid}`);
      router.refresh();
    } catch (e) {
      setSubmitting(false);
      setConfirmLive(false);
      if (e instanceof ApiError && e.status === 422 && e.errors?.checks) {
        try {
          setChecks(JSON.parse(e.errors.checks) as QualityCheck[]);
        } catch {
          // keep the current strip
        }
        toast("Some checks still fail.");
        return;
      }
      toast(e instanceof ApiError ? e.message : "Couldn't submit. Try again.");
    }
  };

  const submit = () => {
    if (!passedAll || submitting) return;
    if (status === "APPROVED") setConfirmLive(true);
    else doSubmit();
  };

  const sub = saving
    ? "Saving…"
    : savedAt
      ? `${status === "DRAFT" ? "Draft saved" : "Saved"} ${(() => {
          const r = formatRelative(savedAt, new Date(tick));
          return r === "now" ? "just now" : /min|h$/.test(r) ? `${r} ago` : r;
        })()}`
      : "Not saved yet";
  const stripId = `${fid}-q`;
  const missing = Math.max(0, 5 - images.length);

  return (
    <>
      <Link href={id ? `/listings/${id}` : "/listings"} className="lnk" style={{ color: "var(--ink-2)" }}>
        ← Listings
      </Link>
      <div className="ph">
        <div>
          <h1>{listing ? "Edit listing" : "Add listing"}</h1>
          <p aria-live="polite">{sub}</p>
        </div>
        <div className="row">
          <Button onClick={saveDraft}>Save draft</Button>
          <Button variant="primary" disabled={!passedAll} loading={submitting} loadingLabel="Submitting…" aria-describedby={stripId} onClick={submit}>
            Submit for review
          </Button>
        </div>
      </div>
      <QualityStrip checks={checks} id={stripId} photoCount={images.length} />

      <section className="sec" id="property">
        <div className="sec-h">
          <h2>Property</h2>
        </div>
        <div className="sec-b stack16">
          <div>
            <span className="lbl" id={`${fid}-type`}>
              Type
            </span>
            <Segmented
              label="Type"
              value={f.category}
              onChange={(v) => {
                const c = v as ListingCategory;
                setF((x) => ({ ...x, category: c }));
                queue({ category: c, ...(c === "PLOT" ? { bedrooms: null, bathrooms: null } : {}) });
              }}
              items={[
                { value: "HOUSE", label: "House" },
                { value: "PLOT", label: "Plot" },
                { value: "FLAT", label: "Flat" },
                { value: "COMMERCIAL", label: "Commercial" },
              ]}
            />
          </div>
          <div className="fgrid g4">
            <div>
              <label className="lbl" htmlFor={`${fid}-size`}>
                Size
              </label>
              <div className="inp">
                <input id={`${fid}-size`} inputMode="decimal" value={f.sizeValue} onChange={(e) => set("sizeValue", e.target.value.replace(/[^\d.]/g, ""), { sizeValue: e.target.value.replace(/[^\d.]/g, "") })} />
                <span className="suf unit">
                  <label className="sr-only" htmlFor={`${fid}-unit`}>
                    Unit
                  </label>
                  <select id={`${fid}-unit`} value={f.sizeUnit} onChange={(e) => set("sizeUnit", e.target.value as SizeUnit, { sizeUnit: e.target.value as SizeUnit })}>
                    {UNITS.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </span>
              </div>
            </div>
            {!isPlot && (
              <>
                <div>
                  <label className="lbl" htmlFor={`${fid}-bed`}>
                    Bedrooms
                  </label>
                  <div className="inp">
                    <input id={`${fid}-bed`} inputMode="numeric" value={f.bedrooms} onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 2); set("bedrooms", v, { bedrooms: v ? Number(v) : null }); }} />
                  </div>
                </div>
                <div>
                  <label className="lbl" htmlFor={`${fid}-bath`}>
                    Bathrooms
                  </label>
                  <div className="inp">
                    <input id={`${fid}-bath`} inputMode="numeric" value={f.bathrooms} onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 2); set("bathrooms", v, { bathrooms: v ? Number(v) : null }); }} />
                  </div>
                </div>
              </>
            )}
            <div>
              <label className="lbl" htmlFor={`${fid}-price`}>
                Price
              </label>
              <div className="inp">
                <span className="pre">PKR</span>
                <input
                  id={`${fid}-price`}
                  inputMode="numeric"
                  className="mono"
                  value={f.price ? groupPk(f.price) : ""}
                  onChange={(e) => {
                    const d = e.target.value.replace(/\D/g, "").slice(0, 12);
                    set("price", d, { pricePkr: d });
                  }}
                />
              </div>
            </div>
          </div>
          <div className="fgrid">
            <div>
              <label className="lbl" htmlFor={`${fid}-city`}>
                City
              </label>
              <div className="inp selwrap">
                <select
                  id={`${fid}-city`}
                  value={f.regionId}
                  onChange={(e) => {
                    setF((x) => ({ ...x, regionId: e.target.value, localityId: "", localityName: "" }));
                    queue({ regionId: e.target.value, localityId: "" });
                  }}
                >
                  {REGIONS.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <span className="suf" aria-hidden="true">
                  <Icon name="chevd" size={16} />
                </span>
              </div>
            </div>
            <AreaCombobox
              region={region.slug}
              value={f.localityName}
              hint={benchHint}
              onPick={(l, text) => {
                setF((x) => ({ ...x, localityId: l?.id ?? "", localityName: text }));
                if (l) queue({ localityId: l.id });
              }}
            />
          </div>
          <div>
            <label className="lbl" htmlFor={`${fid}-desc`}>
              Description
            </label>
            <textarea id={`${fid}-desc`} className="ta" placeholder="e.g. Corner house, 4 bed with attached baths, near the main boulevard." value={f.description} onChange={(e) => set("description", e.target.value, { description: e.target.value })} />
          </div>
        </div>
      </section>

      <div className="twocol" style={{ gridTemplateColumns: "minmax(0,1.6fr) minmax(0,1fr)" }}>
        <div>
          <section className="sec" id="photos">
            <div className="sec-h">
              <h2>Photos</h2>
              <span className="muted" style={{ fontSize: 13 }}>{`${images.length} of 5 minimum`}</span>
            </div>
            <div className="sec-b">
              <ul className="photos" aria-label="Photos. Drag to reorder, or focus a photo and use the arrow keys.">
                {images.map((im, i) => (
                  <li
                    key={im.id}
                    className={`ph-photo thumb ${dragFrom === i ? "dragging" : ""}`}
                    draggable
                    tabIndex={0}
                    aria-label={`Photo ${i + 1} of ${images.length}`}
                    onDragStart={() => setDragFrom(i)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => onDrop(e, i)}
                    onDragEnd={() => setDragFrom(null)}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowLeft") move(i, i - 1);
                      if (e.key === "ArrowRight") move(i, i + 1);
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- previews are data URLs from the upload */}
                    {im.url ? <img src={im.url} alt="" /> : <Icon name="img" size={26} strokeWidth={1.6} />}
                    <span className="grip" aria-hidden="true">
                      <Icon name="dots" size={14} />
                    </span>
                    <button type="button" className="rm" aria-label={`Remove photo ${i + 1}`} onClick={() => removePhoto(im.id)}>
                      <Icon name="x" size={14} strokeWidth={2.6} />
                    </button>
                  </li>
                ))}
                {Array.from({ length: uploading }, (_, i) => (
                  <li key={`u${i}`} className="ph-photo">
                    <span className="spin" aria-label="Uploading" />
                  </li>
                ))}
                <li>
                  <label className="ph-photo add">
                    <Icon name="upload" size={22} />
                    Add photos
                    <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => { addPhotos(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
                  </label>
                </li>
              </ul>
              {missing > 0 && (
                <div className="etx">
                  <Icon name="alert" size={15} />
                  {`Add ${missing} more. Include the front, rooms and kitchen.`}
                </div>
              )}
            </div>
          </section>
        </div>
        <div>
          <section className="sec" id="document">
            <div className="sec-h">
              <h2>Ownership document</h2>
              {doc && (
                <span className="muted" style={{ fontSize: 13 }}>
                  Only our team sees it
                </span>
              )}
            </div>
            <div className="sec-b grow">
              {doc ? (
                <div className="docbox">
                  <div className="row">
                    <Icon name="doc" size={22} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <b className="ellip">{doc.fileName}</b>
                      <div className="muted" style={{ fontSize: 12.5 }}>
                        {DOC_KINDS.find((k) => k.value === doc.kind)?.label ?? "Document"} · uploaded
                      </div>
                    </div>
                  </div>
                  <label className="btn sm">
                    Replace
                    <input type="file" accept="application/pdf,image/jpeg,image/png" className="sr-only" onChange={(e) => { addDoc(e.target.files?.[0]); e.target.value = ""; }} />
                  </label>
                </div>
              ) : (
                <label className="ph-photo add" style={{ aspectRatio: "auto", flex: "1 1 0%", padding: 20, textAlign: "center" }}>
                  <Icon name="doc" size={24} />
                  Registry, transfer or allotment letter
                  <span className="muted" style={{ fontWeight: 500 }}>
                    PDF or photo · 10 MB · only our team sees it
                  </span>
                  <input type="file" accept="application/pdf,image/jpeg,image/png" className="sr-only" onChange={(e) => { addDoc(e.target.files?.[0]); e.target.value = ""; }} />
                </label>
              )}
            </div>
          </section>
        </div>
      </div>

      {confirmLive && (
        <Modal
          title="Send it back to review?"
          onClose={() => setConfirmLive(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirmLive(false)}>
                Cancel
              </Button>
              <Button variant="ink" loading={submitting} loadingLabel="Submitting…" onClick={doSubmit}>
                Submit for review
              </Button>
            </>
          }
        >
          <p style={{ margin: 0 }}>Editing a live listing sends it back to review. Leads pause until it&apos;s approved.</p>
        </Modal>
      )}
    </>
  );
}
