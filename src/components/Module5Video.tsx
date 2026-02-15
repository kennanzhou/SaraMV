'use client';

import { useState, useMemo } from 'react';
import { PlayCircle, ImageIcon, Upload, AlertCircle, Sparkles, RefreshCw } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useShallow } from 'zustand/react/shallow';
import ErrorToast from './ErrorToast';

const ETHNICITY_OPTIONS = ['亚洲女性', '欧美女性', '亚洲男性', '欧美男性'] as const;

export default function Module5Video() {
  const {
    step4Groups,
    ethnicityOption,
    setEthnicityOption,
    step3OutputBaseDir,
    addGeneratedVideo,
    unlockModule,
    emptySceneImage,
    studioSceneImage,
    scenePrompts,
    desireScenePrompts,
    uploadedImage,
    characterDescription,
    faceSwappedImages,
    addFaceSwappedImage,
  } = useAppStore(
    useShallow((s) => ({
      step4Groups: s.step4Groups,
      ethnicityOption: s.ethnicityOption,
      setEthnicityOption: s.setEthnicityOption,
      step3OutputBaseDir: s.step3OutputBaseDir,
      addGeneratedVideo: s.addGeneratedVideo,
      unlockModule: s.unlockModule,
      emptySceneImage: s.emptySceneImage,
      studioSceneImage: s.studioSceneImage,
      scenePrompts: s.scenePrompts,
      desireScenePrompts: s.desireScenePrompts,
      uploadedImage: s.uploadedImage,
      characterDescription: s.characterDescription,
      faceSwappedImages: s.faceSwappedImages,
      addFaceSwappedImage: s.addFaceSwappedImage,
    }))
  );
  const [selectedImage, setSelectedImage] = useState<{ url: string; label: string } | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [needPublicUrlWarning, setNeedPublicUrlWarning] = useState(false);
  /** 动作描述，默认"升格" */
  const [actionPrompt, setActionPrompt] = useState('升格');
  const [resolution, setResolution] = useState<'720p' | '1080p'>('720p');
  const [duration, setDuration] = useState(10);
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1' | '4:3'>('16:9');
  const [videoLoading, setVideoLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [faceSwapLoadingUrl, setFaceSwapLoadingUrl] = useState<string | null>(null);

  const effectiveCharacterRefImage = uploadedImage ?? null;

  const handleFaceSwap = async (imageUrl: string, label: string) => {
    const refImage = effectiveCharacterRefImage;
    if (!refImage) {
      setErrorMessage('请先在第二步上传人物参考图');
      return;
    }
    setFaceSwapLoadingUrl(imageUrl);
    try {
      const res = await fetch('/api/face-swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceImage: imageUrl,
          referenceImage: refImage,
          characterDescription: characterDescription || undefined,
          step3OutputBaseDir: step3OutputBaseDir ?? undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || '洗脸失败');
      if (data.imageUrl) {
        addFaceSwappedImage(imageUrl, data.imageUrl, `${label}（洗脸）`);
      }
    } catch (e) {
      console.error(e);
      setErrorMessage(e instanceof Error ? e.message : '洗脸生成失败，请重试');
    } finally {
      setFaceSwapLoadingUrl(null);
    }
  };

  const ethnicityPrefix = `【${ethnicityOption}】，严格按照参考图人物的所有面部特征。`;
  const fullPrompt = selectedImage ? `${ethnicityPrefix} ${actionPrompt}`.trim() : '';

  /** 左侧列表：第三步场景图 + 第四步 2K 图，URL 去重 */
  const leftListItems = useMemo(() => {
    const items: Array<{ url: string; label: string; section: 'scene' | '2k' }> = [];
    const seenUrls = new Set<string>();
    // 第三步场景图
    if (emptySceneImage && !seenUrls.has(emptySceneImage)) {
      seenUrls.add(emptySceneImage);
      items.push({ url: emptySceneImage, label: '空场景', section: 'scene' });
    }
    if (studioSceneImage && !seenUrls.has(studioSceneImage)) {
      seenUrls.add(studioSceneImage);
      items.push({ url: studioSceneImage, label: '录音棚场景', section: 'scene' });
    }
    scenePrompts.forEach((p, i) => {
      if (p.imageUrl && !seenUrls.has(p.imageUrl)) {
        seenUrls.add(p.imageUrl);
        items.push({ url: p.imageUrl, label: `场景 ${i + 1}`, section: 'scene' });
      }
    });
    desireScenePrompts.forEach((p, i) => {
      if (p.imageUrl && !seenUrls.has(p.imageUrl)) {
        seenUrls.add(p.imageUrl);
        items.push({ url: p.imageUrl, label: `爱欲场景 ${i + 1}`, section: 'scene' });
      }
    });
    // 第四步 2K 图
    step4Groups.forEach((g) => {
      g.sheets.forEach((s) => {
        s.panel2KOrdered.forEach((p) => {
          if (seenUrls.has(p.imageUrl)) return;
          seenUrls.add(p.imageUrl);
          items.push({
            url: p.imageUrl,
            label: `${g.sourceLabel} - 第${p.panelIndex}格 2K`,
            section: '2k',
          });
        });
      });
    });
    return items;
  }, [step4Groups, emptySceneImage, studioSceneImage, scenePrompts, desireScenePrompts]);

  const hasImages = leftListItems.length > 0;

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
      if (data.videoUrl) {
        addGeneratedVideo({
          videoUrl: data.videoUrl,
          savedPath: data.savedPath || undefined,
          sourceLabel: selectedImage?.label || '未知来源',
        });
        unlockModule(6);
      }
    } catch (e) {
      console.error(e);
      setErrorMessage(e instanceof Error ? e.message : '视频生成失败，请重试');
    } finally {
      setVideoLoading(false);
    }
  };

  if (!hasImages) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <PlayCircle size={48} className="mx-auto mb-4 text-[var(--foreground-muted)]" />
          <h2 className="text-xl font-light mb-2">
            <span className="text-[var(--accent)]">05</span> 视频生成
          </h2>
          <p className="text-[var(--foreground-muted)]">
            请先在第三步生成场景图或在第四步生成 2K 大图后，本页才会解锁
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-6rem)] min-h-[400px] gap-4 -m-2 p-0 relative">
      {/* 洗脸生成中全屏遮罩 */}
      {faceSwapLoadingUrl && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm" aria-hidden>
          <div className="flex flex-col items-center gap-4 text-[var(--foreground)]">
            <RefreshCw size={48} className="animate-spin text-[var(--accent)]" />
            <p className="text-sm">洗脸生成中，请勿操作...</p>
          </div>
        </div>
      )}
      {/* 左侧 25%：仅 2K 图列表 */}
      <aside className="w-1/4 min-w-[200px] flex flex-col border-r border-[var(--border)] pr-4 overflow-hidden">
        <div className="mb-3 flex-shrink-0">
          <h1 className="text-xl font-light">
            <span className="text-[var(--accent)]">05</span> 视频生成
          </h1>
          <p className="text-xs text-[var(--foreground-muted)] mt-1">
            选择一张图片，上传至图床后生成视频
          </p>
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-visible space-y-2 min-h-0 px-1">
          {leftListItems.length > 0 && leftListItems.some((i) => i.section === 'scene') && (
            <p className="text-[10px] text-[var(--foreground-muted)] font-medium uppercase tracking-wider pt-1">场景图</p>
          )}
          {leftListItems.filter((i) => i.section === 'scene').map((item, idx) => (
            <div key={`scene-${idx}-${item.url.slice(0, 30)}`} className="space-y-1">
              <div
                className={`rounded-lg overflow-hidden border text-left transition-shadow ${
                  selectedImage?.url === item.url
                    ? 'border-[var(--accent)] ring-2 ring-[var(--accent)] ring-inset'
                    : 'border-[var(--border)] hover:ring-2 hover:ring-[var(--accent)]/50 hover:ring-inset'
                }`}
              >
                <div className="relative aspect-video bg-[var(--background-tertiary)] group">
                  <div className="w-full h-full cursor-pointer" onClick={() => { setSelectedImage({ url: item.url, label: item.label }); setUploadedImageUrl(null); setNeedPublicUrlWarning(false); }}>
                    <img src={item.url} alt={item.label} className="w-full h-full object-cover" />
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleFaceSwap(item.url, item.label); }}
                    disabled={faceSwapLoadingUrl !== null}
                    className="absolute bottom-1.5 right-1.5 p-1.5 rounded-lg bg-purple-600/80 hover:bg-purple-500 text-white transition-colors disabled:opacity-50"
                    title="洗脸"
                  >
                    {faceSwapLoadingUrl === item.url ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={15} />}
                  </button>
                </div>
                <span className="block text-xs text-[var(--foreground-muted)] px-2 py-1 truncate">{item.label}</span>
              </div>
              {faceSwappedImages.filter((f) => f.sourceUrl === item.url).map((f) => (
                <div key={f.id} className={`rounded-lg overflow-hidden border text-left transition-shadow ml-2 ${selectedImage?.url === f.swappedUrl ? 'border-purple-400 ring-2 ring-purple-400 ring-inset' : 'border-purple-500/40 hover:ring-2 hover:ring-purple-400 hover:ring-inset'}`}>
                  <div className="relative aspect-video bg-[var(--background-tertiary)] group">
                    <div className="w-full h-full cursor-pointer" onClick={() => { setSelectedImage({ url: f.swappedUrl, label: f.label }); setUploadedImageUrl(null); setNeedPublicUrlWarning(false); }}>
                      <img src={f.swappedUrl} alt={f.label} className="w-full h-full object-cover" />
                    </div>
                    <button type="button" onClick={(e) => { e.stopPropagation(); handleFaceSwap(f.swappedUrl, f.label); }} disabled={faceSwapLoadingUrl !== null} className="absolute bottom-1.5 right-1.5 p-1.5 rounded-lg bg-purple-600/80 hover:bg-purple-500 text-white transition-colors disabled:opacity-50" title="洗脸">
                      {faceSwapLoadingUrl === f.swappedUrl ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={15} />}
                    </button>
                  </div>
                  <span className="block text-xs text-purple-400 px-2 py-1 truncate">{f.label}</span>
                </div>
              ))}
            </div>
          ))}
          {leftListItems.some((i) => i.section === '2k') && (
            <p className="text-[10px] text-[var(--foreground-muted)] font-medium uppercase tracking-wider pt-2">2K 大图</p>
          )}
          {leftListItems.filter((i) => i.section === '2k').map((item, idx) => (
            <div key={`2k-${idx}-${item.url.slice(0, 30)}`} className="space-y-1">
              <div
                className={`rounded-lg overflow-hidden border text-left transition-shadow ${
                  selectedImage?.url === item.url
                    ? 'border-[var(--accent)] ring-2 ring-[var(--accent)] ring-inset'
                    : 'border-[var(--border)] hover:ring-2 hover:ring-[var(--accent)]/50 hover:ring-inset'
                }`}
              >
                <div className="relative aspect-video bg-[var(--background-tertiary)] group">
                  <div className="w-full h-full cursor-pointer" onClick={() => { setSelectedImage({ url: item.url, label: item.label }); setUploadedImageUrl(null); setNeedPublicUrlWarning(false); }}>
                    <img src={item.url} alt={item.label} className="w-full h-full object-cover" />
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleFaceSwap(item.url, item.label); }}
                    disabled={faceSwapLoadingUrl !== null}
                    className="absolute bottom-1.5 right-1.5 p-1.5 rounded-lg bg-purple-600/80 hover:bg-purple-500 text-white transition-colors disabled:opacity-50"
                    title="洗脸"
                  >
                    {faceSwapLoadingUrl === item.url ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={15} />}
                  </button>
                </div>
                <span className="block text-xs text-[var(--foreground-muted)] px-2 py-1 truncate">{item.label}</span>
              </div>
              {faceSwappedImages.filter((f) => f.sourceUrl === item.url).map((f) => (
                <div key={f.id} className={`rounded-lg overflow-hidden border text-left transition-shadow ml-2 ${selectedImage?.url === f.swappedUrl ? 'border-purple-400 ring-2 ring-purple-400 ring-inset' : 'border-purple-500/40 hover:ring-2 hover:ring-purple-400 hover:ring-inset'}`}>
                  <div className="relative aspect-video bg-[var(--background-tertiary)] group">
                    <div className="w-full h-full cursor-pointer" onClick={() => { setSelectedImage({ url: f.swappedUrl, label: f.label }); setUploadedImageUrl(null); setNeedPublicUrlWarning(false); }}>
                      <img src={f.swappedUrl} alt={f.label} className="w-full h-full object-cover" />
                    </div>
                    <button type="button" onClick={(e) => { e.stopPropagation(); handleFaceSwap(f.swappedUrl, f.label); }} disabled={faceSwapLoadingUrl !== null} className="absolute bottom-1.5 right-1.5 p-1.5 rounded-lg bg-purple-600/80 hover:bg-purple-500 text-white transition-colors disabled:opacity-50" title="洗脸">
                      {faceSwapLoadingUrl === f.swappedUrl ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={15} />}
                    </button>
                  </div>
                  <span className="block text-xs text-purple-400 px-2 py-1 truncate">{f.label}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </aside>

      {/* 右侧 */}
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
                    生视频需要图片的公网地址，请先上传
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

            {/* 提示词：左右两栏 */}
            <div className="mb-4">
              <label className="text-sm text-[var(--foreground-muted)] block mb-2">提示词</label>
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-36">
                  <label className="text-[10px] text-[var(--foreground-muted)] block mb-1">人种</label>
                  <select
                    value={ethnicityOption}
                    onChange={(e) => setEthnicityOption(e.target.value as typeof ethnicityOption)}
                    className="input-field w-full text-sm py-2"
                  >
                    {ETHNICITY_OPTIONS.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-[var(--foreground-muted)] block mb-1">动作 / 风格</label>
                  <input
                    type="text"
                    value={actionPrompt}
                    onChange={(e) => setActionPrompt(e.target.value)}
                    placeholder="升格"
                    className="input-field w-full text-sm py-2"
                  />
                </div>
              </div>
              <p className="text-[10px] text-[var(--foreground-muted)] mt-1.5">
                完整提示词：{fullPrompt || '（请选择图片）'}
              </p>
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
              <p>请在左侧选择一张 2K 图片</p>
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
