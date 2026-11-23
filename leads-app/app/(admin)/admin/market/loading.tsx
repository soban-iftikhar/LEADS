import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <>
      <Skeleton w={280} h={34} />
      <Skeleton h={120} />
      <Skeleton h={320} />
    </>
  );
}
