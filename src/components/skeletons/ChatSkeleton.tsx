import React from 'react';
import { Skeleton, SkeletonAvatar } from '../ui/Skeleton';

export default function ChatSkeleton() {
  return (
    <div className="flex h-full bg-[var(--bg-surface)] rounded-xl overflow-hidden border border-[var(--border-color)]">
      {/* Left Channels Column */}
      <div className="w-80 border-r border-[var(--border-color)] p-4 space-y-4">
        <Skeleton className="h-9 w-full rounded-full" />
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-2">
              <SkeletonAvatar />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Stream */}
      <div className="flex-1 flex flex-col p-6 space-y-4 justify-between bg-[var(--bg-app)]">
        <div className="flex items-center justify-between pb-4 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-3">
            <SkeletonAvatar />
            <Skeleton className="h-5 w-32" />
          </div>
          <Skeleton className="h-8 w-24 rounded-full" />
        </div>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col justify-end">
          <div className="flex gap-3 max-w-[60%]">
            <SkeletonAvatar size="sm" />
            <Skeleton className="h-14 w-full rounded-2xl" />
          </div>
          <div className="flex gap-3 max-w-[60%] self-end">
            <Skeleton className="h-12 w-full rounded-2xl" />
          </div>
        </div>

        <Skeleton className="h-12 w-full rounded-2xl" />
      </div>
    </div>
  );
}
