'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, ScrollText, ChevronUp, ChevronDown, RefreshCw } from 'lucide-react';

interface LogEntry {
  timestamp: string;
  content: string;
}

interface DevLogProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DevLog({ isOpen, onClose }: DevLogProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load logs function
  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/devlog');
      if (response.ok) {
        const data = await response.json();
        console.log('Loaded logs:', data); // Debug
        setLogs(data.logs || []);
      } else {
        setError('加载失败: ' + response.status);
      }
    } catch (err) {
      console.error('Failed to load dev logs:', err);
      setError('加载失败');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load logs on mount and when opened
  useEffect(() => {
    if (isOpen) {
      loadLogs();
    }
  }, [isOpen, loadLogs]);

  if (!isOpen) return null;

  // Format timestamp for display
  const formatTimestamp = (ts: string) => {
    // YYYYMMDD_HHMM format
    if (ts.length === 13 && ts.includes('_')) {
      const date = ts.slice(0, 8);
      const time = ts.slice(9, 13);
      return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)} ${time.slice(0, 2)}:${time.slice(2, 4)}`;
    }
    return ts;
  };

  return (
    <div 
      className={`fixed left-16 bottom-0 z-40 transition-all duration-300 ${
        isMinimized ? 'h-12' : 'h-80'
      }`}
      style={{ width: 'calc(100% - 4rem)' }}
    >
      {/* Panel */}
      <div className="h-full bg-[var(--background-secondary)] border-t border-r border-[var(--border)] flex flex-col">
        {/* Header */}
        <div 
          className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)] cursor-pointer"
          onClick={() => setIsMinimized(!isMinimized)}
        >
          <div className="flex items-center gap-2">
            <ScrollText size={16} className="text-[var(--accent)]" />
            <span className="text-sm font-medium">开发日志</span>
            <span className="text-xs text-[var(--foreground-muted)]">
              ({logs.length} 条记录)
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                loadLogs();
              }}
              className="p-1 hover:bg-[var(--accent-glow)] rounded transition-colors"
              title="刷新"
            >
              <RefreshCw size={14} className={`text-[var(--foreground-muted)] ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsMinimized(!isMinimized);
              }}
              className="p-1 hover:bg-[var(--accent-glow)] rounded transition-colors"
            >
              {isMinimized ? (
                <ChevronUp size={16} className="text-[var(--foreground-muted)]" />
              ) : (
                <ChevronDown size={16} className="text-[var(--foreground-muted)]" />
              )}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="p-1 hover:bg-[var(--accent-glow)] rounded transition-colors"
            >
              <X size={16} className="text-[var(--foreground-muted)]" />
            </button>
          </div>
        </div>

        {/* Content */}
        {!isMinimized && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <p className="text-red-400 mb-2">{error}</p>
                <button onClick={loadLogs} className="btn-secondary text-xs">
                  重试
                </button>
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-[var(--foreground-muted)] mb-2">暂无日志记录</p>
                <button onClick={loadLogs} className="btn-secondary text-xs">
                  刷新
                </button>
              </div>
            ) : (
              <>
                <div className="text-xs text-[var(--foreground-muted)] mb-2">
                  共 {logs.length} 条记录
                </div>
                {logs.map((log, index) => (
                  <div 
                    key={`${log.timestamp}-${index}`}
                    className="bg-[var(--background-tertiary)] rounded-lg p-3 border border-[var(--border)]"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-mono text-[var(--accent)]">
                        {formatTimestamp(log.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--foreground)] whitespace-pre-wrap">
                      {log.content}
                    </p>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
