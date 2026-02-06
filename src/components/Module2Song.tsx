'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useAppStore } from '@/store/appStore';
import { useShallow } from 'zustand/react/shallow';
import { RefreshCw, Check, BookOpen, ChevronLeft, ChevronRight, Music, Play, Pause, Star } from 'lucide-react';
import EditableField from './EditableField';
import CopyButton from './CopyButton';

export default function Module2Song() {
  const {
    promptVersions,
    selectedVersion,
    finalSelectedVersion,
    fullContext,
    generatedStory,
    generatedSongs,
    finalSongId,
    step3OutputBaseDir,
    setSelectedVersion,
    setFinalSelectedVersion,
    addPromptVersion,
    setGeneratedStory,
    setGeneratedStorySegments,
    setGeneratedStoryOtherScene,
    addGeneratedSong,
    setFinalSongId,
    unlockModule,
    setCurrentModule,
  } = useAppStore(
    useShallow((s) => ({
      promptVersions: s.promptVersions,
      selectedVersion: s.selectedVersion,
      finalSelectedVersion: s.finalSelectedVersion,
      fullContext: s.fullContext,
      generatedStory: s.generatedStory,
      generatedSongs: s.generatedSongs,
      finalSongId: s.finalSongId,
      step3OutputBaseDir: s.step3OutputBaseDir,
      setSelectedVersion: s.setSelectedVersion,
      setFinalSelectedVersion: s.setFinalSelectedVersion,
      addPromptVersion: s.addPromptVersion,
      setGeneratedStory: s.setGeneratedStory,
      setGeneratedStorySegments: s.setGeneratedStorySegments,
      setGeneratedStoryOtherScene: s.setGeneratedStoryOtherScene,
      addGeneratedSong: s.addGeneratedSong,
      setFinalSongId: s.setFinalSongId,
      unlockModule: s.unlockModule,
      setCurrentModule: s.setCurrentModule,
    }))
  );

  const [feedback, setFeedback] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);

  // 歌曲创作
  const [songModel, setSongModel] = useState<'V8' | 'O1'>('V8');
  const [isSongGenerating, setIsSongGenerating] = useState(false);
  const [songGeneratingStatus, setSongGeneratingStatus] = useState('');
  const [playingSongId, setPlayingSongId] = useState<string | null>(null);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);
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

  // 歌曲生成
  const handleGenerateSong = async () => {
    if (!finalSelectedVersion) {
      alert('请先选定最终版本');
      return;
    }
    const finalVersion = promptVersions.find(v => v.version === finalSelectedVersion);
    if (!finalVersion) return;

    setIsSongGenerating(true);
    setSongGeneratingStatus('提交生成任务...');
    try {
      // 1. 提交
      const submitRes = await fetch('/api/mureka-song', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lyrics: finalVersion.data.lyrics,
          stylePrompt: finalVersion.data.stylePrompt,
          model: songModel,
          title: finalVersion.keywordJa || finalVersion.keywordCn || undefined,
        }),
      });
      const submitData = await submitRes.json().catch(() => ({}));
      if (!submitRes.ok) throw new Error(submitData.error || '提交失败');

      // 处理同步完成（直接返回 songs）
      const addSongsToList = (songs: Array<{ url: string; title?: string; duration?: number; savedPath?: string }>, id: string) => {
        for (const song of songs) {
          addGeneratedSong({
            id: `${id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            url: song.url,
            title: song.title || '未命名',
            model: songModel,
            duration: song.duration,
            savedPath: song.savedPath,
          });
        }
      };

      if (submitData.status === 'completed' && submitData.songs?.length > 0) {
        addSongsToList(submitData.songs, submitData.taskId || 'sync');
        setSongGeneratingStatus('');
        setIsSongGenerating(false);
        return;
      }

      const taskId = submitData.taskId;
      if (!taskId) throw new Error('未返回 taskId，请检查 Mureka API Key 和网络连接');

      // 2. 轮询
      setSongGeneratingStatus('歌曲生成中（约 45 秒）...');
      const startTime = Date.now();
      const MAX_WAIT = 180_000; // 3 分钟

      while (Date.now() - startTime < MAX_WAIT) {
        await new Promise(r => setTimeout(r, 5000));

        const elapsed = Math.round((Date.now() - startTime) / 1000);
        setSongGeneratingStatus(`歌曲生成中... (${elapsed}s)`);

        const qp = new URLSearchParams({ taskId });
        if (step3OutputBaseDir) qp.set('step3OutputBaseDir', step3OutputBaseDir);
        // 传递关键词信息以便后端构建项目目录（与照片同目录）
        if (filenameInfo?.id) qp.set('keywordId', filenameInfo.id);
        if (filenameInfo?.keyword) qp.set('coreWord', filenameInfo.keyword);
        const pollRes = await fetch(`/api/mureka-song?${qp.toString()}`);
        const pollData = await pollRes.json().catch(() => ({}));

        if (pollData.status === 'completed' && pollData.songs?.length > 0) {
          addSongsToList(pollData.songs, taskId);
          setSongGeneratingStatus('');
          setIsSongGenerating(false);
          return;
        }
        if (pollData.status === 'failed') {
          throw new Error(pollData.message || 'Mureka 生成失败');
        }
      }
      throw new Error('生成超时，请稍后在任务列表中查看');
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : '歌曲生成失败');
    } finally {
      setIsSongGenerating(false);
      setSongGeneratingStatus('');
    }
  };

  const togglePlaySong = (songId: string, url: string) => {
    if (playingSongId === songId) {
      audioRef.current?.pause();
      setPlayingSongId(null);
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeEventListener('timeupdate', handleTimeUpdate);
      audioRef.current.removeEventListener('loadedmetadata', handleLoadedMeta);
    }
    const audio = new Audio(url);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMeta);
    audio.onended = () => {
      setPlayingSongId(null);
      setAudioCurrentTime(0);
    };
    audio.play().catch(() => {});
    audioRef.current = audio;
    setPlayingSongId(songId);
    setAudioCurrentTime(0);
    setAudioDuration(0);
  };

  const handleTimeUpdate = useCallback(() => {
    if (!isDragging && audioRef.current) {
      setAudioCurrentTime(audioRef.current.currentTime);
    }
  }, [isDragging]);

  const handleLoadedMeta = useCallback(() => {
    if (audioRef.current) {
      setAudioDuration(audioRef.current.duration);
    }
  }, []);

  // 清理 audio 事件
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeEventListener('timeupdate', handleTimeUpdate);
        audioRef.current.removeEventListener('loadedmetadata', handleLoadedMeta);
      }
    };
  }, [handleTimeUpdate, handleLoadedMeta]);

  const formatTime = (sec: number) => {
    if (!sec || !isFinite(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !audioDuration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audioRef.current.currentTime = ratio * audioDuration;
    setAudioCurrentTime(ratio * audioDuration);
  };

  const handleProgressDrag = useCallback((e: MouseEvent) => {
    if (!progressRef.current || !audioRef.current || !audioDuration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audioRef.current.currentTime = ratio * audioDuration;
    setAudioCurrentTime(ratio * audioDuration);
  }, [audioDuration]);

  const handleProgressDragEnd = useCallback(() => {
    setIsDragging(false);
    document.removeEventListener('mousemove', handleProgressDrag);
    document.removeEventListener('mouseup', handleProgressDragEnd);
  }, [handleProgressDrag]);

  const handleProgressDragStart = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    handleProgressClick(e);
    document.addEventListener('mousemove', handleProgressDrag);
    document.addEventListener('mouseup', handleProgressDragEnd);
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
            {/* 版本选择 + 反馈与重新生成：放在歌词单元下方同一行 */}
            <div className="mt-4 pt-4 border-t border-[var(--border)]">
              <div className="flex flex-wrap items-center gap-2">
                {/* 版本切换 */}
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
                  className="btn-secondary text-sm ml-1"
                >
                  <Check size={14} className="inline mr-1" />
                  选定最终版本
                </button>
                {finalSelectedVersion && (
                  <span className="text-sm text-[var(--accent)] ml-1">
                    已选定: {finalSelectedVersion}
                  </span>
                )}

                {/* 分隔符 */}
                <span className="hidden lg:inline text-[var(--border)] mx-1">|</span>

                {/* 反馈与重新生成 */}
                <div className="flex items-center gap-2 ml-auto">
                  <input
                    type="text"
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    className="input-field text-sm py-1.5 w-32 lg:w-44"
                    placeholder="修改建议..."
                    onKeyDown={(e) => { if (e.key === 'Enter' && feedback.trim()) handleRegenerate(); }}
                  />
                  <button
                    onClick={handleRegenerate}
                    disabled={!feedback.trim() || isRegenerating}
                    className="btn-secondary text-sm flex items-center gap-1 whitespace-nowrap"
                    title="根据反馈重新生成"
                  >
                    {isRegenerating ? (
                      <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <RefreshCw size={14} />
                    )}
                    重新生成
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Song Generation - Mureka */}
      <div className="card">
        <h3 className="section-title flex items-center gap-2">
          <Music size={16} />
          歌曲创作
        </h3>
        <p className="text-sm text-[var(--foreground-muted)] mb-4">
          基于风格提示词和歌词，调用 Mureka 大模型创作音乐（2:30-3:30 时长）
        </p>

        <div className="flex items-center gap-4 mb-4">
          <div>
            <label className="text-xs text-[var(--foreground-muted)] block mb-1">模型选择</label>
            <select
              value={songModel}
              onChange={(e) => setSongModel(e.target.value as 'V8' | 'O1')}
              className="input-field text-sm py-1.5 w-32"
              disabled={isSongGenerating}
            >
              <option value="V8">Mureka V8（默认）</option>
              <option value="O1">Mureka O1</option>
            </select>
          </div>
          <div className="flex-1" />
          <button
            onClick={handleGenerateSong}
            disabled={!finalSelectedVersion || isSongGenerating}
            className="btn-primary flex items-center gap-2"
          >
            {isSongGenerating ? (
              <>
                <span className="w-4 h-4 border-2 border-[var(--background)] border-t-transparent rounded-full animate-spin" />
                {songGeneratingStatus || '生成中...'}
              </>
            ) : (
              <>
                <Music size={16} />
                生成歌曲
              </>
            )}
          </button>
        </div>

        {!finalSelectedVersion && (
          <p className="text-xs text-amber-500 mb-3">请先在上方「版本选择」中选定最终版本</p>
        )}

        {/* 播放列表 */}
        {generatedSongs.length > 0 && (
          <div className="mt-4 border-t border-[var(--border)] pt-4">
            <h4 className="text-sm font-medium text-[var(--accent)] mb-3">
              播放列表（共 {generatedSongs.length} 首）
              {finalSongId && <span className="text-xs text-[var(--foreground-muted)] ml-2">已定稿</span>}
            </h4>
            <div className="space-y-2">
              {generatedSongs.map((song) => {
                const isPlaying = playingSongId === song.id;
                const progress = isPlaying && audioDuration > 0 ? (audioCurrentTime / audioDuration) * 100 : 0;
                return (
                  <div
                    key={song.id}
                    className={`rounded-lg border transition-all ${
                      finalSongId === song.id
                        ? 'border-[var(--accent)] bg-[var(--accent)]/10 ring-1 ring-[var(--accent)]'
                        : 'border-[var(--border)] bg-[var(--background-tertiary)] hover:border-[var(--accent)]/50'
                    }`}
                  >
                    <div className="flex items-center gap-3 px-3 pt-3 pb-1">
                      {/* 播放/暂停 */}
                      <button
                        type="button"
                        onClick={() => togglePlaySong(song.id, song.url)}
                        className="flex-shrink-0 w-9 h-9 rounded-full bg-[var(--accent)] text-[var(--background)] flex items-center justify-center hover:opacity-80 transition-opacity"
                      >
                        {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
                      </button>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">
                          {song.title}
                          <span className="text-[10px] text-[var(--foreground-muted)] ml-2">
                            {song.model} · {new Date(song.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </p>
                      </div>

                      {/* 定稿按钮 */}
                      <button
                        type="button"
                        onClick={() => setFinalSongId(finalSongId === song.id ? null : song.id)}
                        className={`flex-shrink-0 p-1.5 rounded transition-colors ${
                          finalSongId === song.id
                            ? 'text-[var(--accent)]'
                            : 'text-[var(--foreground-muted)] hover:text-[var(--accent)]'
                        }`}
                        title={finalSongId === song.id ? '取消定稿' : '选为定稿'}
                      >
                        <Star size={18} fill={finalSongId === song.id ? 'currentColor' : 'none'} />
                      </button>
                    </div>

                    {/* 时间轴进度条 */}
                    <div className="px-3 pb-3">
                      <div
                        ref={isPlaying ? progressRef : undefined}
                        className="group relative h-1.5 bg-[var(--border)] rounded-full cursor-pointer mt-1"
                        onClick={isPlaying ? handleProgressClick : () => togglePlaySong(song.id, song.url)}
                        onMouseDown={isPlaying ? handleProgressDragStart : undefined}
                      >
                        {/* 已播放进度 */}
                        <div
                          className="absolute top-0 left-0 h-full bg-[var(--accent)] rounded-full transition-[width] duration-100"
                          style={{ width: `${progress}%` }}
                        />
                        {/* 拖动手柄 */}
                        {isPlaying && (
                          <div
                            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-[var(--accent)] rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                            style={{ left: `calc(${progress}% - 6px)` }}
                          />
                        )}
                      </div>
                      {/* 时间显示 */}
                      <div className="flex justify-between mt-1">
                        <span className="text-[10px] text-[var(--foreground-muted)] font-mono">
                          {isPlaying ? formatTime(audioCurrentTime) : '0:00'}
                        </span>
                        <span className="text-[10px] text-[var(--foreground-muted)] font-mono">
                          {isPlaying && audioDuration > 0
                            ? formatTime(audioDuration)
                            : song.duration
                              ? formatTime(song.duration)
                              : '--:--'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
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
