'use client';

import { useState, useMemo, useRef } from 'react';
import { Video, LayoutGrid, X, Upload, User, RefreshCw } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useShallow } from 'zustand/react/shallow';
import ErrorToast from './ErrorToast';

/** 全屏浮窗展示图片 */
function ImagePreviewModal({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
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
        <img
          src={src}
          alt={alt}
          className="max-w-full max-h-[85vh] w-auto h-auto object-contain rounded-lg shadow-xl"
        />
      </div>
    </div>
  );
}

interface Step3ImageItem {
  id: string;
  url: string;
  label: string;
}

const ETHNICITY_OPTIONS = ['亚洲女性', '欧美女性', '亚洲男性', '欧美男性'] as const;

export default function Module4Video() {
  const {
    uploadedImage,
    emptySceneImage,
    scenePrompts,
    desireScenePrompts,
    unlockedModules,
    ethnicityOption,
    setEthnicityOption,
    step3OutputBaseDir,
    step4Groups,
    addStep4ContactSheet,
    addStep4Panel2K,
    addStep4GroupSource,
    unlockModule,
  } = useAppStore(
    useShallow((s) => ({
      uploadedImage: s.uploadedImage,
      emptySceneImage: s.emptySceneImage,
      scenePrompts: s.scenePrompts,
      desireScenePrompts: s.desireScenePrompts,
      unlockedModules: s.unlockedModules,
      ethnicityOption: s.ethnicityOption,
      setEthnicityOption: s.setEthnicityOption,
      step3OutputBaseDir: s.step3OutputBaseDir,
      step4Groups: s.step4Groups,
      addStep4ContactSheet: s.addStep4ContactSheet,
      addStep4Panel2K: s.addStep4Panel2K,
      addStep4GroupSource: s.addStep4GroupSource,
      unlockModule: s.unlockModule,
    }))
  );

  const [previewImage, setPreviewImage] = useState<{ src: string; alt: string } | null>(null);
  const [contactSheetImage, setContactSheetImage] = useState<string | null>(null);
  const [contactSheetSavedDir, setContactSheetSavedDir] = useState<string | null>(null);
  const [contactSheetLabel, setContactSheetLabel] = useState<string | null>(null);
  const [contactSheetSourceId, setContactSheetSourceId] = useState<string | null>(null);
  const [gridLoading, setGridLoading] = useState(false);
  const [expandingPanel, setExpandingPanel] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  /** 当前选中的格（1-9），用于显示该格下方的选项；hover 选中后不随鼠标离开清除，需点击其它格或关闭按钮才切换 */
  const [selectedPanel, setSelectedPanel] = useState<number | null>(null);
  /** 每格的生图选项：是否采用参考图、分辨率、辅助提示词 */
  const [panelOptions, setPanelOptions] = useState<Record<number, { useRef: boolean; resolution: '2K' | '4K'; auxiliaryPrompt: string }>>(() => {
    const o: Record<number, { useRef: boolean; resolution: '2K' | '4K'; auxiliaryPrompt: string }> = {};
    for (let i = 1; i <= 9; i++) o[i] = { useRef: true, resolution: '2K', auxiliaryPrompt: '' };
    return o;
  });
  /** 人物参考图：null 表示使用第一步上传的参考图（uploadedImage），非 null 表示用户上传的其它参考图 */
  const [characterRefImage, setCharacterRefImage] = useState<string | null>(null);
  const characterRefInputRef = useRef<HTMLInputElement>(null);
  /** 实际用于九宫格/2K 的人物参考图：默认第一步参考图，支持用户上传其它 */
  const effectiveCharacterRefImage = characterRefImage ?? uploadedImage ?? null;

  const step3Images = useMemo<Step3ImageItem[]>(() => {
    const list: Step3ImageItem[] = [];
    if (emptySceneImage) {
      list.push({ id: 'empty', url: emptySceneImage, label: '空场景' });
    }
    scenePrompts.forEach((p, i) => {
      if (p.imageUrl) list.push({ id: p.id, url: p.imageUrl, label: `场景 ${i + 1}` });
    });
    desireScenePrompts.forEach((p, i) => {
      if (p.imageUrl) list.push({ id: p.id, url: p.imageUrl, label: `爱欲场景 ${i + 1}` });
    });
    return list;
  }, [emptySceneImage, scenePrompts, desireScenePrompts]);

  const hasStep3Images = step3Images.length > 0;
  const isUnlocked = unlockedModules.includes(4) || (unlockedModules.includes(3) && hasStep3Images);

  /** 当前选中的接触表对应的 2K 图列表（按生成顺序），从 store 计算 */
  const panel2KOrderedForCurrent = useMemo(() => {
    if (!contactSheetSourceId || !contactSheetImage) return [];
    const g = step4Groups.find((x) => x.sourceId === contactSheetSourceId);
    const sheet = g?.sheets.find((s) => s.contactImageUrl === contactSheetImage || s.savedDir === contactSheetSavedDir);
    return sheet?.panel2KOrdered ?? [];
  }, [step4Groups, contactSheetSourceId, contactSheetImage, contactSheetSavedDir]);

  const handleGenerateGrid = async (sourceId: string, imageUrl: string, label: string, gridType: 'normal' | 'closeup' = 'normal') => {
    if (contactSheetImage && contactSheetSourceId != null && contactSheetLabel) {
      addStep4ContactSheet(contactSheetSourceId, contactSheetLabel, step3Images.find((i) => i.id === contactSheetSourceId)?.url ?? '', contactSheetImage, contactSheetSavedDir ?? '');
    }
    setGridLoading(true);
    setContactSheetImage(null);
    setContactSheetSavedDir(null);
    setContactSheetLabel(label);
    setContactSheetSourceId(null);
    try {
      const res = await fetch('/api/generate-grid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: imageUrl,
          characterReferenceImage: effectiveCharacterRefImage ?? undefined,
          ethnicity: ethnicityOption,
          step3OutputBaseDir: step3OutputBaseDir ?? undefined,
          type: gridType,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : '九宫格接触表生成失败，请重试');
      }
      const newUrl = data.imageUrl ?? null;
      const newDir = data.savedDir ?? null;
      setContactSheetImage(newUrl);
      setContactSheetSavedDir(newDir);
      setContactSheetLabel(label);
      setContactSheetSourceId(sourceId);
      if (newUrl && newDir) {
        const srcUrl = step3Images.find((i) => i.id === sourceId)?.url ?? '';
        addStep4ContactSheet(sourceId, label, srcUrl, newUrl, newDir);
      }
    } catch (e) {
      console.error(e);
      setErrorMessage(e instanceof Error ? e.message : '九宫格接触表生成失败，请重试');
    } finally {
      setGridLoading(false);
    }
  };

  const selectContactSheet = (url: string, savedDir: string, label: string, sourceId: string) => {
    setContactSheetImage(url);
    setContactSheetSavedDir(savedDir);
    setContactSheetLabel(label);
    setContactSheetSourceId(sourceId);
  };

  const handleExpandPanel = async (panelIndex: number) => {
    if (!contactSheetImage || !contactSheetSourceId) return;
    const opts = panelOptions[panelIndex] ?? { useRef: true, resolution: '2K' as const, auxiliaryPrompt: '' };
    setExpandingPanel(panelIndex);
    try {
      const res = await fetch('/api/generate-grid-cell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: contactSheetImage,
          panelIndex,
          saveDir: contactSheetSavedDir ?? undefined,
          useCharacterReference: opts.useRef,
          characterReferenceImage: opts.useRef ? effectiveCharacterRefImage ?? undefined : undefined,
          ethnicity: ethnicityOption,
          step3OutputBaseDir: step3OutputBaseDir ?? undefined,
          resolution: opts.resolution,
          auxiliaryPrompt: opts.auxiliaryPrompt || undefined,
        }),
      });
      if (!res.ok) throw new Error(`${opts.resolution} 生成失败`);
      const data = await res.json();
      const url = data.imageUrl ?? null;
      if (url) {
        addStep4Panel2K(contactSheetSourceId, contactSheetImage, panelIndex, url);
        const twoKLabel = `${contactSheetLabel ?? ''} - 第${panelIndex}格${opts.resolution}`;
        addStep4GroupSource(`2k-${contactSheetSourceId}-${panelIndex}-${Date.now()}`, twoKLabel, url);
        unlockModule(5);
      }
    } catch (e) {
      console.error(e);
      setErrorMessage(`第 ${panelIndex} 格 ${opts.resolution} 大图生成失败，请重试`);
    } finally {
      setExpandingPanel(null);
    }
  };

  const updatePanelOption = (panelIndex: number, key: keyof typeof panelOptions[1], value: boolean | '2K' | '4K' | string) => {
    setPanelOptions((prev) => ({
      ...prev,
      [panelIndex]: {
        ...prev[panelIndex],
        [key]: value,
      },
    }));
  };

  if (!isUnlocked) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <Video size={48} className="mx-auto mb-4 text-[var(--foreground-muted)]" />
          <h2 className="text-xl font-light mb-2">
            <span className="text-[var(--accent)]">04</span> 分镜创作
          </h2>
          <p className="text-[var(--foreground-muted)]">
            请先在第三步至少生成一张场景图后，本页才会解锁
          </p>
        </div>
      </div>
    );
  }

  const isGenerating = gridLoading || expandingPanel !== null;

  return (
    <div className="flex h-[calc(100vh-6rem)] min-h-[400px] gap-4 -m-2 p-0 relative">
      {/* 生成中全屏遮罩：变暗 + 浮动动画防误操作 */}
      {isGenerating && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm" aria-hidden>
          <div className="flex flex-col items-center gap-4 text-[var(--foreground)]">
            <RefreshCw size={48} className="animate-spin text-[var(--accent)]" />
            <p className="text-sm">生成中，请勿操作...</p>
          </div>
        </div>
      )}
      {/* 左侧 25%：人物参考图 + 第三步图片 + 接触表历史，整体可滚动 */}
      <aside className="w-1/4 min-w-[200px] flex flex-col border-r border-[var(--border)] pr-4 overflow-hidden">
        <div className="mb-3 flex-shrink-0">
          <h1 className="text-xl font-light">
            <span className="text-[var(--accent)]">04</span> 分镜创作
          </h1>
          <p className="text-xs text-[var(--foreground-muted)] mt-1">
            点击图片可全屏；点击九宫格生成 16:9 接触表，再点击分区生成该格 2K 大图（16:9）
          </p>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-visible space-y-4 min-h-0 px-1">
          {/* 人物参考图（可选）：支持拖拽 + 点击上传 */}
          <div
            className="rounded-lg border border-[var(--border)] bg-[var(--background-tertiary)] p-3 flex-shrink-0"
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('ring-2', 'ring-[var(--accent)]'); }}
            onDragLeave={(e) => { e.currentTarget.classList.remove('ring-2', 'ring-[var(--accent)]'); }}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.classList.remove('ring-2', 'ring-[var(--accent)]');
              const f = e.dataTransfer.files?.[0];
              if (!f?.type.startsWith('image/')) return;
              const r = new FileReader();
              r.onload = () => setCharacterRefImage(String(r.result));
              r.readAsDataURL(f);
            }}
          >
            <h3 className="text-xs font-medium text-[var(--foreground-muted)] flex items-center gap-1.5 mb-2">
              <User size={14} />
              人物参考图（默认第一步参考图，可上传其它）
            </h3>
            <p className="text-[10px] text-[var(--foreground-muted)] mb-2">
              默认使用第一步上传的参考图；可上传其它图片。九宫格与 2K 大图将强调【人种】并严格按照参考图人物的所有面部特征
            </p>
            <label className="text-[10px] text-[var(--foreground-muted)] block mb-1">人种</label>
            <select
              value={ethnicityOption}
              onChange={(e) => setEthnicityOption(e.target.value as typeof ethnicityOption)}
              className="input-field w-full text-xs py-1.5 mb-2"
            >
              {ETHNICITY_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
            <input
              ref={characterRefInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const r = new FileReader();
                r.onload = () => setCharacterRefImage(String(r.result));
                r.readAsDataURL(f);
              }}
            />
            {effectiveCharacterRefImage ? (
              <div className="space-y-2">
                <button
                  type="button"
                  className="block w-full rounded overflow-hidden border border-[var(--border)] hover:ring-2 hover:ring-[var(--accent)]"
                  onClick={() => setPreviewImage({ src: effectiveCharacterRefImage, alt: '人物参考图' })}
                >
                  <img src={effectiveCharacterRefImage} alt="人物参考" className="w-full aspect-[3/4] object-cover" />
                </button>
                <p className="text-[10px] text-[var(--foreground-muted)]">
                  {characterRefImage ? '已上传其它参考图' : '默认：第一步参考图'}
                </p>
                <div className="flex gap-1">
                  <button
                    type="button"
                    className="btn-secondary flex-1 flex items-center justify-center gap-1 text-xs"
                    onClick={() => characterRefInputRef.current?.click()}
                  >
                    <Upload size={12} />
                    {characterRefImage ? '更换' : '上传其它参考图'}
                  </button>
                  {characterRefImage && (
                    <button
                      type="button"
                      className="btn-secondary flex items-center justify-center gap-1 text-xs px-2"
                      onClick={() => { setCharacterRefImage(null); characterRefInputRef.current && (characterRefInputRef.current.value = ''); }}
                      title="恢复为第一步参考图"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="w-full py-3 rounded-lg border border-dashed border-[var(--border)] text-[var(--foreground-muted)] text-xs hover:bg-[var(--background)] hover:border-[var(--accent)]/50 transition-colors flex items-center justify-center gap-2"
                onClick={() => characterRefInputRef.current?.click()}
              >
                <Upload size={16} />
                上传人物参考图（第一步未上传时使用）
              </button>
            )}
          </div>

          {/* 第三步场景图 + 2K 图（均带九宫格 / 特写九宫格），及接触表列表 */}
          {step3Images.length === 0 && step4Groups.filter((g) => g.sourceId.startsWith('2k-')).length === 0 ? (
            <p className="text-sm text-[var(--foreground-muted)] py-4">
              暂无图片，请先在第三步生成空场景或场景图
            </p>
          ) : (
            <>
              {step3Images.map((item) => {
                const sheetsForSource = step4Groups.find((g) => g.sourceId === item.id)?.sheets ?? [];
                return (
                  <div key={item.id} className="space-y-2">
                    <div className="rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--background-tertiary)]">
                      <div className="relative aspect-video group">
                        <div
                          className="w-full h-full cursor-pointer hover:ring-2 hover:ring-[var(--accent)] hover:ring-inset transition-shadow"
                          onClick={() => setPreviewImage({ src: item.url, alt: item.label })}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setPreviewImage({ src: item.url, alt: item.label })}
                        >
                          <img src={item.url} alt={item.label} className="w-full h-full object-cover pointer-events-none" />
                        </div>
                        <div className="absolute bottom-2 right-2 flex gap-1">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleGenerateGrid(item.id, item.url, item.label, 'normal'); }}
                            disabled={gridLoading}
                            className="p-2 rounded-lg bg-black/60 hover:bg-[var(--accent)] text-white transition-colors disabled:opacity-50"
                            title="九宫格（16:9 接触表）"
                          >
                            <LayoutGrid size={18} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleGenerateGrid(item.id, item.url, item.label, 'closeup'); }}
                            disabled={gridLoading}
                            className="p-2 rounded-lg bg-rose-600/80 hover:bg-rose-500 text-white transition-colors disabled:opacity-50"
                            title="特写九宫格"
                          >
                            <LayoutGrid size={18} />
                          </button>
                        </div>
                        <span className="absolute bottom-2 left-2 text-xs text-white/90 bg-black/50 px-2 py-0.5 rounded">
                          {item.label}
                        </span>
                      </div>
                    </div>
                    {sheetsForSource.length > 0 && (
                      <div className="pl-1 space-y-1">
                        <p className="text-[10px] text-[var(--foreground-muted)]">已生成接触表（点击切换）：</p>
                        {sheetsForSource.map((s, idx) => (
                          <button
                            key={`${item.id}-${idx}-${s.savedDir}`}
                            type="button"
                            className="block w-full rounded overflow-hidden border border-[var(--border)] hover:ring-2 hover:ring-[var(--accent)] hover:ring-inset text-left"
                            onClick={() => selectContactSheet(s.contactImageUrl, s.savedDir, item.label, item.id)}
                          >
                            <img src={s.contactImageUrl} alt={`九宫格 ${idx + 1}`} className="w-full aspect-video object-cover" />
                            <span className="text-[10px] text-[var(--foreground-muted)] px-1 py-0.5 block">九宫格 · {s.savedDir}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {/* 2K 图作为来源（由 addStep4GroupSource 添加），显示在左侧栏，带九宫格 / 特写九宫格 */}
              {step4Groups.filter((g) => g.sourceId.startsWith('2k-')).map((g) => (
                <div key={g.sourceId} className="rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--background-tertiary)]">
                  <div className="relative aspect-video group">
                    <div
                      className="w-full h-full cursor-pointer hover:ring-2 hover:ring-[var(--accent)] hover:ring-inset transition-shadow"
                      onClick={() => setPreviewImage({ src: g.sourceImageUrl, alt: g.sourceLabel })}
                      role="button"
                      tabIndex={0}
                    >
                      <img src={g.sourceImageUrl} alt={g.sourceLabel} className="w-full h-full object-cover pointer-events-none" />
                    </div>
                    <div className="absolute bottom-2 right-2 flex gap-1">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleGenerateGrid(g.sourceId, g.sourceImageUrl, g.sourceLabel, 'normal'); }}
                        disabled={gridLoading}
                        className="p-2 rounded-lg bg-black/60 hover:bg-[var(--accent)] text-white transition-colors disabled:opacity-50"
                        title="九宫格"
                      >
                        <LayoutGrid size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleGenerateGrid(g.sourceId, g.sourceImageUrl, g.sourceLabel, 'closeup'); }}
                        disabled={gridLoading}
                        className="p-2 rounded-lg bg-rose-600/80 hover:bg-rose-500 text-white transition-colors disabled:opacity-50"
                        title="特写九宫格"
                      >
                        <LayoutGrid size={18} />
                      </button>
                    </div>
                    <span className="absolute bottom-2 left-2 text-xs text-white/90 bg-black/50 px-2 py-0.5 rounded truncate max-w-[70%]">
                      {g.sourceLabel}
                    </span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </aside>

      {/* 右侧 75%：接触表 + 3x3 可点击分区 + 2K 结果 */}
      <main className="flex-1 min-w-0 flex flex-col bg-[var(--background-tertiary)] rounded-lg border border-[var(--border)] p-4">
        <div className="flex-1 min-h-0 flex flex-col">
          {gridLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-10 h-10 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-[var(--foreground-muted)]">正在生成九宫格接触表（16:9）...</p>
              </div>
            </div>
          ) : contactSheetImage ? (
            <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">
              {contactSheetLabel && (
                <p className="text-xs text-[var(--foreground-muted)] mb-1">
                  九宫格 · 依据「{contactSheetLabel}」生成（16:9，点击图片可全屏；点击任意格可生成该格 2K 大图）
                </p>
              )}
              {contactSheetSavedDir && (
                <p className="text-xs text-[var(--accent)] font-mono mb-2">已保存至 {contactSheetSavedDir}</p>
              )}
              {/* 九宫格接触表：图片在上，透明网格覆盖层仅做可点区域与细线，不遮挡图片 */}
              <div className="w-[90%] max-w-4xl mx-auto relative">
                <p className="text-xs font-medium text-[var(--accent)] mb-1">九宫格（点击任意格选中，在下方选项中点击「生图」生成该格 2K 大图）</p>
                <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--background)]">
                  <img
                    src={contactSheetImage}
                    alt="九宫格接触表"
                    className="absolute inset-0 w-full h-full object-contain"
                  />
                  {/* 透明 3x3 网格覆盖：点击格选中，下方显示生图选项 */}
                  <div
                    className="absolute inset-0 grid grid-cols-3 grid-rows-3 border border-[var(--border)]"
                    style={{ backgroundColor: 'transparent' }}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    role="presentation"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                      <div
                        key={n}
                        onMouseEnter={() => setSelectedPanel(n)}
                        className="relative border border-black/30 hover:bg-[var(--accent)]/25 transition-colors"
                      >
                        {expandingPanel === n ? (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                          </div>
                        ) : (
                          <span className="absolute bottom-1 right-1 text-[10px] font-mono text-white/90 drop-shadow-md bg-black/40 px-1.5 py-0.5 rounded">
                            第{n}格
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {/* 悬停某格后，下方固定显示该格生图选项（移开鼠标不隐藏）— 单行、无多余文字、无下拉箭头 */}
              {selectedPanel !== null && (
                <div className="w-[90%] max-w-4xl mx-auto mt-4 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background-secondary)]/90 overflow-x-auto">
                  <div className="flex flex-nowrap items-center gap-2 min-w-0">
                    <span className="text-[20px] text-[var(--accent)] font-mono w-7 flex-shrink-0 text-center" title="当前格">{selectedPanel}</span>
                    <label className="flex items-center gap-1.5 flex-shrink-0 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={panelOptions[selectedPanel]?.useRef ?? true}
                        onChange={(e) => updatePanelOption(selectedPanel, 'useRef', e.target.checked)}
                        className="rounded border-[var(--border)]"
                      />
                      <span className="text-xs text-[var(--foreground-muted)]">是否选择参考图</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[var(--foreground-muted)]">分辨率</span>
                      <select
                        value={panelOptions[selectedPanel]?.resolution ?? '2K'}
                        onChange={(e) => updatePanelOption(selectedPanel, 'resolution', e.target.value as '2K' | '4K')}
                        className="input-field text-sm py-1.5 w-24"
                      >
                        <option value="2K">2K</option>
                        <option value="4K">4K</option>
                      </select>
                    </div>
                    <div className="flex-1 min-w-[160px]">
                      <input
                        type="text"
                        value={panelOptions[selectedPanel]?.auxiliaryPrompt ?? ''}
                        onChange={(e) => updatePanelOption(selectedPanel, 'auxiliaryPrompt', e.target.value)}
                        placeholder="自主输入辅助提示词（可选）"
                        className="input-field w-full text-sm py-1.5"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleExpandPanel(selectedPanel)}
                      disabled={expandingPanel !== null}
                      title="生图"
                      className={`flex-shrink-0 w-5 h-5 rounded-full bg-red-500 border border-red-400 shadow-[0_0_0_2px_rgba(239,68,68,0.4),0_0_12px_rgba(239,68,68,0.35)] hover:shadow-[0_0_0_2px_rgba(239,68,68,0.6),0_0_16px_rgba(239,68,68,0.4)] disabled:cursor-not-allowed disabled:shadow-none transition-all ${expandingPanel === selectedPanel ? 'opacity-70 animate-pulse' : 'disabled:opacity-50'}`}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center p-8">
              <div>
                <LayoutGrid size={48} className="mx-auto mb-4 text-[var(--foreground-muted)]" />
                <p className="text-sm text-[var(--foreground-muted)]">
                  点击左侧图片右下角「九宫格」按钮，将生成九宫格接触表；再点击接触表上的分区可生成该格 2K 大图（16:9），下方以一列展示
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      {previewImage && (
        <ImagePreviewModal
          src={previewImage.src}
          alt={previewImage.alt}
          onClose={() => setPreviewImage(null)}
        />
      )}

      {errorMessage && (
        <ErrorToast message={errorMessage} onClose={() => setErrorMessage(null)} />
      )}
    </div>
  );
}
