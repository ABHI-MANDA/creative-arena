import { Skeleton } from "@/components/ui";

export default function PropertyDetailLoading() {
  return (
    <div className="mx-auto max-w-[1280px] space-y-7">
      {/* Property Hero skeleton */}
      <div className="panel relative overflow-hidden p-6 md:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-9 w-72" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-10 w-36 rounded-xl" />
            <Skeleton className="h-10 w-36 rounded-xl" />
          </div>
        </div>
      </div>

      {/* Details & Photos Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="panel space-y-4 p-6 lg:col-span-2">
          <Skeleton className="h-6 w-36" />
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[4/3] rounded-xl" />
            ))}
          </div>
        </div>

        <div className="panel space-y-4 p-6">
          <Skeleton className="h-6 w-32" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>

      {/* Campaigns Section */}
      <div className="space-y-4">
        <Skeleton className="h-7 w-44" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

