import React from 'react';
import { Skeleton, SkeletonCard, SkeletonText } from '../ui/Skeleton';

export default function DashboardSkeleton() {
  return (
    <div className="space-y-6 p-6">
      {/* Top Banner Skeleton */}
      <div className="h-32 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] p-6 flex justify-between items-center">
        <div className="space-y-2 w-1/2">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
        </div>
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>

      {/* KPI Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-5 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] space-y-3">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-8 w-2/3" />
          </div>
        ))}
      </div>

      {/* Main Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <div className="space-y-4">
          <SkeletonCard />
        </div>
      </div>
    </div>
  );
}
