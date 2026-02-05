/**
 * 提示词配置：音乐提示词模板、九宫格接触表/分格描述。
 * 配置存储在 config/prompts.json，缺失时使用下方默认值。
 */
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';

export interface PromptsConfig {
  /** 音乐提示词模板，占位符：{{context}} {{keywords}} {{fullContext}} */
  musicPromptTemplate: string;
  /** 九宫格：生成一张 3x3 接触表时的整体提示词前缀（可含角色与通用要求） */
  gridContactSheetPrompt: string;
  /** 九宫格 1–9 格镜头描述，与格编号对应 */
  gridPanelDescriptions: string[];
  /** 特写九宫格：整体提示词（日本私摄影师风格，光影/局部/静物 3x3） */
  gridCloseupPrompt: string;
}

const DEFAULT_MUSIC_TEMPLATE = `Role: 顶级 AI 音乐监制、意象派词人。
Task: 根据 Context 和 Keywords，创作 Suno/Mureka 音乐提示词，并提供中文翻译。

Context: {{context}}
Keywords: {{keywords}}
Full Context (文学性描述): {{fullContext}}

【Engine Rules 8.1】
1. Vocal Spectrum: 根据情境选择 Breathy, Smoky, Velvety 等性感声线。
2. Style Matrix: 必须具有电影感 (Cinematic, Atmospheric)。
3. Poetic Logic: 意象具体 (Show, Don't Tell)，感官化 (湿润、热度、气味)。
4. Lyrics Engineering: 
   - 歌词原文：日文为主，**必须押韵**；偶尔出现的英文也**必须押韵**（与相邻句或段内句尾形成押韵或音韵呼应）。
   - **日文押韵规则**：采用句尾单押（韵脚）。日文元音仅 a/i/u/e/o，句末音节元音相同即押韵（如 あ韵、た韵、る韵等）。每段内偶数句与偶数句、或句尾与句尾保持同一韵脚，避免呆板重复，可适当换韵。
   - **点缀英文**：在 Hook、副歌或句尾适当插入英文词/短语，该英文的尾音或节奏需与相邻日文句尾形成押韵或音韵呼应（如 night/光、touch/手等）。
   - **核心词汇（Keywords）必须出现在 Chorus 段落中**，且自然融入。
   - **严禁**在歌词原文中包含罗马音、翻译或括号注释。
   - 歌词必须分段 (Intro, Verse, Chorus...)。
   - 尺度：Sensual & Erotic (性感、露骨但艺术)。

【Output JSON Format】
必须输出纯 JSON 格式，不要包含 Markdown 代码块标记：
{
  "stylePrompt": "英文风格提示词",
  "stylePromptCN": "风格提示词的中文翻译",
  "lyrics": "歌词原文 (保留换行)",
  "lyricsCN": "歌词的中文翻译 (必须与原文逐行对应，保留换行和结构标记)"
}`;

const DEFAULT_GRID_CONTACT_SHEET =
  '你是一位日本人像摄影师。根据附件中的参考图，生成「一张」电影接触表图片。\n\n要求：这一张图必须是一幅完整的 3x3 网格图，包含 9 个画面格子（从左到右、从上到下编号 1–9）。\n每个格子的镜头类型如下，同一人物、同一服装与照明在所有格中保持一致：\n';

const DEFAULT_GRID_PANELS = [
  '第1格 特长镜头 ELS：主体在广阔环境中显得渺小',
  '第2格 长镜头 LS：整个主体头到脚可见',
  '第3格 中景长镜头 MLS：膝盖以上或 3/4 视角',
  '第4格 中景 MS：腰部以上',
  '第5格 中景特写 MCU：胸部以上亲密近景',
  '第6格 特写 CU：面部或正面紧凑构图',
  '第7格 极特写 ECU：眼睛、手部等微距细节',
  '第8格 低角度 虫眼：从地面向上仰视',
  '第9格 高角度 鸟瞰：从上方俯视',
];

const DEFAULT_GRID_CLOSEUP = `你是一个日本私摄影师，从师于川内伦子，或者奥山由之。善于捕捉光影、景物，女性的局部，和私密瞬间。

分析输入图像的整体构成。识别故事中的主要角色。

生成一个连贯的16:9比例的 3x3网格"电影接触表"，包含这9个独特的镜头，每个镜头都精确包含参考图中的某个静物、气氛光影、或者女性的局部。镜头之间用黑色的细线分割。

你必须根据内容调整标准的电影镜头类型，但是选择亲密的，或者充满爱意的角度。

第一行(建立背景):
1.环境空镜，这个环境中如果没有人的全景。
2.特写：环境中最具有美感的一个物品的特写
3.光影，捕捉这个环境中迷人的光影，女性可以在焦点之外。

第二行(核心覆盖范围):
4.特写，环境中存在的，空气中的灰尘、影子、或者水、风
5.大特写，图片中女性的嘴唇的大特写，以一种亲密的角度。
6.特写。图片中女性的锁骨

第三行(细节与角度):
7.特写镜头(ECU):女性的双眼，从旁观者的视角
8.低角度镜头拍摄女孩的美丽的足部、或者脚踝
9.女孩服装和身体之间接触的细节，或者女孩的手轻抚着画面中的某个物品。

确保严格一致性:同一人物/物体、相同服装和照明在所有画幅中保持一致。

所有画面均具有逼真的纹理、一致的电影色彩分级，并针对所分析的关键人物或物体进行正确的构图。`;

export const DEFAULT_PROMPTS: PromptsConfig = {
  musicPromptTemplate: DEFAULT_MUSIC_TEMPLATE,
  gridContactSheetPrompt: DEFAULT_GRID_CONTACT_SHEET,
  gridPanelDescriptions: [...DEFAULT_GRID_PANELS],
  gridCloseupPrompt: DEFAULT_GRID_CLOSEUP,
};

const CONFIG_PATH = path.join(process.cwd(), 'config', 'prompts.json');

export async function getPromptsConfig(): Promise<PromptsConfig> {
  try {
    const content = await readFile(CONFIG_PATH, 'utf8');
    const data = JSON.parse(content) as Partial<PromptsConfig>;
    return {
      musicPromptTemplate: data.musicPromptTemplate ?? DEFAULT_PROMPTS.musicPromptTemplate,
      gridContactSheetPrompt: data.gridContactSheetPrompt ?? DEFAULT_PROMPTS.gridContactSheetPrompt,
      gridPanelDescriptions: Array.isArray(data.gridPanelDescriptions) && data.gridPanelDescriptions.length >= 9
        ? data.gridPanelDescriptions.slice(0, 9)
        : [...DEFAULT_PROMPTS.gridPanelDescriptions],
      gridCloseupPrompt: data.gridCloseupPrompt ?? DEFAULT_PROMPTS.gridCloseupPrompt,
    };
  } catch {
    return { ...DEFAULT_PROMPTS };
  }
}

export async function savePromptsConfig(config: PromptsConfig): Promise<void> {
  await mkdir(path.dirname(CONFIG_PATH), { recursive: true });
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
}

/** 将音乐模板中的占位符替换为实际值 */
export function applyMusicTemplate(
  template: string,
  context: string,
  keywords: string,
  fullContext: string
): string {
  return template
    .replace(/\{\{context\}\}/g, context)
    .replace(/\{\{keywords\}\}/g, keywords)
    .replace(/\{\{fullContext\}\}/g, fullContext);
}
