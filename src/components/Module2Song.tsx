'use client';

import { useState, useRef, useCallback } from 'react';
import { useAppStore } from '@/store/appStore';
import { useShallow } from 'zustand/react/shallow';
import { RefreshCw, Check, BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import EditableField from './EditableField';
import CopyButton from './CopyButton';

export default function Module2Song() {
  const {
    promptVersions,
    selectedVersion,
    finalSelectedVersion,
    fullContext,
    generatedStory,
    setSelectedVersion,
    setFinalSelectedVersion,
    addPromptVersion,
    setGeneratedStory,
    setGeneratedStorySegments,
    setGeneratedStoryOtherScene,
    unlockModule,
    setCurrentModule,
  } = useAppStore(
    useShallow((s) => ({
      promptVersions: s.promptVersions,
      selectedVersion: s.selectedVersion,
      finalSelectedVersion: s.finalSelectedVersion,
      fullContext: s.fullContext,
      generatedStory: s.generatedStory,
      setSelectedVersion: s.setSelectedVersion,
      setFinalSelectedVersion: s.setFinalSelectedVersion,
      addPromptVersion: s.addPromptVersion,
      setGeneratedStory: s.setGeneratedStory,
      setGeneratedStorySegments: s.setGeneratedStorySegments,
      setGeneratedStoryOtherScene: s.setGeneratedStoryOtherScene,
      unlockModule: s.unlockModule,
      setCurrentModule: s.setCurrentModule,
    }))
  );

  const [feedback, setFeedback] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);
  type EditableFieldKey = 'stylePrompt' | 'stylePromptCN' | 'lyrics' | 'lyricsCN';
  const [editableData, setEditableData] = useState<{
    stylePrompt: string;
    stylePromptCN: string;
    lyrics: string;
    lyricsCN: string;
  } | null>(null);

  // Get current version data
  const currentVersion = promptVersions.find(v => v.version === selectedVersion);
  const currentData = editableData || currentVersion?.data;

  // Parse filename info
  const parseFilename = (filename: string) => {
    const match = filename.match(/^(\d+)_(.+)_(\d{8})_(\d{4})_(V\d+)\.csv$/);
    if (match) {
      return {
        id: match[1],
        keyword: match[2],
        date: match[3],
        time: match[4],
        version: match[5],
      };
    }
    return null;
  };

  const filenameInfo = currentVersion ? parseFilename(currentVersion.filename) : null;

  // When version changes, reset editable data
  const handleVersionChange = (version: string) => {
    setSelectedVersion(version);
    setEditableData(null);
  };

  // Update editable field
  const updateField = (field: EditableFieldKey, value: string) => {
    if (!currentData) return;
    setEditableData({
      ...currentData,
      [field]: value,
    } as typeof editableData);
  };

  // Regenerate with feedback
  const handleRegenerate = async () => {
    if (!feedback.trim() || !currentVersion) {
      alert('请输入反馈内容');
      return;
    }

    setIsRegenerating(true);
    try {
      const response = await fetch('/api/regenerate-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          previousVersion: currentVersion,
          feedback: feedback,
        }),
      });

      if (!response.ok) throw new Error('Regeneration failed');

      const data = await response.json();
      addPromptVersion({
        ...data.version,
        keywordJa: currentVersion?.keywordJa,
        keywordCn: currentVersion?.keywordCn,
      });
      setFeedback('');
      setEditableData(null);
    } catch (error) {
      console.error('Regeneration error:', error);
      alert('重新生成失败，请重试');
    } finally {
      setIsRegenerating(false);
    }
  };

  // Generate story
  const handleGenerateStory = async () => {
    if (!finalSelectedVersion) {
      alert('请先选定最终版本');
      return;
    }

    const finalVersion = promptVersions.find(v => v.version === finalSelectedVersion);
    if (!finalVersion) return;

    setIsGeneratingStory(true);
    try {
      const response = await fetch('/api/generate-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullContext: fullContext,
          lyrics: finalVersion.data.lyrics,
        }),
      });

      if (!response.ok) throw new Error('Story generation failed');

      const data = await response.json();
      setGeneratedStory(data.story ?? '');
      setGeneratedStorySegments(Array.isArray(data.segments) ? data.segments : []);
      setGeneratedStoryOtherScene(data.otherScene ?? '');
      unlockModule(3);
    } catch (error) {
      console.error('Story generation error:', error);
      alert('故事生成失败，请重试');
    } finally {
      setIsGeneratingStory(false);
    }
  };

  // Version navigation
  const currentIndex = promptVersions.findIndex(v => v.version === selectedVersion);
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < promptVersions.length - 1;

  const lyricsScrollRef = useRef<HTMLTextAreaElement>(null);
  const lyricsCNScrollRef = useRef<HTMLTextAreaElement>(null);
  const syncScroll = useCallback((source: 'ja' | 'cn') => {
    const ja = lyricsScrollRef.current;
    const cn = lyricsCNScrollRef.current;
    if (!ja || !cn) return;
    if (source === 'ja') cn.scrollTop = ja.scrollTop;
    else ja.scrollTop = cn.scrollTop;
  }, []);

  if (promptVersions.length === 0) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <p className="text-[var(--foreground-muted)] mb-4">
            暂无提示词数据
          </p>
          <p className="text-sm text-[var(--foreground-muted)]">
            请先在「歌词创作」模块生成提示词
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-light mb-2">
          <span className="text-[var(--accent)]">02</span> 歌曲创作
        </h1>
        <p className="text-[var(--foreground-muted)] text-sm">
          查看和编辑生成的提示词，创作爱情故事
        </p>
      </div>

      {/* File Info */}
      {currentVersion && filenameInfo && (
        <div className="card">
          <h3 className="section-title">文件信息</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <div>
              <span className="text-[var(--foreground-muted)]">编号</span>
              <p className="font-mono">{filenameInfo.id}</p>
            </div>
            <div className="md:col-span-2 min-w-0">
              <span className="text-[var(--foreground-muted)]">关键词</span>
              <p className="break-words min-w-0">
                {currentVersion.keywordJa != null || currentVersion.keywordCn != null
                  ? [currentVersion.keywordJa, currentVersion.keywordCn].filter(Boolean).join(' · ')
                  : filenameInfo.keyword}
              </p>
            </div>
            <div>
              <span className="text-[var(--foreground-muted)]">日期</span>
              <p className="font-mono">{filenameInfo.date}</p>
            </div>
            <div>
              <span className="text-[var(--foreground-muted)]">时间</span>
              <p className="font-mono">{filenameInfo.time}</p>
            </div>
            <div>
              <span className="text-[var(--foreground-muted)]">版本</span>
              <p className="font-mono text-[var(--accent)]">{filenameInfo.version}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[var(--foreground-muted)] text-sm">完整文件名:</span>
            <code className="text-xs bg-[var(--background-tertiary)] px-2 py-1 rounded">
              {currentVersion.filename}
            </code>
            <CopyButton text={currentVersion.filename} />
          </div>
        </div>
      )}

      {/* Prompt Content */}
      {currentData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <EditableField
            label="风格提示词 [stylePrompt]"
            value={currentData.stylePrompt}
            onChange={(v) => updateField('stylePrompt', v)}
            multiline
            rows={4}
          />
          <EditableField
            label="风格提示词中文 [stylePromptCN]"
            value={currentData.stylePromptCN}
            onChange={(v) => updateField('stylePromptCN', v)}
            multiline
            rows={4}
          />
          {/* 歌词与中文翻译：同步滚动 */}
          <div className="card lg:col-span-2">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-[var(--accent)]">歌词 [lyrics]</label>
                  <CopyButton text={currentData.lyrics} />
                </div>
                <textarea
                  ref={lyricsScrollRef}
                  value={currentData.lyrics}
                  onChange={(e) => updateField('lyrics', e.target.value)}
                  onScroll={() => syncScroll('ja')}
                  className="input-field w-full resize-y min-h-[200px]"
                  placeholder="歌词原文"
                  rows={12}
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-[var(--accent)]">歌词中文翻译 [lyricsCN]</label>
                  <CopyButton text={currentData.lyricsCN} />
                </div>
                <textarea
                  ref={lyricsCNScrollRef}
                  value={currentData.lyricsCN}
                  onChange={(e) => updateField('lyricsCN', e.target.value)}
                  onScroll={() => syncScroll('cn')}
                  className="input-field w-full resize-y min-h-[200px]"
                  placeholder="中文翻译（与原文逐行对应）"
                  rows={12}
                />
              </div>
            </div>
            {/* 版本选择：放在歌词单元下方 */}
            <div className="mt-4 pt-4 border-t border-[var(--border)]">
              <h3 className="section-title mb-3">版本选择</h3>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => canGoPrev && handleVersionChange(promptVersions[currentIndex - 1].version)}
                  disabled={!canGoPrev}
                  className="btn-secondary p-2 disabled:opacity-30"
                  title="上一版本"
                >
                  <ChevronLeft size={16} />
                </button>
                {promptVersions.map((v) => (
                  <button
                    key={v.version}
                    onClick={() => handleVersionChange(v.version)}
                    className={`version-pill ${selectedVersion === v.version ? 'active' : ''} ${
                      finalSelectedVersion === v.version ? 'ring-2 ring-[var(--accent)]' : ''
                    }`}
                  >
                    {v.version}
                    {finalSelectedVersion === v.version && (
                      <Check size={12} className="ml-1" />
                    )}
                  </button>
                ))}
                <button
                  onClick={() => canGoNext && handleVersionChange(promptVersions[currentIndex + 1].version)}
                  disabled={!canGoNext}
                  className="btn-secondary p-2 disabled:opacity-30"
                  title="下一版本"
                >
                  <ChevronRight size={16} />
                </button>
                <button
                  onClick={() => setFinalSelectedVersion(selectedVersion)}
                  className="btn-secondary text-sm ml-2"
                >
                  <Check size={14} className="inline mr-1" />
                  选定此版本为最终版本
                </button>
                {finalSelectedVersion && (
                  <span className="text-sm text-[var(--accent)] ml-2">
                    已选定: {finalSelectedVersion}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Feedback & Regenerate */}
      <div className="card">
        <h3 className="section-title">反馈与重新生成</h3>
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          className="input-field mb-4"
          rows={4}
          placeholder="输入您对当前版本的修改建议，AI 将根据反馈重新生成..."
        />
        <button
          onClick={handleRegenerate}
          disabled={!feedback.trim() || isRegenerating}
          className="btn-primary flex items-center gap-2"
        >
          {isRegenerating ? (
            <>
              <div className="w-4 h-4 border-2 border-[var(--background)] border-t-transparent rounded-full animate-spin" />
              重新生成中...
            </>
          ) : (
            <>
              <RefreshCw size={16} />
              根据反馈重新生成
            </>
          )}
        </button>
      </div>

      {/* Desire Scene Generation */}
      <div className="card">
        <h3 className="section-title flex items-center gap-2">
          <BookOpen size={16} />
          爱欲现场生成
        </h3>
        <p className="text-sm text-[var(--foreground-muted)] mb-4">
          基于 [fullContext] 和最终选定版本的日文歌词，生成 5 段带编号、情节连续、情绪丰富、场景各异的女性视角私密情感场景（每段约 180 字）
        </p>
        
        <button
          onClick={handleGenerateStory}
          disabled={!finalSelectedVersion || isGeneratingStory}
          className="btn-primary flex items-center gap-2 mb-4"
        >
          {isGeneratingStory ? (
            <>
              <div className="w-4 h-4 border-2 border-[var(--background)] border-t-transparent rounded-full animate-spin" />
              生成中...
            </>
          ) : (
            <>
              <BookOpen size={16} />
              生成爱欲现场
            </>
          )}
        </button>

        {generatedStory && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-[var(--accent)]">生成的爱欲现场（5 段）</span>
              <CopyButton text={generatedStory} />
            </div>
            <textarea
              value={generatedStory}
              onChange={(e) => setGeneratedStory(e.target.value)}
              className="input-field"
              rows={16}
            />
          </div>
        )}

        {/* 爱欲现场生成后亮起：通往第三步 */}
        <div className="mt-4 pt-4 border-t border-[var(--border)] flex justify-center">
          <button
            type="button"
            onClick={() => { unlockModule(3); setCurrentModule(3); }}
            disabled={!generatedStory?.trim()}
            title={generatedStory?.trim() ? '跳转到分镜创作' : '请先生成爱欲现场'}
            className={`flex items-center gap-2 px-6 py-3 text-base rounded-lg transition-all ${
              !generatedStory?.trim()
                ? 'opacity-50 cursor-not-allowed bg-[var(--background-tertiary)] text-[var(--foreground-muted)] border border-[var(--border)]'
                : 'btn-primary'
            }`}
          >
            <ChevronRight size={18} />
            跳转至第三步
          </button>
        </div>
      </div>
    </div>
  );
}
