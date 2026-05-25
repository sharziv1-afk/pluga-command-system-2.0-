import React from 'react';
import { cn } from '@/lib/utils';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  lines?: number;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className, lines, ...props }) => {
  if (lines) {
    return (
      <div className={cn('space-y-2', className)} {...props}>
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            className={cn('command-skeleton h-3 rounded-full', index === lines - 1 && 'w-2/3')}
          />
        ))}
      </div>
    );
  }

  return <div className={cn('command-skeleton rounded-2xl', className)} {...props} />;
};

export const SkeletonCard: React.FC = () => {
  return (
    <div className="tactical-glass-card p-5">
      <Skeleton className="h-10 w-10" />
      <Skeleton lines={3} className="mt-4" />
    </div>
  );
};
