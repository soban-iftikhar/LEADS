import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UiShowcase } from "./UiShowcase";

export const metadata: Metadata = { title: "UI primitives", robots: { index: false } };

/** Every primitive, side by side in light and dark. Dev only. */
export default function DevUiPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <UiShowcase />;
}
