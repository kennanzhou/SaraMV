'use client';

import { useState, useMemo, useRef } from 'react';
import { Film, X, RefreshCw, User, Upload } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useShallow } from 'zustand/react/shallow';
import ErrorToast from './ErrorToast';

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

type PromptItem = { id: string; prompt: string; imageUrl: string | null; imageHistory?: string[] };

export default function Module3Storyboard() {
  const {
    uploadedImage,
    sceneContext,
    fullContext,
    characterGender,
    characterHairColor,
    sceneDescription,
    generatedStory,
    generatedStorySegments,
    generatedStoryOtherScene,
    scenePrompts,
    desireScenePrompts,
    setScenePrompts,
    setDesireScenePrompts,
    setStep3OutputBaseDir,
    selectedKeyword,
    imageContext,
    unlockModule,
    promptVersions,
    finalSelectedVersion,
    studioSceneImage,
    setStudioSceneImage,
    characterDescription,
    setCharacterDescription,
  } = useAppStore(
    useShallow((s) => ({
      uploadedImage: s.uploadedImage,
      sceneContext: s.sceneContext,
      fullContext: s.fullContext,
      characterGender: s.characterGender,
      characterHairColor: s.characterHairColor,
      sceneDescription: s.sceneDescription,
      generatedStory: s.generatedStory,
      generatedStorySegments: s.generatedStorySegments,
      generatedStoryOtherScene: s.generatedStoryOtherScene,
      scenePrompts: s.scenePrompts,
      desireScenePrompts: s.desireScenePrompts,
      setScenePrompts: s.setScenePrompts,
      setDesireScenePrompts: s.setDesireScenePrompts,
      setStep3OutputBaseDir: s.setStep3OutputBaseDir,
      selectedKeyword: s.selectedKeyword,
      imageContext: s.imageContext,
      unlockModule: s.unlockModule,
      promptVersions: s.promptVersions,
      finalSelectedVersion: s.finalSelectedVersion,
      studioSceneImage: s.studioSceneImage,
      setStudioSceneImage: s.setStudioSceneImage,
      characterDescription: s.characterDescription,
      setCharacterDescription: s.setCharacterDescription,
    }))
  );

  const finalVersion = finalSelectedVersion ? promptVersions.find((v) => v.version === finalSelectedVersion) : null;
  const lyricsForStudio = finalVersion?.data?.lyrics ?? '';

  const handleGenerateStudioScene = async () => {
    const refImage = effectiveCharacterRefImage ?? uploadedImage;
    if (!refImage) {
      alert('请先在第一步上传参考图片或在左侧上传人物参考图');
      return;
    }
    if (studioMode === 3 && !studioUserScene.trim()) {
      alert('请输入场景描述');
      return;
    }
    setStudioSceneLoading(true);
    try {
      const resPrompt = await fetch('/api/generate-studio-scene-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: studioMode,
          image: refImage,
          lyrics: lyricsForStudio,
          fullContext: fullContext || undefined,
          userScene: studioMode === 3 ? studioUserScene.trim() : undefined,
        }),
      });
      if (!resPrompt.ok) throw new Error('生成提示词失败');
      const { prompt } = await resPrompt.json();
      if (!prompt) throw new Error('未返回提示词');

      const resImage = await fetch('/api/generate-scene-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          referenceImage: refImage,
          keywordId,
          coreWord,
          filename: `studio_${studioMode}_${Date.now()}`,
          characterDescription: characterDescription || undefined,
        }),
      });
      const data = await resImage.json().catch(() => ({}));
      if (!resImage.ok) throw new Error(data.error || '场景图生成失败');
      if (data.imageUrl) setStudioSceneImage(data.imageUrl);
      if (data.saveDir) setStep3OutputBaseDir(data.saveDir);
      unlockModule(4);
    } catch (e) {
      console.error(e);
      setErrorMessage(e instanceof Error ? e.message : '录音棚场景图生成失败，请重试');
    } finally {
      setStudioSceneLoading(false);
    }
  };

  const [previewImage, setPreviewImage] = useState<{ src: string; alt: string } | null>(null);
  const [scenePromptsLoading, setScenePromptsLoading] = useState(false);
  const [desirePromptsLoading, setDesirePromptsLoading] = useState(false);
  const [loadingImageId, setLoadingImageId] = useState<string | null>(null);
  const [regeneratingPromptId, setRegeneratingPromptId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  /** 人物参考图：null 表示使用第一步参考图，非 null 表示用户上传的其它参考图 */
  const [characterRefImage, setCharacterRefImage] = useState<string | null>(null);
  const characterRefInputRef = useRef<HTMLInputElement>(null);
  const effectiveCharacterRefImage = characterRefImage ?? uploadedImage ?? null;
  /** 录音棚模式：1 录音棚 2 原图生成 3 用户输入场景 */
  const [studioMode, setStudioMode] = useState<1 | 2 | 3>(1);
  const [studioUserScene, setStudioUserScene] = useState('');
  const [studioSceneLoading, setStudioSceneLoading] = useState(false);
  const [charDescLoading, setCharDescLoading] = useState(false);
  // studioSceneImage 已迁移到 store 中，此处不再使用 useState

  const keywordId = selectedKeyword?.id ?? '';
  const coreWord = (imageContext || '').trim().slice(0, 30) || 'scene';

  const handleGenerateScenePrompts = async () => {
    if (!uploadedImage) {
      alert('请先在第一步上传参考图片');
      return;
    }
    setScenePromptsLoading(true);
    try {
      const res = await fetch('/api/generate-scene-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: uploadedImage,
          sceneContext,
          fullContext,
          characterGender,
          characterHairColor,
          sceneDescription,
        }),
      });
      if (!res.ok) throw new Error('生成失败');
      const data = await res.json();
      setScenePrompts(data.prompts ?? []);
    } catch (e) {
      console.error(e);
      setErrorMessage('场景拓展提示词生成失败，请重试');
    } finally {
      setScenePromptsLoading(false);
    }
  };

  const handleGenerateDesirePrompts = async () => {
    if (!generatedStory?.trim()) {
      alert('请先在第二步生成爱欲现场');
      return;
    }
    setDesirePromptsLoading(true);
    try {
      const res = await fetch('/api/generate-desire-scene-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          story: generatedStory,
          segments: generatedStorySegments,
          mainScenePrompts: scenePrompts.map((p) => p.prompt),
          sceneContext,
          image: uploadedImage,
          characterGender,
          characterHairColor,
          otherScene: generatedStoryOtherScene || undefined,
        }),
      });
      if (!res.ok) throw new Error('生成失败');
      const data = await res.json();
      setDesireScenePrompts(data.prompts ?? []);
    } catch (e) {
      console.error(e);
      setErrorMessage('爱欲现场场景提示词生成失败，请重试');
    } finally {
      setDesirePromptsLoading(false);
    }
  };

  const handleRegenerateScenePrompt = async (index: number) => {
    if (!uploadedImage) return;
    const item = scenePrompts[index];
    if (!item) return;
    setRegeneratingPromptId(item.id);
    try {
      const res = await fetch('/api/regenerate-one-scene-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: uploadedImage,
          sceneContext,
          fullContext,
          characterGender,
          characterHairColor,
          sceneDescription,
          index,
          existingPrompts: scenePrompts.map((p) => p.prompt),
        }),
      });
      if (!res.ok) throw new Error('重新生成失败');
      const data = await res.json();
      setScenePrompts(
        scenePrompts.map((p, j) => (j === index ? { ...p, prompt: data.prompt ?? p.prompt } : p))
      );
    } catch (e) {
      console.error(e);
      setErrorMessage('重新生成提示词失败，请重试');
    } finally {
      setRegeneratingPromptId(null);
    }
  };

  const handleRegenerateDesirePrompt = async (index: number) => {
    const item = desireScenePrompts[index];
    if (!item) return;
    setRegeneratingPromptId(item.id);
    try {
      const res = await fetch('/api/regenerate-one-desire-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          story: generatedStory,
          sceneContext,
          characterGender,
          characterHairColor,
          index,
          existingPrompts: desireScenePrompts.map((p) => p.prompt),
        }),
      });
      if (!res.ok) throw new Error('重新生成失败');
      const data = await res.json();
      setDesireScenePrompts(
        desireScenePrompts.map((p, j) => (j === index ? { ...p, prompt: data.prompt ?? p.prompt } : p))
      );
    } catch (e) {
      console.error(e);
      setErrorMessage('重新生成爱欲现场提示词失败，请重试');
    } finally {
      setRegeneratingPromptId(null);
    }
  };

  const updateScenePrompt = (id: string, prompt: string) => {
    setScenePrompts(scenePrompts.map((p) => (p.id === id ? { ...p, prompt } : p)));
  };
  const updateDesirePrompt = (id: string, prompt: string) => {
    setDesireScenePrompts(desireScenePrompts.map((p) => (p.id === id ? { ...p, prompt } : p)));
  };

  const handleGenerateSceneImage = async (item: PromptItem, index: number) => {
    if (!uploadedImage) {
      alert('请先在第一步上传参考图片');
      return;
    }
    setLoadingImageId(item.id);
    try {
      const res = await fetch('/api/generate-scene-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: item.prompt,
          referenceImage: uploadedImage,
          keywordId,
          coreWord,
          filename: `scene_${String(index + 1).padStart(2, '0')}`,
          characterDescription: characterDescription || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : '场景图生成失败，请检查 API Key 或稍后重试');
      if (data.saveDir) setStep3OutputBaseDir(data.saveDir);
      setScenePrompts(
        scenePrompts.map((p) => {
          if (p.id !== item.id) return p;
          const history = [...(p.imageHistory || [])];
          if (p.imageUrl) history.push(p.imageUrl);
          return { ...p, imageHistory: history, imageUrl: data.imageUrl };
        })
      );
      unlockModule(4);
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : '场景图生成失败，请重试';
      setErrorMessage(msg.includes('503') || msg.includes('Deadline') ? `${msg}（已生成的照片已保留，可稍后重试）` : msg);
    } finally {
      setLoadingImageId(null);
    }
  };

  const handleGenerateDesireImage = async (item: PromptItem, index: number) => {
    if (!uploadedImage) {
      alert('请先在第一步上传参考图片');
      return;
    }
    setLoadingImageId(item.id);
    try {
      const res = await fetch('/api/generate-scene-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: item.prompt,
          referenceImage: uploadedImage,
          keywordId,
          coreWord,
          filename: `desire_${String(index + 1).padStart(2, '0')}`,
          characterDescription: characterDescription || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '生成失败');
      if (data.saveDir) setStep3OutputBaseDir(data.saveDir);
      setDesireScenePrompts(
        desireScenePrompts.map((p) => {
          if (p.id !== item.id) return p;
          const history = [...(p.imageHistory || [])];
          if (p.imageUrl) history.push(p.imageUrl);
          return { ...p, imageHistory: history, imageUrl: data.imageUrl };
        })
      );
      unlockModule(4);
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : '爱欲现场场景图生成失败，请重试';
      setErrorMessage(msg.includes('503') || msg.includes('Deadline') ? `${msg}（已生成的照片已保留，可稍后重试）` : msg);
    } finally {
      setLoadingImageId(null);
    }
  };

  const allGeneratedImages = useMemo(() => {
    const list: { id: string; url: string; label: string }[] = [];
    scenePrompts.forEach((p, i) => {
      const urls = [...(p.imageHistory || []), p.imageUrl].filter(Boolean) as string[];
      urls.forEach((url, idx) => {
        list.push({ id: `${p.id}-${idx}`, url, label: `场景 ${i + 1}${urls.length > 1 ? ` (${idx + 1}/${urls.length})` : ''}` });
      });
    });
    desireScenePrompts.forEach((p, i) => {
      const urls = [...(p.imageHistory || []), p.imageUrl].filter(Boolean) as string[];
      urls.forEach((url, idx) => {
        list.push({ id: `d-${p.id}-${idx}`, url, label: `爱欲场景 ${i + 1}${urls.length > 1 ? ` (${idx + 1}/${urls.length})` : ''}` });
      });
    });
    return list;
  }, [scenePrompts, desireScenePrompts]);

  const isGenerating = scenePromptsLoading || desirePromptsLoading || loadingImageId !== null || studioSceneLoading;

  return (
    <div className="flex h-[calc(100vh-6rem)] min-h-[500px] gap-4 -m-2 p-0 relative">
      {/* 生成中全屏遮罩：变暗 + 浮动动画防误操作 */}
      {isGenerating && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm" aria-hidden>
          <div className="flex flex-col items-center gap-4 text-[var(--foreground)]">
            <RefreshCw size={48} className="animate-spin text-[var(--accent)]" />
            <p className="text-sm">生成中，请勿操作...</p>
          </div>
        </div>
      )}
      {/* 左侧 25%：参考图 + 生成的所有图片 */}
      <aside className="w-1/4 min-w-[200px] flex flex-col border-r border-[var(--border)] pr-4 overflow-hidden">
        <div className="mb-3">
          <h1 className="text-xl font-light">
            <span className="text-[var(--accent)]">03</span> 分镜创作
          </h1>
          <p className="text-xs text-[var(--foreground-muted)] mt-1">参考图与生成图片（点击可全屏）</p>
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-visible space-y-3 px-1 min-h-0">
          {/* 人物参考图（与第四步一致） */}
          <div className="rounded-lg border border-[var(--border)] bg-[var(--background-tertiary)] p-3 flex-shrink-0">
            <h3 className="text-xs font-medium text-[var(--foreground-muted)] flex items-center gap-1.5 mb-2">
              <User size={14} />
              人物参考图
            </h3>
            <p className="text-[10px] text-[var(--foreground-muted)] mb-2">默认第一步参考图，可上传其它</p>
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
                  <img src={effectiveCharacterRefImage} alt="参考" className="w-full aspect-[3/4] object-cover" />
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
                    {characterRefImage ? '更换' : '上传其它'}
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
                className="w-full py-3 rounded-lg border border-dashed border-[var(--border)] text-[var(--foreground-muted)] text-xs hover:bg-[var(--background)] flex items-center justify-center gap-2"
                onClick={() => characterRefInputRef.current?.click()}
              >
                <Upload size={16} />
                上传人物参考图
              </button>
            )}
          </div>

          {/* 人物特征描述输入框 */}
          {effectiveCharacterRefImage && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--background-tertiary)] p-3 flex-shrink-0">
              <h3 className="text-xs font-medium text-[var(--foreground-muted)] mb-2">
                人物特征描述
              </h3>
              <p className="text-[10px] text-[var(--foreground-muted)] mb-2">
                用于生成图片时保持人物一致性，可手动修改
              </p>
              <textarea
                value={characterDescription}
                onChange={(e) => setCharacterDescription(e.target.value)}
                placeholder="点击下方按钮自动分析参考图中的人物特征，或手动输入..."
                className="input-field w-full text-xs resize-y min-h-[100px] mb-2"
              />
              <button
                type="button"
                disabled={charDescLoading}
                className="btn-secondary w-full flex items-center justify-center gap-1.5 text-xs"
                onClick={async () => {
                  const img = effectiveCharacterRefImage;
                  if (!img) return;
                  setCharDescLoading(true);
                  try {
                    const res = await fetch('/api/analyze-character', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ image: img }),
                    });
                    const data = await res.json();
                    if (res.ok && data.characterDescription) {
                      setCharacterDescription(data.characterDescription);
                    } else {
                      setErrorMessage(data.error || '人物特征分析失败');
                    }
                  } catch {
                    setErrorMessage('人物特征分析失败，请重试');
                  } finally {
                    setCharDescLoading(false);
                  }
                }}
              >
                {charDescLoading ? (
                  <>
                    <RefreshCw size={12} className="animate-spin" />
                    分析中...
                  </>
                ) : (
                  <>
                    <RefreshCw size={12} />
                    {characterDescription ? '重新分析人物特征' : '自动分析人物特征'}
                  </>
                )}
              </button>
            </div>
          )}

          {studioSceneImage && (
            <button
              type="button"
              className="block w-full rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--background-tertiary)] hover:ring-2 hover:ring-[var(--accent)] hover:ring-inset transition-shadow text-left"
              onClick={() => setPreviewImage({ src: studioSceneImage, alt: '录音棚场景' })}
            >
              <div className="aspect-video">
                <img src={studioSceneImage} alt="录音棚场景" className="w-full h-full object-cover" />
              </div>
              <span className="block text-xs text-[var(--foreground-muted)] px-2 py-1">录音棚模式场景</span>
            </button>
          )}

          {allGeneratedImages.length === 0 && !studioSceneImage ? (
            <p className="text-sm text-[var(--foreground-muted)] py-4">暂无生成图片</p>
          ) : allGeneratedImages.length > 0 ? (
            allGeneratedImages.map((item) => (
              <button
                key={item.id}
                type="button"
                className="block w-full rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--background-tertiary)] hover:ring-2 hover:ring-[var(--accent)] hover:ring-inset transition-shadow text-left"
                onClick={() => setPreviewImage({ src: item.url, alt: item.label })}
              >
                <div className="aspect-video">
                  <img src={item.url} alt={item.label} className="w-full h-full object-cover" />
                </div>
                <span className="block text-xs text-[var(--foreground-muted)] px-2 py-1">{item.label}</span>
              </button>
            ))
          ) : null}
        </div>
      </aside>

      {/* 右侧 75%：提示词栏 */}
      <main className="flex-1 min-w-0 overflow-y-auto space-y-8 py-2">
        {/* 五组场景拓展提示词：按钮在上，提示词在下 */}
        <div className="card">
        <h3 className="section-title flex items-center gap-2">
          <Film size={16} />
          主场景拓展（SCENECONTEST）— 五组提示词
        </h3>
        <p className="text-sm text-[var(--foreground-muted)] mb-4">
          22岁的年轻亚洲女子处在某种充满情绪、温柔暧昧的「状态」中，不做具体事；姿势、发型、穿着、与镜头的眼神可带含蓄与私密感，语气温和不露骨；脸微微侧或抬头低头，位置不必居中。
        </p>
        <p className="text-xs text-[var(--foreground-muted)] mb-2">
          连续生成多张场景图时，建议每张间隔约 30 秒，避免 API 限流导致第 2～5 组或爱欲现场生成失败；失败时会自动重试（约 3 秒、30 秒各一次）。
        </p>
        <button
          onClick={handleGenerateScenePrompts}
          disabled={!uploadedImage || scenePromptsLoading}
          className="btn-primary flex items-center gap-2 mb-6"
        >
          {scenePromptsLoading ? (
            <>
              <RefreshCw size={16} className="animate-spin" />
              生成中...
            </>
          ) : (
            <>
              <Film size={16} />
              根据【SCENECONTEST】生成五组主场景拓展提示词
            </>
          )}
        </button>
        <div className="space-y-4">
          {scenePrompts.map((item, index) => (
            <div key={item.id} className="border border-[var(--border)] rounded-lg p-4 bg-[var(--background-tertiary)]">
              <label className="text-xs text-[var(--foreground-muted)] block mb-2">第 {index + 1} 组</label>
              <div className="flex flex-wrap gap-2 mb-3">
                <button
                  onClick={() => handleRegenerateScenePrompt(index)}
                  disabled={regeneratingPromptId !== null}
                  className="btn-secondary flex items-center gap-1.5 text-sm"
                >
                  {regeneratingPromptId === item.id ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <RefreshCw size={14} />
                  )}
                  重新生成此条提示词
                </button>
                <button
                  onClick={() => handleGenerateSceneImage(item, index)}
                  disabled={loadingImageId !== null}
                  className="btn-secondary flex items-center gap-1.5 text-sm"
                >
                  {loadingImageId === item.id ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : null}
                  {item.imageUrl ? '重新生成 16:9 场景图' : '生成 16:9 场景图'}
                </button>
              </div>
              <textarea
                value={item.prompt}
                onChange={(e) => updateScenePrompt(item.id, e.target.value)}
                className="input-field w-full text-sm resize-y min-h-[80px]"
                placeholder="场景提示词（中文）"
              />
            </div>
          ))}
        </div>
      </div>

      {/* 爱欲现场 — 五组：按钮在上，提示词在下 */}
      <div className="card">
        <h3 className="section-title flex items-center gap-2">
          <Film size={16} />
          爱欲现场 — 五组提示词
        </h3>
        <p className="text-sm text-[var(--foreground-muted)] mb-4">
          与 SCENECONTEST 视觉风格相似，场景来自爱欲现场其它场景；22岁的年轻亚洲女子处在某种状态中，不做具体事；可与镜头直视、害羞微笑、捂脸羞涩笑且偷偷看镜头，或脸微微侧、抬头低头，位置不必居中。
        </p>
        <button
          onClick={handleGenerateDesirePrompts}
          disabled={!generatedStory?.trim() || desirePromptsLoading}
          className="btn-primary flex items-center gap-2 mb-6"
        >
          {desirePromptsLoading ? (
            <>
              <RefreshCw size={16} className="animate-spin" />
              生成中...
            </>
          ) : (
            <>
              <Film size={16} />
              根据「爱欲现场」生成五组提示词
            </>
          )}
        </button>
        <div className="space-y-4">
          {desireScenePrompts.map((item, index) => (
            <div key={item.id} className="border border-[var(--border)] rounded-lg p-4 bg-[var(--background-tertiary)]">
              <label className="text-xs text-[var(--foreground-muted)] block mb-2">第 {index + 1} 组</label>
              <div className="flex flex-wrap gap-2 mb-3">
                <button
                  onClick={() => handleRegenerateDesirePrompt(index)}
                  disabled={regeneratingPromptId !== null}
                  className="btn-secondary flex items-center gap-1.5 text-sm"
                >
                  {regeneratingPromptId === item.id ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <RefreshCw size={14} />
                  )}
                  重新生成此条提示词
                </button>
                <button
                  onClick={() => handleGenerateDesireImage(item, index)}
                  disabled={loadingImageId !== null}
                  className="btn-secondary flex items-center gap-1.5 text-sm"
                >
                  {loadingImageId === item.id ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : null}
                  {item.imageUrl ? '重新生成 16:9 场景图' : '生成 16:9 场景图'}
                </button>
              </div>
              <textarea
                value={item.prompt}
                onChange={(e) => updateDesirePrompt(item.id, e.target.value)}
                className="input-field w-full text-sm resize-y min-h-[80px]"
                placeholder="场景提示词（中文）"
              />
            </div>
          ))}
        </div>
      </div>

        {/* 录音棚模式：三种方式生成场景图 */}
        <div className="card">
          <h3 className="section-title flex items-center gap-2">录音棚模式</h3>
          <p className="text-sm text-[var(--foreground-muted)] mb-4">
            选择一种方式，由大模型生成提示词并生成 16:9 场景图（中景）
          </p>
          <div className="space-y-3 mb-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="studioMode"
                checked={studioMode === 1}
                onChange={() => setStudioMode(1)}
                className="mt-1"
              />
              <span className="text-sm"><strong>1. 录音棚</strong> — 人物身穿符合录音棚环境的服饰、发型、妆面，头戴专业耳机，在录音棚中录制歌曲的中景画面。</span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="studioMode"
                checked={studioMode === 2}
                onChange={() => setStudioMode(2)}
                className="mt-1"
              />
              <span className="text-sm"><strong>2. 原图生成</strong> — 参考图中场景、人物、服装均不变，人物在唱歌的中景画面，情绪符合歌词。</span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="studioMode"
                checked={studioMode === 3}
                onChange={() => setStudioMode(3)}
                className="mt-1"
              />
              <span className="text-sm"><strong>3. 用户输入场景</strong> — 人物身穿符合歌词气质的服饰/发型/妆面，在您输入的场景中唱歌的中景画面，情绪符合歌词。</span>
            </label>
          </div>
          {studioMode === 3 && (
            <div className="mb-4">
              <label className="text-xs text-[var(--foreground-muted)] block mb-1">输入场景描述</label>
              <input
                type="text"
                value={studioUserScene}
                onChange={(e) => setStudioUserScene(e.target.value)}
                placeholder="例如：海边黄昏、咖啡馆、卧室窗边..."
                className="input-field w-full text-sm"
              />
            </div>
          )}
          <button
            onClick={handleGenerateStudioScene}
            disabled={!effectiveCharacterRefImage || studioSceneLoading}
            className="btn-primary flex items-center gap-2"
          >
            {studioSceneLoading ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Film size={16} />
                生成场景图
              </>
            )}
          </button>
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
