import { Skeleton } from "@/components/ui";

export default function PropertiesLoading() {
  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <Skeleton className="mb-1.5 h-3 w-20" />
          <Skeleton className="h-7 w-44" />
        </div>
        <Skeleton className="h-9 w-32 rounded-xl" />
      </div>
      <div className="grid gap-4.5 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="panel overflow-hidden p-4">
            <Skeleton className="aspect-[16/10] w-full rounded-xl" />
            <div className="mt-4 space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <div className="flex gap-2 pt-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

