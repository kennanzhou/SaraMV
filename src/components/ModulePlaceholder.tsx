'use client';

import { Construction } from 'lucide-react';

interface ModulePlaceholderProps {
  moduleNumber: number;
  title: string;
}

export default function ModulePlaceholder({ moduleNumber, title }: ModulePlaceholderProps) {
  return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="text-center">
        <Construction size={48} className="mx-auto mb-4 text-[var(--foreground-muted)]" />
        <h2 className="text-xl font-light mb-2">
          <span className="text-[var(--accent)]">0{moduleNumber}</span> {title}
        </h2>
        <p className="text-[var(--foreground-muted)]">
          此模块正在开发中，敬请期待...
        </p>
      </div>
    </div>
  );
}
