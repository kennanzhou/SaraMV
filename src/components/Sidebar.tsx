'use client';

import { useState } from 'react';
import { 
  Mic2, 
  Music, 
  Film, 
  Video, 
  PlayCircle,
  Settings,
  ScrollText,
  FileEdit
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useShallow } from 'zustand/react/shallow';
import SettingsPanel from './SettingsPanel';
import DevLog from './DevLog';
import PromptEditPanel from './PromptEditPanel';

const modules = [
  { id: 1, icon: Mic2, label: '歌词创作' },
  { id: 2, icon: Music, label: '歌曲创作' },
  { id: 3, icon: Film, label: '分镜创作' },
  { id: 4, icon: Video, label: '分镜创作' },
  { id: 5, icon: PlayCircle, label: 'MV 创作' },
];

export default function Sidebar() {
  const { currentModule, unlockedModules, setCurrentModule, step4Groups } = useAppStore(
    useShallow((s) => ({
      currentModule: s.currentModule,
      unlockedModules: s.unlockedModules,
      setCurrentModule: s.setCurrentModule,
      step4Groups: s.step4Groups,
    }))
  );
  const hasStep4Output = step4Groups.some((g) => g.sheets.some((s) => s.panel2KOrdered.length > 0));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [devLogOpen, setDevLogOpen] = useState(false);
  const [promptEditOpen, setPromptEditOpen] = useState(false);

  return (
    <>
      <aside className="fixed left-0 top-0 h-full w-16 bg-[var(--background-secondary)] border-r-2 border-[var(--accent)]/30 flex flex-col items-center py-6 z-50">
        {/* Logo：玫瑰色渐变 + 发光，一眼能看出是新版 */}
        <div className="mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-dim)] flex items-center justify-center shadow-[0_0_24px_var(--accent-glow)] ring-2 ring-[var(--accent)]/20">
            <span className="text-[var(--background)] font-bold text-base">S</span>
          </div>
        </div>

        {/* Navigation Icons */}
        <nav className="flex flex-col gap-4 flex-1">
          {modules.map(({ id, icon: Icon, label }) => {
            const isActive = currentModule === id;
            const isUnlocked = id === 5 ? (unlockedModules.includes(id) || hasStep4Output) : unlockedModules.includes(id);

            return (
              <button
                key={id}
                onClick={() => isUnlocked && setCurrentModule(id)}
                className={`nav-icon group relative ${isActive ? 'active' : ''} ${!isUnlocked ? 'disabled' : ''}`}
                title={label}
                disabled={!isUnlocked}
              >
                <Icon size={20} strokeWidth={1.5} />
                
                {/* Tooltip */}
                <span className="absolute left-full ml-3 px-2 py-1 bg-[var(--background-tertiary)] text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-[var(--border)]">
                  {label}
                </span>

                {/* Active indicator */}
                {isActive && (
                  <span className="absolute -left-[1.125rem] w-1 h-6 bg-[var(--accent)] rounded-r" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="mt-auto flex flex-col items-center gap-4">
          {/* Prompt Edit button */}
          <button
            onClick={() => setPromptEditOpen(!promptEditOpen)}
            className={`nav-icon group relative ${promptEditOpen ? 'active' : ''}`}
            title="提示词编辑"
          >
            <FileEdit size={20} strokeWidth={1.5} />
            <span className="absolute left-full ml-3 px-2 py-1 bg-[var(--background-tertiary)] text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-[var(--border)]">
              提示词编辑
            </span>
          </button>

          {/* Dev Log button */}
          <button
            onClick={() => setDevLogOpen(!devLogOpen)}
            className={`nav-icon group relative ${devLogOpen ? 'active' : ''}`}
            title="开发日志"
          >
            <ScrollText size={20} strokeWidth={1.5} />
            
            {/* Tooltip */}
            <span className="absolute left-full ml-3 px-2 py-1 bg-[var(--background-tertiary)] text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-[var(--border)]">
              开发日志
            </span>
          </button>

          {/* Settings button */}
          <button
            onClick={() => setSettingsOpen(true)}
            className="nav-icon group relative"
            title="设置"
          >
            <Settings size={20} strokeWidth={1.5} />
            
            {/* Tooltip */}
            <span className="absolute left-full ml-3 px-2 py-1 bg-[var(--background-tertiary)] text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-[var(--border)]">
              设置
            </span>
          </button>

          {/* Studio indicator */}
          <div className="w-2 h-2 rounded-full bg-[var(--accent)] loading-pulse" />
        </div>
      </aside>

      {/* Settings Panel */}
      <SettingsPanel 
        isOpen={settingsOpen} 
        onClose={() => setSettingsOpen(false)} 
      />

      {/* Prompt Edit Panel */}
      <PromptEditPanel
        isOpen={promptEditOpen}
        onClose={() => setPromptEditOpen(false)}
      />

      {/* Dev Log Panel */}
      <DevLog
        isOpen={devLogOpen}
        onClose={() => setDevLogOpen(false)}
      />
    </>
  );
}
