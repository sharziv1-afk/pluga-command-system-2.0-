import React from 'react';
import { Shield } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  subtitle: string;
  category?: string;
  brief?: React.ReactNode;
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  category = "מפקדת פלוגה ג'",
  brief,
  actions,
}) => {
  return (
    <div className="mb-5 flex flex-col justify-between gap-3 border-b border-[rgba(2,1,8,0.08)] pb-3 md:flex-row md:items-end">
      <div className="min-w-0">
        <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold text-[#667085]">
          <Shield className="h-3 w-3 text-[#FF6B02]" />
          <span>{category}</span>
          <span>·</span>
          <span className="text-[#FF6B02]">{title}</span>
        </div>

        <h1 className="text-lg font-extrabold text-[#020108] sm:text-xl">{title}</h1>
        <p className="mt-0.5 max-w-2xl text-[13px] leading-relaxed text-[#667085] sm:text-sm">{subtitle}</p>
        {brief && (
          <div className="mt-3 rounded-2xl border border-[rgba(2,1,8,0.08)] bg-white/58 px-3 py-2 text-xs font-bold leading-relaxed text-[#344054]">
            {brief}
          </div>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2 self-start md:self-end">
          {actions}
        </div>
      )}
    </div>
  );
};
