import { create } from 'zustand';

export interface PromptData {
  stylePrompt: string;
  stylePromptCN: string;
  lyrics: string;
  lyricsCN: string;
}

export interface PromptVersion {
  filename: string;
  version: string;
  data: PromptData;
  createdAt: string;
  /** 关键词日文（第一步所选） */
  keywordJa?: string;
  /** 关键词中文（第一步所选） */
  keywordCn?: string;
}

export interface KeywordItem {
  id: string;
  keyword: string;
  translation: string; // 第三列：中文翻译
}

export interface AppState {
  // Navigation
  currentModule: number;
  unlockedModules: number[];
  
  // Module 1: Lyrics Creation
  csvKeywords: KeywordItem[];
  selectedKeyword: KeywordItem | null;
  uploadedImage: string | null;
  /** 第一步分析得到：人物性别、发色、场景一句话描述 */
  characterGender: string;
  characterHairColor: string;
  sceneDescription: string;
  imageContext: string;
  fullContext: string;
  sceneContext: string; // 场景、光影、风格描述
  emptySceneImage: string | null;
  
  // Module 2: Song Creation
  promptVersions: PromptVersion[];
  selectedVersion: string | null;
  finalSelectedVersion: string | null;
  generatedStory: string;
  /** 第二步爱欲现场 5 段内容（与 story 对应），用于第三步爱欲现场五组提示词一一对应 */
  generatedStorySegments: string[];
  /** 第二步爱欲现场中生成的「另一日本场景」描述，用于第三步爱欲现场提示词 */
  generatedStoryOtherScene: string;
  /** 第二步歌曲创作：已生成歌曲列表 */
  generatedSongs: Array<{
    id: string;
    url: string;
    title: string;
    model: string;
    duration?: number;
    savedPath?: string;
    createdAt: string;
  }>;
  /** 第二步歌曲创作：用户选定的最终歌曲 ID */
  finalSongId: string | null;

  // Module 3: Storyboard Creation
  scenePrompts: Array<{ id: string; prompt: string; imageUrl: string | null; imageHistory?: string[] }>;
  desireScenePrompts: Array<{ id: string; prompt: string; imageUrl: string | null; imageHistory?: string[] }>;
  /** 第三步首次保存场景图时得到的目录（如 output/scene/002_xxx_20260204），第四步同目录保存 */
  step3OutputBaseDir: string | null;
  /** 第三步录音棚模式生成的场景图（默认 2K），第四步可用来生九宫格 */
  studioSceneImage: string | null;

  // 人物特征描述（由大模型分析参考图生成，用户可编辑，传入所有图片生成提示词）
  characterDescription: string;

  // Module 4: 人种（与人物参考图一起用于九宫格/2K 强调面部），第五步提示词前缀
  ethnicityOption: '亚洲女性' | '欧美女性' | '亚洲男性' | '欧美男性';
  /** 第四步产出：按来源分组，每组含场景图、接触表列表、每张接触表对应的 2K 图（按生成顺序），切换步骤时保留 */
  step4Groups: Array<{
    sourceId: string;
    sourceLabel: string;
    sourceImageUrl: string;
    sheets: Array<{
      contactImageUrl: string;
      savedDir: string;
      panel2KOrdered: Array<{ panelIndex: number; imageUrl: string }>;
    }>;
  }>;

  // Module 6: 已生成视频列表
  generatedVideos: Array<{
    videoUrl: string;
    savedPath?: string;
    sourceLabel: string;
    createdAt: string;
  }>;

  // Actions
  setCurrentModule: (module: number) => void;
  unlockModule: (module: number) => void;
  setCsvKeywords: (keywords: KeywordItem[]) => void;
  setSelectedKeyword: (keyword: KeywordItem | null) => void;
  setUploadedImage: (image: string | null) => void;
  setCharacterGender: (v: string) => void;
  setCharacterHairColor: (v: string) => void;
  setSceneDescription: (v: string) => void;
  setImageContext: (context: string) => void;
  setFullContext: (context: string) => void;
  setSceneContext: (context: string) => void;
  setEmptySceneImage: (image: string | null) => void;
  addPromptVersion: (version: PromptVersion) => void;
  setSelectedVersion: (version: string | null) => void;
  setFinalSelectedVersion: (version: string | null) => void;
  setGeneratedStory: (story: string) => void;
  setGeneratedStorySegments: (v: string[]) => void;
  setGeneratedStoryOtherScene: (v: string) => void;
  addGeneratedSong: (song: { id: string; url: string; title: string; model: string; duration?: number; savedPath?: string }) => void;
  setFinalSongId: (id: string | null) => void;
  setScenePrompts: (prompts: Array<{ id: string; prompt: string; imageUrl: string | null; imageHistory?: string[] }>) => void;
  setDesireScenePrompts: (prompts: Array<{ id: string; prompt: string; imageUrl: string | null; imageHistory?: string[] }>) => void;
  setStep3OutputBaseDir: (dir: string | null) => void;
  setStudioSceneImage: (image: string | null) => void;
  setCharacterDescription: (v: string) => void;
  setEthnicityOption: (v: '亚洲女性' | '欧美女性' | '亚洲男性' | '欧美男性') => void;
  setStep4Groups: (groups: AppState['step4Groups']) => void;
  addStep4ContactSheet: (sourceId: string, sourceLabel: string, sourceImageUrl: string, contactImageUrl: string, savedDir: string) => void;
  addStep4Panel2K: (sourceId: string, contactImageUrl: string, panelIndex: number, imageUrl: string) => void;
  /** 将 2K 大图作为新来源加入左侧栏，便于以其为基础继续生九宫格 */
  addStep4GroupSource: (sourceId: string, sourceLabel: string, sourceImageUrl: string) => void;
  addGeneratedVideo: (video: { videoUrl: string; savedPath?: string; sourceLabel: string }) => void;
  resetModule1: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Navigation
  currentModule: 1,
  unlockedModules: [1],
  
