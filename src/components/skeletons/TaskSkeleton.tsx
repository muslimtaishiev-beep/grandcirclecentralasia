import React from 'react';
import { Skeleton } from '../ui/Skeleton';

export default function TaskSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center pb-4 border-b border-[var(--border-color)]">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>

      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <Skeleton className="w-5 h-5 rounded-md shrink-0" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/5" />
              </div>
            </div>
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
