import React, { useEffect, useState } from 'react';
import { WifiOff, Database, Code2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export const SystemStatusPanel: React.FC<{ className?: string }> = ({ className }) => {
  // ponytail: navigator.onLine can lie on some networks, but a reactive read
  // beats the hardcoded-green status this replaced.
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const items = isOnline
    ? [
        { label: 'חיבור לרשת פעיל', icon: Database, color: 'text-[var(--brand)]' },
        { label: 'גרסה פעילה', icon: Code2, color: 'text-[var(--brand)]' },
      ]
    : [{ label: 'אין חיבור לרשת — נתונים שמורים מהמכשיר', icon: WifiOff, color: 'text-[var(--color-warning)]' }];

  return (
    <div className={cn('rounded-2xl border border-[rgba(2,1,8,0.08)] bg-[var(--tactical-glass)] p-3 command-soft-panel', className)}>
      <div className="space-y-2">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <div key={item.label} className="flex items-center gap-2 text-caption font-bold text-[var(--text-muted-accessible)]">
              <Icon className={cn('h-3.5 w-3.5', item.color)} />
              <span>{item.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
