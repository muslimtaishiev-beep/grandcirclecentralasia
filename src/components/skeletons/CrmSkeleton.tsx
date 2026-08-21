import React from 'react';
import { Skeleton } from '../ui/Skeleton';

export default function CrmSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center pb-4 border-b border-[var(--border-color)]">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-36 rounded-xl" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, colIdx) => (
          <div key={colIdx} className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-4 space-y-3">
            <Skeleton className="h-5 w-1/2 mb-4" />
            {Array.from({ length: 3 }).map((_, cardIdx) => (
              <div key={cardIdx} className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)] space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-6 w-1/3 rounded-full mt-2" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
