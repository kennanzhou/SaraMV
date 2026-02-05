/**
 * 九宫格：一次请求生成一张含 9 格的接触表图；按格扩展为 2K 大图。
 * 使用 @google/genai 图片模型。
 */
import { GoogleGenAI } from '@google/genai';
import { readFile } from 'fs/promises';
import path from 'path';

async function getApiKey(): Promise<string> {
  try {
    const configPath = path.join(process.cwd(), 'config', 'settings.json');
    const content = await readFile(configPath, 'utf8');
    const settings = JSON.parse(content);
    return settings.geminiApiKey || process.env.GEMINI_API_KEY || '';
  } catch {
    return process.env.GEMINI_API_KEY || '';
  }
}

/** 9 格镜头类型描述（用于提示词） */
export const PANEL_DESCRIPTIONS: Record<number, string> = {
  1: '第1格 特长镜头 ELS：主体在广阔环境中显得渺小',
  2: '第2格 长镜头 LS：整个主体头到脚可见',
  3: '第3格 中景长镜头 MLS：膝盖以上或 3/4 视角',
  4: '第4格 中景 MS：腰部以上',
  5: '第5格 中景特写 MCU：胸部以上亲密近景',
  6: '第6格 特写 CU：面部或正面紧凑构图',
  7: '第7格 极特写 ECU：眼睛、手部等微距细节',
  8: '第8格 低角度 虫眼：从地面向上仰视',
  9: '第9格 高角度 鸟瞰：从上方俯视',
};

/** 九宫格提示词配置（可选，用于从 config 覆盖） */
export interface GridPromptOverrides {
  gridContactSheetPrompt: string;
  gridPanelDescriptions: string[];
  /** 特写九宫格：整体一段提示词，覆盖默认的 contactSheet + panel 描述 */
  gridCloseupPrompt?: string;
}

/** 人种选项，用于提示词中强调面部特征 */
export type EthnicityOption = '亚洲女性' | '欧美女性' | '亚洲男性' | '欧美男性';

/**
 * 一次请求：根据源图生成「一张图内含 9 格」的电影接触表。
 * 可选人物参考图 + 人种，提示中强调【人种】，严格按照参考图人物的所有面部特征。
 */
let lastGridContactSheetError: string | null = null;

export function getLastGridContactSheetError(): string | null {
  return lastGridContactSheetError;
}

