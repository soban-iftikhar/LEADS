import { Button } from "@/components/ui/Button";
import { Note } from "@/components/ui/Note";

/** Shown until the WhatsApp number is verified (DR-42). */
export function PhoneNudge({ next = "/dashboard" }: { next?: string }) {
  return (
    <Note tone="y" icon="phone">
      <div className="between" style={{ flexWrap: "wrap" }}>
        <span>
          <b>Add your WhatsApp number.</b> Leads are sent there, and a verified number unlocks your free trial and listing review.
        </span>
        <Button href={`/verify-phone?next=${encodeURIComponent(next)}`} variant="ink" size="sm">
          Add number
        </Button>
      </div>
    </Note>
  );
}
