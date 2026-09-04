'use client';

import React from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { MentoringPanel } from '@/components/mentoring/MentoringPanel';

export default function MentoringPage() {
  return (
    <div>
      <PageHeader
        title="חניכה"
        subtitle="יומן חניכה אישי למ״מים ולסמ״פ — תצפית, מוקד, פעולה מוסכמת ובדיקה חוזרת."
      />
      <MentoringPanel />
    </div>
  );
}
