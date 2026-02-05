'use client';

import { useState, useMemo } from 'react';
import { PlayCircle, ImageIcon, Upload, AlertCircle } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useShallow } from 'zustand/react/shallow';
import ErrorToast from './ErrorToast';

const ETHNICITY_PREFIX: Record<string, string> = {
  亚洲女性: '【亚洲女性】，严格按照参考图人物的所有面部特征。',
  欧美女性: '【欧美女性】，严格按照参考图人物的所有面部特征。',
  亚洲男性: '【亚洲男性】，严格按照参考图人物的所有面部特征。',
  欧美男性: '【欧美男性】，严格按照参考图人物的所有面部特征。',
};

export default function Module5Video() {
  const { step4Groups, ethnicityOption, step3OutputBaseDir } = useAppStore(
    useShallow((s) => ({
      step4Groups: s.step4Groups,
      ethnicityOption: s.ethnicityOption,
      step3OutputBaseDir: s.step3OutputBaseDir,
    }))
  );
  const [selectedImage, setSelectedImage] = useState<{ url: string; label: string } | null>(null);
  /** 当前选中图片上传至图床后的公网 URL，只有上传成功后才可生成视频 */
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [needPublicUrlWarning, setNeedPublicUrlWarning] = useState(false);
  const [promptSuffix, setPromptSuffix] = useState('');
  const [resolution, setResolution] = useState<'720p' | '1080p'>('720p');
  const [duration, setDuration] = useState(10);
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1' | '4:3'>('16:9');
  const [videoLoading, setVideoLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const ethnicityPrefix = ETHNICITY_PREFIX[ethnicityOption] ?? ETHNICITY_PREFIX['亚洲女性'];
  const fullPrompt = selectedImage ? `${ethnicityPrefix} ${promptSuffix}`.trim() : '';

  /** 左侧列表：按 step4Groups 顺序，每组为场景图 + 其下所有 2K 图（按生成顺序） */
  const leftListItems = useMemo(() => {
    const items: Array<{ type: 'scene'; url: string; label: string; groupLabel: string } | { type: '2k'; url: string; label: string; groupLabel: string }> = [];
    step4Groups.forEach((g) => {
      items.push({ type: 'scene', url: g.sourceImageUrl, label: g.sourceLabel, groupLabel: g.sourceLabel });
      g.sheets.forEach((s, sheetIdx) => {
        s.panel2KOrdered.forEach((p, idx) => {
          items.push({
            type: '2k',
            url: p.imageUrl,
            label: `${g.sourceLabel} - 2K #${idx + 1} (格${p.panelIndex})`,
            groupLabel: g.sourceLabel,
          });
        });
      });
    });
    return items;
  }, [step4Groups]);

  const hasStep4Output = step4Groups.some((g) => g.sheets.some((s) => s.panel2KOrdered.length > 0));

  const handleUploadToImageHost = async () => {
    if (!selectedImage?.url) {
      setErrorMessage('请先选择一张图片');
      return;
    }
    setUploadingImage(true);
    setErrorMessage(null);
    setNeedPublicUrlWarning(false);
    try {
      const res = await fetch('/api/upload-for-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: selectedImage.url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || '上传失败');
      setUploadedImageUrl(data.url);
      if (data.needPublicUrl) setNeedPublicUrlWarning(true);
    } catch (e) {
      console.error(e);
      setErrorMessage(e instanceof Error ? e.message : '上传至图床失败，请重试');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleGenerateVideo = async () => {
    if (!uploadedImageUrl || !fullPrompt.trim()) {
      setErrorMessage(uploadedImageUrl ? '请输入提示词' : '请先上传当前图片至图床');
      return;
    }
    setVideoLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/grok-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: uploadedImageUrl,
          prompt: fullPrompt,
          resolution,
          duration,
          aspectRatio,
          step3OutputBaseDir: step3OutputBaseDir ?? undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || '视频生成失败');
      if (data.videoUrl) window.open(data.videoUrl, '_blank');
      if (data.savedPath) setErrorMessage(null);
    } catch (e) {
      console.error(e);
      setErrorMessage(e instanceof Error ? e.message : '视频生成失败，请重试');
    } finally {
      setVideoLoading(false);
    }
  };

  if (!hasStep4Output) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <PlayCircle size={48} className="mx-auto mb-4 text-[var(--foreground-muted)]" />
          <h2 className="text-xl font-light mb-2">
            <span className="text-[var(--accent)]">05</span> 视频生成
          </h2>
          <p className="text-[var(--foreground-muted)]">
            请先在第四步至少生成一张九宫格 2K 大图后，本页才会解锁
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-6rem)] min-h-[400px] gap-4 -m-2 p-0">
      {/* 左侧 25%：场景图 + 九宫格 2K 图列表，按组、按生成顺序 */}
      <aside className="w-1/4 min-w-[200px] flex flex-col border-r border-[var(--border)] pr-4 overflow-hidden">
        <div className="mb-3 flex-shrink-0">
          <h1 className="text-xl font-light">
            <span className="text-[var(--accent)]">05</span> 视频生成
          </h1>
          <p className="text-xs text-[var(--foreground-muted)] mt-1">
            选择一张图片，在右侧输入提示词并调用 Grok API 生成视频
          </p>
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-visible space-y-2 min-h-0 px-1">
          {leftListItems.length === 0 ? (
            <p className="text-sm text-[var(--foreground-muted)] py-4">暂无图片</p>
          ) : (
            leftListItems.map((item, idx) => (
            <button
              key={`${item.type}-${idx}-${item.url.slice(0, 30)}`}
                type="button"
                onClick={() => {
                  setSelectedImage({ url: item.url, label: item.label });
                  setUploadedImageUrl(null);
                  setNeedPublicUrlWarning(false);
                }}
                className={`block w-full rounded-lg overflow-hidden border text-left transition-shadow ${
                  selectedImage?.url === item.url
                    ? 'border-[var(--accent)] ring-2 ring-[var(--accent)] ring-inset'
                    : 'border-[var(--border)] hover:ring-2 hover:ring-[var(--accent)]/50 hover:ring-inset'
                }`}
              >
                <div className="aspect-video bg-[var(--background-tertiary)]">
                  <img src={item.url} alt={item.label} className="w-full h-full object-cover" />
                </div>
                <span className="block text-xs text-[var(--foreground-muted)] px-2 py-1 truncate">{item.label}</span>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* 右侧：选中图缩略图 + 提示词（人种前缀不可删）+ 分辨率/时长/宽高比 + 生成按钮 */}
      <main className="flex-1 min-w-0 flex flex-col bg-[var(--background-tertiary)] rounded-lg border border-[var(--border)] p-6 overflow-y-auto">
        <h2 className="text-lg font-light mb-4">
          <span className="text-[var(--accent)]">Grok</span> 视频生成
        </h2>

        {selectedImage ? (
          <>
            <div className="mb-4">
              <p className="text-xs text-[var(--foreground-muted)] mb-2">当前选中图片</p>
              <div className="inline-block rounded-lg overflow-hidden border border-[var(--border)] max-w-xs aspect-video">
                <img src={selectedImage.url} alt={selectedImage.label} className="w-full h-full object-contain" />
              </div>
              <p className="text-xs text-[var(--foreground-muted)] mt-1 truncate max-w-xs">{selectedImage.label}</p>
              {!uploadedImageUrl ? (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={handleUploadToImageHost}
                    disabled={uploadingImage}
                    className="btn-primary flex items-center justify-center gap-2 w-full sm:w-auto"
                  >
                    {uploadingImage ? (
                      <>
                        <span className="w-4 h-4 border-2 border-[var(--background)] border-t-transparent rounded-full animate-spin" />
                        上传中...
                      </>
                    ) : (
                      <>
                        <Upload size={16} />
                        上传至图床
                      </>
                    )}
                  </button>
                  <p className="text-[10px] text-[var(--foreground-muted)] mt-1">
                    生视频需要图片的公网地址，请先上传；上传成功后即可使用下方功能
                  </p>
                </div>
              ) : (
                <p className="text-xs text-[var(--accent)] mt-2">已上传至图床，可生成视频</p>
              )}
              {needPublicUrlWarning && (
                <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400">
                  <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                  <span>当前为本地地址，xAI 可能无法访问。若生成失败，请将应用部署到公网或使用支持公网 URL 的图床</span>
                </div>
              )}
            </div>

            <div className="mb-4">
              <label className="text-sm text-[var(--foreground-muted)] block mb-2">提示词（人种前缀已固定，来自第四步选择）</label>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 text-xs text-[var(--foreground-muted)] mb-2">
                {ethnicityPrefix}
              </div>
              <textarea
                value={promptSuffix}
                onChange={(e) => setPromptSuffix(e.target.value)}
                placeholder="在此输入补充提示词..."
                className="input-field w-full min-h-[100px] resize-y"
              />
              <p className="text-[10px] text-[var(--foreground-muted)] mt-1">完整提示词将为人种前缀 + 上方输入内容</p>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="text-xs text-[var(--foreground-muted)] block mb-1">分辨率</label>
                <select
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value as '720p' | '1080p')}
                  className="input-field w-full text-sm"
                >
                  <option value="720p">720p</option>
                  <option value="1080p">1080p</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-[var(--foreground-muted)] block mb-1">时长（秒）</label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="input-field w-full text-sm"
                >
                  <option value={5}>5 秒</option>
                  <option value={8}>8 秒</option>
                  <option value={10}>10 秒</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-[var(--foreground-muted)] block mb-1">画面宽高比</label>
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value as '16:9' | '9:16' | '1:1' | '4:3')}
                  className="input-field w-full text-sm"
                >
                  <option value="16:9">16:9</option>
                  <option value="9:16">9:16</option>
                  <option value="1:1">1:1</option>
                  <option value="4:3">4:3</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleGenerateVideo}
              disabled={videoLoading || !fullPrompt.trim() || !uploadedImageUrl}
              className="btn-primary flex items-center justify-center gap-2"
            >
              {videoLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-[var(--background)] border-t-transparent rounded-full animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <PlayCircle size={18} />
                  生成视频
                </>
              )}
            </button>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center text-[var(--foreground-muted)]">
            <div>
              <ImageIcon size={48} className="mx-auto mb-3 opacity-60" />
              <p>请在左侧选择一张图片</p>
            </div>
          </div>
        )}
      </main>

      {errorMessage && (
        <ErrorToast message={errorMessage} onClose={() => setErrorMessage(null)} />
      )}
    </div>
  );
}
