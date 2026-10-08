import { Skeleton } from "@/components/ui";

export default function CampaignsLoading() {
  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <Skeleton className="mb-1.5 h-3 w-20" />
          <Skeleton className="h-7 w-44" />
        </div>
        <Skeleton className="h-9 w-32 rounded-xl" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="panel flex items-center justify-between p-4.5">
            <div className="flex items-center gap-4">
              <Skeleton className="h-14 w-14 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-4.5 w-48" />
                <Skeleton className="h-3.5 w-32" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="h-7 w-20 rounded-full" />
              <Skeleton className="h-9 w-9 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

