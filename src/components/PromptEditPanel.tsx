'use client';

import { useState, useEffect } from 'react';
import { X, Save, RefreshCw, FileText, LayoutGrid } from 'lucide-react';
import type { PromptsConfig } from '@/app/lib/promptsConfig';

interface PromptEditPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabId = 'music' | 'grid';

export default function PromptEditPanel({ isOpen, onClose }: PromptEditPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('music');
  const [config, setConfig] = useState<PromptsConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const loadPrompts = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/prompts');
      if (res.ok) {
        const data = await res.json();
        setConfig({
          musicPromptTemplate: data.musicPromptTemplate ?? '',
          gridContactSheetPrompt: data.gridContactSheetPrompt ?? '',
          gridPanelDescriptions: Array.isArray(data.gridPanelDescriptions) ? data.gridPanelDescriptions : Array(9).fill(''),
          gridCloseupPrompt: data.gridCloseupPrompt ?? '',
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) loadPrompts();
  }, [isOpen]);

  const updateMusic = (value: string) => {
    setConfig((c) => (c ? { ...c, musicPromptTemplate: value } : c));
  };
  const updateGridIntro = (value: string) => {
    setConfig((c) => (c ? { ...c, gridContactSheetPrompt: value } : c));
  };
  const updatePanelDesc = (index: number, value: string) => {
    setConfig((c) => {
      if (!c) return c;
      const next = [...c.gridPanelDescriptions];
      next[index] = value;
      return { ...c, gridPanelDescriptions: next };
    });
  };
  const updateGridCloseup = (value: string) => {
    setConfig((c) => (c ? { ...c, gridCloseupPrompt: value } : c));
  };

  const handleSave = async () => {
    if (!config) return;
    setIsSaving(true);
    setSaveStatus('idle');
    try {
      const res = await fetch('/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } else setSaveStatus('error');
    } catch {
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-2xl bg-[var(--background-secondary)] border-l border-[var(--border)] z-50 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
          <h2 className="text-xl font-light">
            <span className="text-[var(--accent)]">📝</span> 提示词编辑
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-[var(--accent-glow)] rounded transition-colors">
            <X size={20} className="text-[var(--foreground-muted)]" />
          </button>
        </div>

        <div className="flex border-b border-[var(--border)] px-4">
          <button
            onClick={() => setActiveTab('music')}
            className={`flex items-center gap-2 px-4 py-3 text-sm border-b-2 transition-colors ${
              activeTab === 'music'
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
            }`}
          >
            <FileText size={18} />
            生成音乐提示词
          </button>
          <button
            onClick={() => setActiveTab('grid')}
            className={`flex items-center gap-2 px-4 py-3 text-sm border-b-2 transition-colors ${
              activeTab === 'grid'
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
            }`}
          >
            <LayoutGrid size={18} />
            生成九宫格
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw size={24} className="animate-spin text-[var(--foreground-muted)]" />
            </div>
          ) : config ? (
            <>
              {activeTab === 'music' && (
                <div>
                  <p className="text-xs text-[var(--foreground-muted)] mb-2">
                    占位符：<code className="bg-[var(--background-tertiary)] px-1 rounded">{'{{context}}'}</code>{' '}
                    <code className="bg-[var(--background-tertiary)] px-1 rounded">{'{{keywords}}'}</code>{' '}
                    <code className="bg-[var(--background-tertiary)] px-1 rounded">{'{{fullContext}}'}</code>
                  </p>
                  <textarea
                    value={config.musicPromptTemplate}
                    onChange={(e) => updateMusic(e.target.value)}
                    rows={20}
                    className="w-full input-field font-mono text-sm resize-y min-h-[320px]"
                    placeholder="音乐提示词模板"
                  />
                </div>
              )}
              {activeTab === 'grid' && (
                <div className="space-y-6">
                  <div>
                    <label className="text-sm text-[var(--foreground-muted)] mb-2 block">九宫格整体说明（接触表提示词前缀）</label>
                    <textarea
                      value={config.gridContactSheetPrompt}
                      onChange={(e) => updateGridIntro(e.target.value)}
                      rows={6}
                      className="w-full input-field text-sm resize-y"
                      placeholder="接触表生成时的角色与通用要求"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-[var(--foreground-muted)] mb-2 block">1–9 格镜头描述（每行一格）</label>
                    <div className="space-y-2">
                      {config.gridPanelDescriptions.map((desc, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-xs text-[var(--foreground-muted)] w-6">{i + 1}</span>
                          <input
                            value={desc}
                            onChange={(e) => updatePanelDesc(i, e.target.value)}
                            className="input-field flex-1 text-sm"
                            placeholder={`第 ${i + 1} 格描述`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-[var(--foreground-muted)] mb-2 block">特写九宫格（整体提示词，淡红色按钮使用）</label>
                    <textarea
                      value={config.gridCloseupPrompt}
                      onChange={(e) => updateGridCloseup(e.target.value)}
                      rows={16}
                      className="w-full input-field text-sm resize-y font-mono"
                      placeholder="日本私摄影师风格，光影/局部/静物 3x3 接触表"
                    />
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-[var(--foreground-muted)]">加载失败，请重试</p>
          )}
        </div>

        <div className="p-6 border-t border-[var(--border)] bg-[var(--background)] flex items-center gap-3">
          <button
            onClick={loadPrompts}
            disabled={isLoading}
            className="btn-secondary flex items-center gap-2"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            刷新
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !config}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-[var(--background)] border-t-transparent rounded-full animate-spin" />
                保存中...
              </>
            ) : saveStatus === 'success' ? (
              <>✓ 已保存</>
            ) : saveStatus === 'error' ? (
              <>✗ 保存失败</>
            ) : (
              <>
                <Save size={16} />
                保存
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
