import { Button, Empty } from "@/components/ui";
import { PageHeader } from "@/components/app/PageHeader";

export default function AppNotFound() {
  return (
    <>
      <PageHeader title="Not found" sub="This page doesn't exist, or it isn't yours." />
      <Empty action={<Button href="/dashboard" size="sm">Back to overview</Button>}>We couldn&apos;t find that.</Empty>
    </>
  );
}