export async function generateContactSheetImage(
  sourceImageDataUrl: string,
  overrides?: GridPromptOverrides,
  options?: { characterReferenceImage?: string; ethnicity?: EthnicityOption }
): Promise<string | null> {
  lastGridContactSheetError = null;
  const apiKey = await getApiKey();
  if (!apiKey) {
    lastGridContactSheetError = '未配置 Gemini API Key';
    return null;
  }

  const base64Match = sourceImageDataUrl.match(/^data:image\/\w+;base64,(.+)$/);
  const base64Data = base64Match ? base64Match[1] : sourceImageDataUrl;
  const mimeType = sourceImageDataUrl.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg';

  const closeupPrompt = overrides?.gridCloseupPrompt?.trim();
  const intro = overrides?.gridContactSheetPrompt ?? null;
  const lines = overrides?.gridPanelDescriptions ?? null;
  let prompt: string;
  if (closeupPrompt) {
    prompt = closeupPrompt + '\n\n输出这一张包含 9 格的 16:9 接触表图片即可，镜头之间用黑色细线分割，保持影调与风格一致。';
  } else {
    prompt = intro && Array.isArray(lines) && lines.length >= 9
      ? intro + lines.map((line, i) => `${i + 1}: ${line}`).join('\n') + '\n\n输出这一张包含 9 格的接触表图片即可，保持影调与风格一致。'
      : '你是一位日本人像摄影师。根据附件中的参考图，生成「一张」电影接触表图片。\n\n' +
      '要求：这一张图必须是一幅完整的 3x3 网格图，包含 9 个画面格子（从左到右、从上到下编号 1–9）。\n' +
      '每个格子的镜头类型如下，同一人物、同一服装与照明在所有格中保持一致：\n' +
      '1: 特长镜头 ELS，主体在广阔环境中显得渺小\n' +
      '2: 长镜头 LS，整个主体头到脚可见\n' +
      '3: 中景长镜头 MLS，膝盖以上或 3/4 视角\n' +
      '4: 中景 MS，腰部以上\n' +
      '5: 中景特写 MCU，胸部以上亲密近景\n' +
      '6: 特写 CU，面部或正面紧凑构图\n' +
      '7: 极特写 ECU，眼睛、手部等微距细节\n' +
      '8: 低角度 虫眼，从地面向上仰视\n' +
      '9: 高角度 鸟瞰，从上方俯视\n\n' +
      '输出这一张包含 9 格的接触表图片即可，保持影调与风格一致。';
  }
  if (options?.characterReferenceImage && options?.ethnicity) {
    prompt += `\n\n重要：人物为【${options.ethnicity}】，严格按照参考图人物的所有面部特征（五官、脸型、肤色等）一致。`;
  }

  const contents: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    { text: prompt },
    { inlineData: { mimeType, data: base64Data } },
  ];
  if (options?.characterReferenceImage) {
    const refMatch = options.characterReferenceImage.match(/^data:image\/\w+;base64,(.+)$/);
    const refData = refMatch ? refMatch[1] : options.characterReferenceImage;
    const refMime = options.characterReferenceImage.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg';
    contents.push({ inlineData: { mimeType: refMime, data: refData } });
  }

  const ai = new GoogleGenAI({ apiKey });
  const modelIds = ['gemini-2.5-flash-image', 'gemini-3-pro-image-preview'];
  let lastError: unknown;

  for (const modelId of modelIds) {
    try {
      const response = await ai.models.generateContent({
        model: modelId,
        contents,
        config: {
          responseModalities: ['TEXT', 'IMAGE'] as string[],
          imageConfig: {
            aspectRatio: '16:9',
            imageSize: '1K',
          },
        },
      });

      const parts = response.candidates?.[0]?.content?.parts;
      if (Array.isArray(parts)) {
        // 取最后一个含图片的 part（Gemini 可能先返回文字再返回图）
        let lastImage: { mime: string; data: string } | null = null;
        for (const part of parts) {
          const blob = (part as { inlineData?: { mimeType?: string; data?: string } })?.inlineData;
          if (blob?.data) lastImage = { mime: blob.mimeType || 'image/png', data: blob.data };
        }
        if (lastImage) return `data:${lastImage.mime};base64,${lastImage.data}`;
      }
      const feedback = (response as { promptFeedback?: { blockReason?: string } })?.promptFeedback;
      if (feedback?.blockReason) {
        lastError = new Error(`内容被过滤: ${feedback.blockReason}`);
      } else if (!lastError) {
        lastError = new Error('API 未返回图片，可能被限流或内容策略拦截');
      }
    } catch (e) {
      lastError = e;
      console.warn(`Contact sheet with model ${modelId} failed:`, e);
      continue;
    }
  }

  // 可能是速率限制：先等 3 秒重试一次
  await new Promise((r) => setTimeout(r, 3000));
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents,
      config: {
        responseModalities: ['TEXT', 'IMAGE'] as string[],
        imageConfig: { aspectRatio: '16:9', imageSize: '1K' },
      },
    });
    const parts = response.candidates?.[0]?.content?.parts;
    if (Array.isArray(parts)) {
      let lastImage: { mime: string; data: string } | null = null;
      for (const part of parts) {
        const blob = (part as { inlineData?: { mimeType?: string; data?: string } })?.inlineData;
        if (blob?.data) lastImage = { mime: blob.mimeType || 'image/png', data: blob.data };
      }
      if (lastImage) return `data:${lastImage.mime};base64,${lastImage.data}`;
    }
    const feedback = (response as { promptFeedback?: { blockReason?: string } })?.promptFeedback;
    if (feedback?.blockReason) lastError = new Error(`内容被过滤: ${feedback.blockReason}`);
  } catch (retryErr) {
    console.warn('Contact sheet retry failed:', retryErr);
  }

  // 仍失败则再等 30 秒重试一次（应对严格限流）
  await new Promise((r) => setTimeout(r, 30000));
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents,
      config: {
        responseModalities: ['TEXT', 'IMAGE'] as string[],
        imageConfig: { aspectRatio: '16:9', imageSize: '1K' },
      },
    });
    const parts = response.candidates?.[0]?.content?.parts;
    if (Array.isArray(parts)) {
      let lastImage: { mime: string; data: string } | null = null;
      for (const part of parts) {
        const blob = (part as { inlineData?: { mimeType?: string; data?: string } })?.inlineData;
        if (blob?.data) lastImage = { mime: blob.mimeType || 'image/png', data: blob.data };
      }
      if (lastImage) return `data:${lastImage.mime};base64,${lastImage.data}`;
    }
  } catch (retry2Err) {
    console.warn('Contact sheet retry2 failed:', retry2Err);
  }

  lastGridContactSheetError = lastError instanceof Error ? lastError.message : String(lastError);
  console.error('Contact sheet image generation failed:', lastError);
  return null;
}