  // Module 1
  csvKeywords: [],
  selectedKeyword: null,
  uploadedImage: null,
  characterGender: '',
  characterHairColor: '',
  sceneDescription: '',
  imageContext: '',
  fullContext: '',
  sceneContext: '',
  emptySceneImage: null,
  
  // Module 2
  promptVersions: [],
  selectedVersion: null,
  finalSelectedVersion: null,
  generatedStory: '',
  generatedStorySegments: [],
  generatedStoryOtherScene: '',
  generatedSongs: [],
  finalSongId: null,

  // Module 3
  scenePrompts: [],
  desireScenePrompts: [],
  step3OutputBaseDir: null,
  studioSceneImage: null,

  // 人物特征描述
  characterDescription: '',

  // Module 4
  ethnicityOption: '亚洲女性',
  step4Groups: [],

  // Module 6
  generatedVideos: [],

  // Actions
  setCurrentModule: (module) => set({ currentModule: module }),
  unlockModule: (module) => set((state) => {
    if (state.unlockedModules.includes(module)) return state;
    return { unlockedModules: [...state.unlockedModules, module] };
  }),
  setCsvKeywords: (keywords) => set({ csvKeywords: keywords }),
  setSelectedKeyword: (keyword) => set({ selectedKeyword: keyword }),
  setUploadedImage: (image) => set({ uploadedImage: image }),
  setCharacterGender: (v) => set({ characterGender: v }),
  setCharacterHairColor: (v) => set({ characterHairColor: v }),
  setSceneDescription: (v) => set({ sceneDescription: v }),
  setImageContext: (context) => set({ imageContext: context }),
  setFullContext: (context) => set({ fullContext: context }),
  setSceneContext: (context) => set({ sceneContext: context }),
  setEmptySceneImage: (image) => set({ emptySceneImage: image }),
  addPromptVersion: (version) => set((state) => ({
    promptVersions: [...state.promptVersions, version],
    selectedVersion: version.version,
  })),
  setSelectedVersion: (version) => set({ selectedVersion: version }),
  setFinalSelectedVersion: (version) => set({ finalSelectedVersion: version }),
  setGeneratedStory: (story) => set({ generatedStory: story }),
  setGeneratedStorySegments: (v) => set({ generatedStorySegments: v }),
  setGeneratedStoryOtherScene: (v) => set({ generatedStoryOtherScene: v }),
  addGeneratedSong: (song) => set((state) => ({
    generatedSongs: [...state.generatedSongs, { ...song, createdAt: new Date().toISOString() }],
  })),
  setFinalSongId: (id) => set({ finalSongId: id }),
  setScenePrompts: (prompts) => set({ scenePrompts: prompts }),
  setDesireScenePrompts: (prompts) => set({ desireScenePrompts: prompts }),
  setStep3OutputBaseDir: (dir) => set({ step3OutputBaseDir: dir }),
  setStudioSceneImage: (image) => set({ studioSceneImage: image }),
  setCharacterDescription: (v) => set({ characterDescription: v }),
  setEthnicityOption: (v) => set({ ethnicityOption: v }),
  setStep4Groups: (groups) => set({ step4Groups: groups }),
  addStep4ContactSheet: (sourceId, sourceLabel, sourceImageUrl, contactImageUrl, savedDir) => set((state) => {
    const existing = state.step4Groups.find((x) => x.sourceId === sourceId);
    const newSheet = { contactImageUrl, savedDir, panel2KOrdered: [] as Array<{ panelIndex: number; imageUrl: string }> };
    if (existing) {
      // 去重：如果同一 contactImageUrl 已存在则跳过
      if (existing.sheets.some((s) => s.contactImageUrl === contactImageUrl)) {
        return state;
      }
      const groups = state.step4Groups.map((g) =>
        g.sourceId === sourceId ? { ...g, sheets: [...g.sheets, newSheet] } : g
      );
      return { step4Groups: groups };
    }
    return {
      step4Groups: [...state.step4Groups, { sourceId, sourceLabel, sourceImageUrl, sheets: [newSheet] }],
    };
  }),
  addStep4Panel2K: (sourceId, contactImageUrl, panelIndex, imageUrl) => set((state) => {
    const groups = state.step4Groups.map((g) => {
      if (g.sourceId !== sourceId) return g;
      const sheets = g.sheets.map((s) => {
        if (s.contactImageUrl !== contactImageUrl) return s;
        // 同格只保留一条：先去掉同 panelIndex 的旧项，再追加当前
        const withoutSamePanel = s.panel2KOrdered.filter((p) => p.panelIndex !== panelIndex);
        return { ...s, panel2KOrdered: [...withoutSamePanel, { panelIndex, imageUrl }] };
      });
      return { ...g, sheets };
    });
    return { step4Groups: groups };
  }),
  addStep4GroupSource: (sourceId, sourceLabel, sourceImageUrl) => set((state) => {
    if (state.step4Groups.some((g) => g.sourceId === sourceId)) return state;
    return {
      step4Groups: [...state.step4Groups, { sourceId, sourceLabel, sourceImageUrl, sheets: [] }],
    };
  }),
  addGeneratedVideo: (video) => set((state) => ({
    generatedVideos: [...state.generatedVideos, { ...video, createdAt: new Date().toISOString() }],
  })),
  resetModule1: () => set({
    csvKeywords: [],
    selectedKeyword: null,
    uploadedImage: null,
    characterGender: '',
    characterHairColor: '',
    sceneDescription: '',
    imageContext: '',
    fullContext: '',
    sceneContext: '',
    emptySceneImage: null,
  }),
}));
