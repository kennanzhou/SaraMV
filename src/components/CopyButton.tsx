'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CopyButtonProps {
  text: string;
  className?: string;
}

export default function CopyButton({ text, className = '' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`p-1.5 rounded hover:bg-[var(--accent-glow)] transition-colors ${className}`}
      title="复制"
    >
      {copied ? (
        <Check size={14} className="text-[var(--accent)]" />
      ) : (
        <Copy size={14} className="text-[var(--foreground-muted)] hover:text-[var(--accent)]" />
      )}
    </button>
  );
}