/** expandPanelTo2K 可选参数：人物参考图 + 人种 + 分辨率 + 辅助提示词 */
export interface ExpandPanelOptions {
  characterReferenceImage?: string;
  /** 人种，用于提示中强调【人种】，严格按照参考图人物的所有面部特征 */
  ethnicity?: EthnicityOption;
  /** 输出分辨率，默认 2K */
  imageSize?: '2K' | '4K';
  /** 用户输入的辅助提示词，会追加到生成提示中 */
  auxiliaryPrompt?: string;
}

/**
 * 根据接触表图 + 格编号（1–9），生成该格的 2K/4K 大图。
 * 若提供 characterReferenceImage，则要求生成图中人物面部与参考图一致。
 */
export async function expandPanelTo2K(
  contactSheetImageDataUrl: string,
  panelIndex: number,
  options?: ExpandPanelOptions
): Promise<string | null> {
  const apiKey = await getApiKey();
  if (!apiKey) return null;
  if (panelIndex < 1 || panelIndex > 9) return null;

  const size = options?.imageSize === '4K' ? '4K' : '2K';
  const base64Match = contactSheetImageDataUrl.match(/^data:image\/\w+;base64,(.+)$/);
  const base64Data = base64Match ? base64Match[1] : contactSheetImageDataUrl;
  const mimeType = contactSheetImageDataUrl.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg';

  const panelDesc = PANEL_DESCRIPTIONS[panelIndex];
  let prompt =
    `附件是一张 3x3 电影接触表（9 格，从左到右、从上到下编号 1–9）。\n\n` +
    `请仅根据「第 ${panelIndex} 格」的画面内容，生成一张独立的 ${size} 大图。\n` +
    `该格镜头类型：${panelDesc}。\n` +
    `要求：人物、服装、照明与接触表中该格一致，输出为一张完整的 ${size} 分辨率图片。`;
  if (options?.characterReferenceImage && options?.ethnicity) {
    prompt += `\n\n重要：人物为【${options.ethnicity}】，严格按照参考图人物的所有面部特征（五官、脸型、肤色等）一致。`;
  }
  if (options?.auxiliaryPrompt?.trim()) {
    prompt += `\n\n用户补充要求：${options.auxiliaryPrompt.trim()}`;
  }

  const contents: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    { text: prompt },
    { inlineData: { mimeType, data: base64Data } },
  ];
  if (options?.characterReferenceImage) {
    const refMatch = options.characterReferenceImage.match(/^data:image\/\w+;base64,(.+)$/);
    const refData = refMatch ? refMatch[1] : options.characterReferenceImage;
    const refMime = options.characterReferenceImage.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg';
    contents.push({ inlineData: { mimeType: refMime, data: refData } });
  }

  const ai = new GoogleGenAI({ apiKey });
  const modelIds = ['gemini-2.5-flash-image', 'gemini-3-pro-image-preview'];
  let lastError: unknown;

  for (const modelId of modelIds) {
    try {
      const response = await ai.models.generateContent({
        model: modelId,
        contents,
        config: {
          responseModalities: ['TEXT', 'IMAGE'] as string[],
          imageConfig: {
            aspectRatio: '16:9',
            imageSize: size,
          },
        },
      });

      const parts = response.candidates?.[0]?.content?.parts;
      if (Array.isArray(parts)) {
        let lastImage: { mime: string; data: string } | null = null;
        for (const part of parts) {
          const blob = (part as { inlineData?: { mimeType?: string; data?: string } })?.inlineData;
          if (blob?.data) lastImage = { mime: blob.mimeType || 'image/png', data: blob.data };
        }
        if (lastImage) return `data:${lastImage.mime};base64,${lastImage.data}`;
      }
    } catch (e) {
      lastError = e;
      console.warn(`Expand panel to 2K with model ${modelId} failed:`, e);
      continue;
    }
  }

  console.error('Expand panel to 2K failed:', lastError);
  return null;
}
