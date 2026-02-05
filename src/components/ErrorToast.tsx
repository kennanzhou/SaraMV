'use client';

import { X } from 'lucide-react';

interface ErrorToastProps {
  message: string;
  onClose: () => void;
}

/** 生成失败等错误时，在画面中弹出的提示窗口 */
export default function ErrorToast({ message, onClose }: ErrorToastProps) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
      role="alertdialog"
      aria-modal="true"
    >
      <div
        className="bg-[var(--background-secondary)] border border-[var(--border)] rounded-lg shadow-xl max-w-md w-full p-6 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[var(--foreground)] font-medium">提示</p>
        <p className="text-[var(--foreground-muted)] text-sm">{message}</p>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="btn-primary flex items-center gap-2 px-4 py-2"
          >
            <X size={16} />
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
