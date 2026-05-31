'use client';

import React, { useState } from 'react';
import { HelpCircle, X } from 'lucide-react';

export const QuickHelp: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="command-icon-button"
        aria-label="עזרה מהירה"
        title="עזרה"
      >
        {isOpen ? <X className="h-4 w-4" /> : <HelpCircle className="h-4 w-4" />}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[80] px-4 pt-20 sm:pt-24">
          <button
            type="button"
            aria-label="סגור עזרה"
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 bg-[#020108]/10 backdrop-blur-[2px]"
          />

          <div className="command-help-panel relative mx-auto w-full max-w-md rounded-[22px] border border-[rgba(2,1,8,0.10)] bg-white/94 p-4 text-right shadow-[0_18px_50px_rgba(2,1,8,0.16)] backdrop-blur-2xl">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-sm font-black text-[#020108]">עזרה מהירה</h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="command-icon-button h-8 w-8 shrink-0"
                aria-label="סגור עזרה"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 space-y-2 text-xs font-semibold leading-relaxed text-[#667085]">
              <p>זו גרסה מוקדמת של המפקד.</p>
              <p>הכניסה זמינה במצב פיתוח, ותהליכי אימות מייל נבדקים לפי מגבלות Supabase.</p>
              <p>משימות, דרישות ופורום יחוברו בשלבים הבאים.</p>
              <p className="rounded-2xl border border-[#FF6B02]/20 bg-[#FF6B02]/10 px-3 py-2 text-[#9A4600]">
                אין במערכת מידע מבצעי אמיתי.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
