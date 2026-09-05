import React from 'react';
import { ShieldAlert } from 'lucide-react';

/**
 * Sits under a free-text field that tends to collect personal data (medical
 * notes, welfare status, disciplinary notes). Advisory only — it doesn't
 * validate or block input, just reminds whoever is typing to prefer
 * initials/classification over full identifying detail.
 */
export const FieldPrivacyHint: React.FC = () => (
  <span className="mt-1 flex items-start gap-1.5 text-caption font-semibold leading-relaxed text-[var(--command-subtle)]">
    <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0" />
    מומלץ להשתמש בראשי תיבות או בסיווג כללי במקום פרטים מזהים מלאים.
  </span>
);
