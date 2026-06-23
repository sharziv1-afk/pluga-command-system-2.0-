import React from 'react';
import { CheckCircle2, Code2, Database } from 'lucide-react';
import { cn } from '@/lib/utils';

export const SystemStatusPanel: React.FC<{ className?: string }> = ({ className }) => {
  const items = [
    { label: 'מצב מערכת: תקין', icon: CheckCircle2 },
    { label: 'חיבור לנתונים פעיל', icon: Database },
    { label: 'גרסה פעילה', icon: Code2 },
  ];

  return (
    <div className={cn('rounded-2xl border border-[rgba(2,1,8,0.08)] bg-white/58 p-3 command-soft-panel', className)}>
      <div className="space-y-2">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <div key={item.label} className="flex items-center gap-2 text-[11px] font-bold text-[#667085]">
              <Icon className="h-3.5 w-3.5 text-[#FF6B02]" />
              <span>{item.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
