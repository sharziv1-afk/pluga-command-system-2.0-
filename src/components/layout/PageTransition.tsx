'use client';

import React from 'react';
import { usePathname } from 'next/navigation';

export const PageTransition: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();

  return (
    <div key={pathname} className="command-page-transition">
      {children}
    </div>
  );
};
