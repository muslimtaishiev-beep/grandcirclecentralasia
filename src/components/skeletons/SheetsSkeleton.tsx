import React from 'react';
import { Skeleton } from '../ui/Skeleton';

export default function SheetsSkeleton() {
  return (
    <div className="flex flex-col h-full bg-[var(--bg-app)] space-y-2">
      <div className="h-14 px-4 border-b border-[var(--border-color)] flex justify-between items-center bg-[var(--bg-surface)]">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-8 w-32 rounded-lg" />
      </div>

      <div className="h-10 px-4 border-b border-[var(--border-color)] flex gap-2 items-center bg-[var(--bg-surface)]">
        <Skeleton className="h-6 w-12" />
        <Skeleton className="h-6 w-full" />
      </div>

      <div className="flex-1 p-4 grid grid-cols-6 gap-1 overflow-hidden">
        {Array.from({ length: 48 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full rounded" />
        ))}
      </div>
    </div>
  );
}
