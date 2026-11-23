import { Button } from "@/components/ui/Button";

export default function AdminNotFound() {
  return (
    <div className="err-state">
      <b>We couldn&apos;t find that page</b>
      <span>It may have been archived or the link is old.</span>
      <Button size="sm" href="/admin">
        Back to overview
      </Button>
    </div>
  );
}
