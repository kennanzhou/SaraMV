'use client';

import { useState } from 'react';
import { MonitorPlay, X } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useShallow } from 'zustand/react/shallow';

/** 全屏视频播放浮窗 */
function VideoPreviewModal({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative max-w-[90vw] max-h-[90vh] flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-10 right-0 p-2 rounded-full bg-[var(--background-secondary)] hover:bg-[var(--background-tertiary)] text-[var(--foreground-muted)] transition-colors z-10"
          aria-label="关闭"
        >
          <X size={20} />
        </button>
        <video
          src={src}
          controls
          autoPlay
          className="max-w-full max-h-[85vh] rounded-lg shadow-xl"
        />
      </div>
    </div>
  );
}

export default function Module6VideoGallery() {
  const { generatedVideos } = useAppStore(
    useShallow((s) => ({
      generatedVideos: s.generatedVideos,
    }))
  );
  const [previewVideo, setPreviewVideo] = useState<string | null>(null);

  if (generatedVideos.length === 0) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <MonitorPlay size={48} className="mx-auto mb-4 text-[var(--foreground-muted)]" />
          <h2 className="text-xl font-light mb-2">
            <span className="text-[var(--accent)]">06</span> 视频浏览
          </h2>
          <p className="text-[var(--foreground-muted)]">
            请先在第五步至少生成一个视频后，本页才会解锁
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-light">
          <span className="text-[var(--accent)]">06</span> 视频浏览
        </h1>
        <p className="text-xs text-[var(--foreground-muted)]">
          共 {generatedVideos.length} 个视频 · 点击可全屏播放
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {generatedVideos.map((v, idx) => (
          <button
            key={`video-${idx}-${v.createdAt}`}
            type="button"
            onClick={() => setPreviewVideo(v.videoUrl)}
            className="group rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--background-tertiary)] hover:ring-2 hover:ring-[var(--accent)] hover:ring-inset transition-shadow text-left"
          >
            <div className="relative aspect-video bg-black flex items-center justify-center">
              <video
                src={v.videoUrl}
                muted
                preload="metadata"
                className="w-full h-full object-contain"
                onMouseEnter={(e) => {
                  const el = e.currentTarget;
                  el.currentTime = 0;
                  el.play().catch(() => {});
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.pause();
                  e.currentTarget.currentTime = 0;
                }}
              />
              {/* 播放图标覆盖层 */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10 transition-colors pointer-events-none">
                <MonitorPlay size={36} className="text-white/70 group-hover:text-white group-hover:scale-110 transition-all drop-shadow-lg" />
              </div>
            </div>
            <div className="px-3 py-2">
              <p className="text-xs text-[var(--foreground)] truncate">{v.sourceLabel}</p>
              <p className="text-[10px] text-[var(--foreground-muted)]">
                {new Date(v.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </p>
              {v.savedPath && (
                <p className="text-[10px] text-[var(--accent)] font-mono truncate" title={v.savedPath}>
                  {v.savedPath}
                </p>
              )}
            </div>
          </button>
        ))}
      </div>

      {previewVideo && (
        <VideoPreviewModal src={previewVideo} onClose={() => setPreviewVideo(null)} />
      )}
    </div>
  );
}
