'use client';

import { useState, useEffect } from 'react';
import { X, Eye, EyeOff, Save, FolderOpen } from 'lucide-react';

interface SettingsConfig {
  geminiApiKey: string;
  promptOutputDir: string;
  grokApiKey: string;
  openaiApiKey: string;
  anthropicApiKey: string;
  sunoApiKey: string;
  murekaApiKey: string;
  runwayApiKey: string;
  pikaApiKey: string;
  ossRegion: string;
  ossAccessKeyId: string;
  ossAccessKeySecret: string;
  ossBucket: string;
  ossCustomDomain: string;
}

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const defaultSettings: SettingsConfig = {
  geminiApiKey: '',
  promptOutputDir: '',
  grokApiKey: '',
  openaiApiKey: '',
  anthropicApiKey: '',
  sunoApiKey: '',
  murekaApiKey: '',
  runwayApiKey: '',
  pikaApiKey: '',
  ossRegion: '',
  ossAccessKeyId: '',
  ossAccessKeySecret: '',
  ossBucket: '',
  ossCustomDomain: '',
};

export default function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const [settings, setSettings] = useState<SettingsConfig>(defaultSettings);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch('/api/settings');
        if (response.ok) {
          const data = await response.json();
          setSettings({ ...defaultSettings, ...data });
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    };
    
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus('idle');
    
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      
      if (response.ok) {
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } else {
        setSaveStatus('error');
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleShowKey = (key: string) => {
    setShowKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const updateSetting = (key: keyof SettingsConfig, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (!isOpen) return null;

  const apiGroups = [
    {
      title: '当前使用',
      description: '第一、二部分所需的 API 配置',
      items: [
        { key: 'geminiApiKey' as const, label: 'Gemini API Key', placeholder: '用于图片分析、歌词生成、故事创作', required: true },
        { key: 'promptOutputDir' as const, label: '提示词输出目录', placeholder: '留空则使用默认目录 (output/prompts)', isPath: true },
      ],
    },
    {
      title: '歌曲生成 (第二部分预留)',
      description: '音乐生成平台 API',
      items: [
        { key: 'sunoApiKey' as const, label: 'Suno API Key', placeholder: '用于 AI 音乐生成' },
        { key: 'murekaApiKey' as const, label: 'Mureka API Key', placeholder: '用于 AI 音乐生成' },
      ],
    },
    {
      title: '视频生成 (第五步 Grok)',
      description: 'xAI Grok 视频生成 API',
      items: [
        { key: 'grokApiKey' as const, label: 'Grok API Key', placeholder: '用于第五步 Grok 视频生成', required: false },
      ],
    },
    {
      title: '阿里云 OSS (第五步图片上传)',
      description: '第五步生成视频前，需将图片上传至公网图床。配置 OSS 后，图片将上传至阿里云，返回公网 URL 供 xAI 访问',
      items: [
        { key: 'ossRegion' as const, label: 'OSS Region', placeholder: '如 oss-cn-hangzhou、oss-cn-shanghai', isPath: true },
        { key: 'ossAccessKeyId' as const, label: 'OSS AccessKey ID', placeholder: '阿里云 AccessKey ID' },
        { key: 'ossAccessKeySecret' as const, label: 'OSS AccessKey Secret', placeholder: '阿里云 AccessKey Secret' },
        { key: 'ossBucket' as const, label: 'OSS Bucket', placeholder: '存储空间名称', isPath: true },
        { key: 'ossCustomDomain' as const, label: '自定义域名（可选）', placeholder: '如 https://cdn.example.com，留空使用 OSS 默认域名', isPath: true },
      ],
    },
    {
      title: '其他视频 (预留)',
      description: '视频生成平台 API',
      items: [
        { key: 'runwayApiKey' as const, label: 'Runway API Key', placeholder: '用于 AI 视频生成' },
        { key: 'pikaApiKey' as const, label: 'Pika API Key', placeholder: '用于 AI 视频生成' },
      ],
    },
    {
      title: '其他大模型 (预留)',
      description: '可用于未来扩展功能',
      items: [
        { key: 'openaiApiKey' as const, label: 'OpenAI API Key', placeholder: 'GPT-4 等模型' },
        { key: 'anthropicApiKey' as const, label: 'Anthropic API Key', placeholder: 'Claude 等模型' },
      ],
    },
  ];

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-[var(--background-secondary)] border-l border-[var(--border)] z-50 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
          <h2 className="text-xl font-light">
            <span className="text-[var(--accent)]">⚙</span> 设置
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--accent-glow)] rounded transition-colors"
          >
            <X size={20} className="text-[var(--foreground-muted)]" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {apiGroups.map((group) => (
            <div key={group.title}>
              <h3 className="section-title">{group.title}</h3>
              <p className="text-xs text-[var(--foreground-muted)] mb-4 -mt-2">
                {group.description}
              </p>
              
              <div className="space-y-4">
                {group.items.map((item) => (
                  <div key={item.key}>
                    <label className="text-sm text-[var(--foreground-muted)] mb-1.5 block flex items-center gap-2">
                      {item.label}
                      {'required' in item && item.required && (
                        <span className="text-[var(--accent)] text-xs">必填</span>
                      )}
                    </label>
                    <div className="relative">
                      <input
                        type={'isPath' in item && item.isPath ? 'text' : (showKeys[item.key] ? 'text' : 'password')}
                        value={settings[item.key]}
                        onChange={(e) => updateSetting(item.key, e.target.value)}
                        placeholder={item.placeholder}
                        className="input-field pr-10"
                      />
                      {!('isPath' in item && item.isPath) && (
                        <button
                          onClick={() => toggleShowKey(item.key)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--foreground-muted)] hover:text-[var(--accent)] transition-colors"
                        >
                          {showKeys[item.key] ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      )}
                      {'isPath' in item && item.isPath && (
                        <FolderOpen 
                          size={16} 
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--foreground-muted)]" 
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Info */}
          <div className="bg-[var(--background-tertiary)] rounded-lg p-4 text-sm">
            <p className="text-[var(--foreground-muted)]">
              <span className="text-[var(--accent)]">提示：</span>
              API Key 将安全地保存在本地配置文件中。请勿与他人分享您的 API Key。
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[var(--border)] bg-[var(--background)]">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-[var(--background)] border-t-transparent rounded-full animate-spin" />
                保存中...
              </>
            ) : saveStatus === 'success' ? (
              <>
                <span className="text-lg">✓</span>
                已保存
              </>
            ) : saveStatus === 'error' ? (
              <>
                <span className="text-lg">✗</span>
                保存失败
              </>
            ) : (
              <>
                <Save size={16} />
                保存设置
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
