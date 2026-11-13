import { firstName, waDigits } from "./format";

/** tel: link from E.164 without spaces. */
export function telHref(e164: string): string {
  return `tel:+${waDigits(e164)}`;
}

/** wa.me link with the standard opening line. */
export function waHref(e164: string, buyerName: string, displayName: string, listingTitle: string, locality: string): string {
  const draft = `Assalam o alaikum ${firstName(buyerName)}, this is ${displayName} from LEADS about the ${listingTitle} in ${locality}.`;
  return `https://wa.me/${waDigits(e164)}?text=${encodeURIComponent(draft)}`;
}
