'use client';

import React from 'react';
import AITransparencyProvider from '@/contexts/AITransparencyContext';
import ThreadProvider from '@/contexts/ThreadContext';

export default function ClientProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThreadProvider resetOnLoad={true}>
      <AITransparencyProvider>
        {children}
      </AITransparencyProvider>
    </ThreadProvider>
  );
} 