'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Upload, ImageIcon, Sparkles, FileText, ChevronDown, Search, Volume2, ChevronRight } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useShallow } from 'zustand/react/shallow';
import type { KeywordItem } from '@/store/appStore';
import Papa from 'papaparse';
import EditableField from './EditableField';
import ErrorToast from './ErrorToast';
import { speakJapanese, stopSpeaking, initJapaneseVoice } from '@/utils/speechUtils';

export default function Module1Lyrics() {
  const {
    csvKeywords,
    selectedKeyword,
    uploadedImage,
    characterGender,
    characterHairColor,
    sceneDescription,
    imageContext,
    fullContext,
    sceneContext,
    promptVersions,
    setCsvKeywords,
    setSelectedKeyword,
    setUploadedImage,
    setCharacterGender,
    setCharacterHairColor,
    setSceneDescription,
    setImageContext,
    setFullContext,
    setSceneContext,
    setEmptySceneImage,
    addPromptVersion,
    unlockModule,
    setCurrentModule,
  } = useAppStore(
    useShallow((s) => ({
      csvKeywords: s.csvKeywords,
      selectedKeyword: s.selectedKeyword,
      uploadedImage: s.uploadedImage,
      characterGender: s.characterGender,
      characterHairColor: s.characterHairColor,
      sceneDescription: s.sceneDescription,
      imageContext: s.imageContext,
      fullContext: s.fullContext,
      sceneContext: s.sceneContext,
      promptVersions: s.promptVersions,
      setCsvKeywords: s.setCsvKeywords,
      setSelectedKeyword: s.setSelectedKeyword,
      setUploadedImage: s.setUploadedImage,
      setCharacterGender: s.setCharacterGender,
      setCharacterHairColor: s.setCharacterHairColor,
      setSceneDescription: s.setSceneDescription,
      setImageContext: s.setImageContext,
      setFullContext: s.setFullContext,
      setSceneContext: s.setSceneContext,
      setEmptySceneImage: s.setEmptySceneImage,
      addPromptVersion: s.addPromptVersion,
      unlockModule: s.unlockModule,
      setCurrentModule: s.setCurrentModule,
    }))
  );

  const [isProcessing, setIsProcessing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [csvDragActive, setCsvDragActive] = useState(false);
  const [imageDragActive, setImageDragActive] = useState(false);
  const [imageReady, setImageReady] = useState(false); // 图片已上传但未分析
  const [hoveredKeyword, setHoveredKeyword] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  const imageDragCountRef = useRef(0);
  const csvDragCountRef = useRef(0);

  // 写入开发日志（第一步用户输入等）
  const logToDevlog = useCallback(async (content: string) => {
    try {
      await fetch('/api/devlog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
    } catch (e) {
      console.warn('Devlog write failed:', e);
    }
  }, []);

  // 初始化日语语音
  useEffect(() => {
    initJapaneseVoice();
  }, []);

  // 处理悬停播放
  const handleKeywordHover = useCallback((keyword: string) => {
    setHoveredKeyword(keyword);
    // 清除之前的定时器
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
    }
    // 1秒后播放
    hoverTimerRef.current = setTimeout(() => {
      speakJapanese(keyword);
    }, 1000);
  }, []);

  const handleKeywordLeave = useCallback(() => {
    setHoveredKeyword(null);
    // 清除定时器
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    // 停止播放
    stopSpeaking();
  }, []);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
      }
    };
  }, []);

  // Handle CSV upload
  const handleCsvUpload = useCallback((file: File) => {
    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete: (results) => {
        const keywords: KeywordItem[] = [];
        const data = results.data as string[][];
        
        // 跳过表头行（如果第一行看起来像表头）
        const startIndex = data[0]?.[0]?.match(/^(id|编号|序号|ID)$/i) ? 1 : 0;
        
        data.slice(startIndex).forEach((row, index) => {
          // 第一列是编号(id)，第二列是关键词，第三列是中文翻译
          const id = row[0]?.trim() || String(index + 1).padStart(3, '0');
          const keyword = row[1]?.trim();
          const translation = row[2]?.trim() || ''; // 第三列：中文翻译
          
          if (keyword && keyword.length > 0) {
            keywords.push({ id: String(id), keyword, translation });
          }
        });
        setCsvKeywords(keywords);
        logToDevlog(`第一步：上传关键词表 ${file.name}，共 ${keywords.length} 条`);
      },
      error: (error) => {
        console.error('CSV parse error:', error);
        alert('CSV 解析失败，请检查文件格式');
      },
    });
  }, [setCsvKeywords, logToDevlog]);

  // 调用大模型分析图片（提取意境核心词与文学性描述）
  const runAnalyzeImage = useCallback(async (imageDataUrl: string) => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/analyze-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageDataUrl }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Image analysis failed');
      }
      const data = await response.json();
      setCharacterGender(data.characterGender || '');
      setCharacterHairColor(data.characterHairColor || '');
      setSceneDescription(data.sceneDescription || '');
      setImageContext(data.shortContext || '');
      setFullContext(data.fullContext || '');
      setSceneContext(data.sceneContext || '');
      setEmptySceneImage(data.emptySceneImage || null);
      setImageReady(false);
    } catch (error) {
      console.error('Image analysis error:', error);
      setErrorMessage('图片分析失败，请检查 API Key 设置后重试');
    } finally {
      setIsProcessing(false);
    }
  }, [setCharacterGender, setCharacterHairColor, setSceneDescription, setImageContext, setFullContext, setSceneContext, setEmptySceneImage]);

  // 上传参考图后立刻自动送往大模型分析
  const handleImageUpload = useCallback((file: File) => {
    logToDevlog(`第一步：上传参考图片 ${file.name}`);
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setUploadedImage(base64);
      setImageReady(true);
      setCharacterGender('');
      setCharacterHairColor('');
      setSceneDescription('');
      setImageContext('');
      setFullContext('');
      setSceneContext('');
      setEmptySceneImage(null);
      runAnalyzeImage(base64);
    };
    reader.readAsDataURL(file);
  }, [setUploadedImage, setCharacterGender, setCharacterHairColor, setSceneDescription, setImageContext, setFullContext, setSceneContext, setEmptySceneImage, runAnalyzeImage, logToDevlog]);

  // 手动重新分析（使用当前已上传的图片）
  const handleAnalyzeImage = async () => {
    if (!uploadedImage) {
      alert('请先上传图片');
      return;
    }
    await runAnalyzeImage(uploadedImage);
  };

  // Generate music prompt
  const handleGeneratePrompt = async () => {
    if (!selectedKeyword || !imageContext) {
      alert('请先选择关键词并分析参考图片');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch('/api/generate-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywords: selectedKeyword.keyword,
          keywordId: selectedKeyword.id,
          context: imageContext,
          fullContext: fullContext,
        }),
      });

      if (!response.ok) throw new Error('Prompt generation failed');

      const data = await response.json();
      addPromptVersion({
        ...data.version,
        keywordJa: selectedKeyword.keyword,
        keywordCn: selectedKeyword.translation ?? '',
      });
      unlockModule(2);
      logToDevlog(
        `第一步：生成音乐提示词，关键词 ${selectedKeyword.id}-${selectedKeyword.keyword}，意境核心词 ${imageContext?.slice(0, 30) ?? ''}...`
      );
    } catch (error) {
      console.error('Prompt generation error:', error);
      alert('提示词生成失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  };

  // Drag and drop handlers for CSV（用计数避免进入子元素时误触发 dragleave）
  const handleCsvDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    csvDragCountRef.current += 1;
    setCsvDragActive(true);
  };
  const handleCsvDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };
  const handleCsvDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    csvDragCountRef.current -= 1;
    if (csvDragCountRef.current <= 0) {
      csvDragCountRef.current = 0;
      setCsvDragActive(false);
    }
  };
  const handleCsvDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    csvDragCountRef.current = 0;
    setCsvDragActive(false);
    const files = e.dataTransfer.files;
    const file = files?.[0];
    if (file && (file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv' || file.type === 'application/csv')) {
      handleCsvUpload(file);
    }
  };

  // Drag and drop handlers for Image
  const handleImageDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    imageDragCountRef.current += 1;
    setImageDragActive(true);
  };
  const handleImageDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };
  const handleImageDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    imageDragCountRef.current -= 1;
    if (imageDragCountRef.current <= 0) {
      imageDragCountRef.current = 0;
      setImageDragActive(false);
    }
  };
  const handleImageDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    imageDragCountRef.current = 0;
    setImageDragActive(false);
    const files = e.dataTransfer.files;
    const file = files?.[0];
    if (file && file.type.startsWith('image/')) {
      handleImageUpload(file);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-light mb-2">
          <span className="text-[var(--accent)]">01</span> 歌词创作
        </h1>
        <p className="text-[var(--foreground-muted)] text-sm">
          上传素材，让 AI 为您生成音乐创作提示词
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Inputs（上：参考图片，下：关键词表格） */}
        <div className="space-y-6">
          {/* 参考图片（在上） */}
          <div className="card">
            <h3 className="section-title flex items-center gap-2">
              <ImageIcon size={16} />
              参考图片
            </h3>
            
            <div
              role="button"
              tabIndex={0}
              className={`upload-zone ${imageDragActive ? 'active' : ''}`}
              onDragEnter={handleImageDragEnter}
              onDragLeave={handleImageDragLeave}
              onDragOver={handleImageDragOver}
              onDrop={handleImageDrop}
              onClick={() => document.getElementById('image-input')?.click()}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && document.getElementById('image-input')?.click()}
            >
              {uploadedImage ? (
                <img 
                  src={uploadedImage} 
                  alt="Uploaded reference" 
                  className="max-h-48 mx-auto rounded"
                />
              ) : (
                <>
                  <ImageIcon className="mx-auto mb-3 text-[var(--foreground-muted)]" size={24} />
                  <p className="text-sm text-[var(--foreground-muted)]">
                    拖拽图片到此处，或点击上传
                  </p>
                </>
              )}
              <input
                id="image-input"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
              />
            </div>

            {/* 上传后自动分析；可手动重新分析 */}
            {uploadedImage && (
              <button
                onClick={handleAnalyzeImage}
                disabled={isProcessing}
                className="btn-secondary w-full mt-4 flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                    正在分析图片...
                  </>
                ) : (
                  <>
                    <Search size={16} />
                    {imageReady ? '分析图片' : '重新分析'}
                  </>
                )}
              </button>
            )}
          </div>

          {/* 关键词表格（在下） */}
          <div className="card">
            <h3 className="section-title flex items-center gap-2">
              <FileText size={16} />
              关键词表格
            </h3>
            
            <div
              role="button"
              tabIndex={0}
              className={`upload-zone ${csvDragActive ? 'active' : ''}`}
              onDragEnter={handleCsvDragEnter}
              onDragLeave={handleCsvDragLeave}
              onDragOver={handleCsvDragOver}
              onDrop={handleCsvDrop}
              onClick={() => document.getElementById('csv-input')?.click()}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && document.getElementById('csv-input')?.click()}
            >
              <Upload className="mx-auto mb-3 text-[var(--foreground-muted)]" size={24} />
              <p className="text-sm text-[var(--foreground-muted)]">
                拖拽 CSV 文件到此处，或点击上传
              </p>
              <p className="text-xs text-[var(--foreground-muted)] mt-1">
                格式：编号 | 关键词 | 中文翻译
              </p>
              <input
                id="csv-input"
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleCsvUpload(e.target.files[0])}
              />
            </div>

            {/* Keyword Selector */}
            {csvKeywords.length > 0 && (
              <div className="mt-4">
                <label className="text-sm text-[var(--foreground-muted)] mb-2 block">
                  选择核心词 ({csvKeywords.length} 个可选)
                </label>
                <div className="relative">
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="input-field flex items-center justify-between cursor-pointer"
                  >
                    <span className={selectedKeyword ? '' : 'text-[var(--foreground-muted)]'}>
                      {selectedKeyword 
                        ? `${selectedKeyword.id} - ${selectedKeyword.keyword}${selectedKeyword.translation ? ` (${selectedKeyword.translation})` : ''}`
                        : '请选择关键词...'}
                    </span>
                    <ChevronDown size={16} className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {dropdownOpen && (
                    <div 
                      className="absolute z-10 w-full mt-1 max-h-60 overflow-auto bg-[var(--background-tertiary)] border border-[var(--border)] rounded-lg shadow-xl"
                      onMouseLeave={handleKeywordLeave}
                    >
                      {csvKeywords.map((kw) => (
                        <button
                          key={kw.id}
                          onClick={() => {
                            setSelectedKeyword(kw);
                            setDropdownOpen(false);
                            handleKeywordLeave();
                            logToDevlog(`第一步：选择关键词 ${kw.id} - ${kw.keyword}${kw.translation ? ` (${kw.translation})` : ''}`);
                          }}
                          onMouseEnter={() => handleKeywordHover(kw.keyword)}
                          onMouseLeave={handleKeywordLeave}
                          className={`w-full px-4 py-2.5 text-left text-sm hover:bg-[var(--accent-glow)] hover:text-[var(--accent)] transition-colors border-b border-[var(--border)] last:border-b-0 ${
                            selectedKeyword?.id === kw.id ? 'text-[var(--accent)] bg-[var(--accent-glow)]' : ''
                          } ${hoveredKeyword === kw.keyword ? 'ring-1 ring-[var(--accent)]' : ''}`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-[var(--foreground-muted)] font-mono text-xs">{kw.id}</span>
                            <span className="font-medium">{kw.keyword}</span>
                            {hoveredKeyword === kw.keyword && (
                              <Volume2 size={12} className="text-[var(--accent)] animate-pulse" />
                            )}
                          </div>
                          {kw.translation && (
                            <div className="text-xs text-[var(--foreground-muted)] mt-0.5 ml-8">
                              {kw.translation}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Context Output */}
        <div className="space-y-6">
          {/* 人物与场景：单框内三行（性别、发色、场景），文字完整显示 */}
          <div className="card">
            <h3 className="section-title mb-3">人物与场景（由 AI 从图片提取）</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[var(--accent)] block mb-1">性别</label>
                <input
                  type="text"
                  value={characterGender}
                  onChange={(e) => setCharacterGender(e.target.value)}
                  className="input-field text-sm min-w-0 w-full break-words"
                  placeholder="如：女性、男性"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--accent)] block mb-1">发色</label>
                <input
                  type="text"
                  value={characterHairColor}
                  onChange={(e) => setCharacterHairColor(e.target.value)}
                  className="input-field text-sm min-w-0 w-full break-words"
                  placeholder="如：黑色长发、棕色短发"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--accent)] block mb-1">场景</label>
                <p className="text-[10px] text-[var(--foreground-muted)] mb-1">地点 · 氛围 · 风格（一句话）</p>
                <input
                  type="text"
                  value={sceneDescription}
                  onChange={(e) => setSceneDescription(e.target.value)}
                  className="input-field text-sm min-w-0 w-full break-words"
                  placeholder="一句话概括场景（约 20～50 字）"
                />
              </div>
            </div>
          </div>

          {/* Short Context */}
          <EditableField
            label="意境核心词 [context]"
            value={imageContext}
            onChange={setImageContext}
            placeholder="6 字以内，一句完整的话或一个词组（由 AI 从图片提取）"
          />

          {/* Full Context */}
          <EditableField
            label="文学性描述 [fullContext]"
            value={fullContext}
            onChange={setFullContext}
            multiline
            rows={8}
            placeholder="约300字的文学性描述，包含人物状态、环境光影、关键道具、场景风格..."
          />

          {/* Selected Keyword Display */}
          {selectedKeyword && (
            <div className="card">
              <h3 className="section-title">已选关键词 [keywords]</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="version-pill active">
                    {selectedKeyword.id}
                  </span>
                  <span className="text-lg font-medium">{selectedKeyword.keyword}</span>
                  {/* 日文发音按钮 */}
                  <button
                    onClick={() => speakJapanese(selectedKeyword.keyword)}
                    className="p-1.5 rounded hover:bg-[var(--accent-glow)] transition-colors group"
                    title="播放日文发音（年轻女声）"
                  >
                    <Volume2 size={16} className="text-[var(--foreground-muted)] group-hover:text-[var(--accent)]" />
                  </button>
                </div>
                {selectedKeyword.translation && (
                  <div className="text-[var(--foreground-muted)] text-sm ml-12">
                    中文翻译：{selectedKeyword.translation}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Generate Button + 跳转第二页 */}
      <div className="flex flex-wrap justify-center items-center gap-4 pt-6">
        <button
          onClick={handleGeneratePrompt}
          disabled={!selectedKeyword || !imageContext || isGenerating}
          className="btn-primary flex items-center gap-2 px-8 py-3 text-lg"
        >
          {isGenerating ? (
            <>
              <div className="w-5 h-5 border-2 border-[var(--background)] border-t-transparent rounded-full animate-spin" />
              生成音乐提示词
            </>
          ) : (
            <>
              <Sparkles size={20} />
              生成音乐提示词
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => { unlockModule(2); setCurrentModule(2); }}
          disabled={isGenerating || promptVersions.length === 0}
          title={promptVersions.length === 0 ? '请先完成音乐提示词创作' : '跳转到歌曲创作'}
          className={`flex items-center gap-2 px-6 py-3 text-base rounded-lg transition-all ${
            isGenerating || promptVersions.length === 0
              ? 'opacity-50 cursor-not-allowed bg-[var(--background-tertiary)] text-[var(--foreground-muted)] border border-[var(--border)]'
              : 'btn-primary'
          }`}
        >
          <ChevronRight size={18} />
          跳转至第二页
        </button>
      </div>

      {errorMessage && (
        <ErrorToast message={errorMessage} onClose={() => setErrorMessage(null)} />
      )}
    </div>
  );
}
