/**
 * 九宫格：一次请求生成一张含 9 格的接触表图；按格扩展为 2K 大图。
 * 使用 @google/genai 图片模型。
 */
import { GoogleGenAI } from '@google/genai';
import { readFile } from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { parseDataUrl, isValidBase64 } from './dataUrlUtils';

/**
 * 压缩参考图：将超大图片缩放到指定最大边长并转为 JPEG（质量 85），
 * 返回 base64 数据和 mimeType。
 * 如果图片已经较小，则原样返回。
 */
async function compressReferenceImage(
  base64Data: string,
  mimeType: string,
  maxDimension = 1536,
): Promise<{ data: string; mimeType: string }> {
  // 粗略估算原始文件大小（base64 → 字节 ≈ *0.75）
  const estimatedBytes = base64Data.length * 0.75;
  // 小于 1.5MB 不压缩
  if (estimatedBytes < 1.5 * 1024 * 1024) {
    return { data: base64Data, mimeType };
  }

  try {
    const inputBuffer = Buffer.from(base64Data, 'base64');
    const image = sharp(inputBuffer);
    const metadata = await image.metadata();

    const w = metadata.width ?? 0;
    const h = metadata.height ?? 0;

    // 如果尺寸在限制内且已经是 JPEG 且小于 2MB，不压缩
    if (w <= maxDimension && h <= maxDimension && mimeType === 'image/jpeg' && estimatedBytes < 2 * 1024 * 1024) {
      return { data: base64Data, mimeType };
    }

    const outputBuffer = await image
      .resize(maxDimension, maxDimension, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    const newBase64 = outputBuffer.toString('base64');
    console.log(`[compress] 参考图压缩: ${Math.round(estimatedBytes / 1024)}KB → ${Math.round(outputBuffer.length / 1024)}KB, ${w}x${h} → max${maxDimension}`);
    return { data: newBase64, mimeType: 'image/jpeg' };
  } catch (err) {
    console.warn('[compress] 压缩失败，使用原图:', err instanceof Error ? err.message : err);
    return { data: base64Data, mimeType };
  }
}

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
  5: '第5格 中景特写 MCU：肩部以上近景',
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

/** 判断错误是否为 400 INVALID_ARGUMENT（不应重试） */
function is400Error(e: unknown): boolean {
  if (!e) return false;
  const msg = e instanceof Error ? e.message : String(e);
  return msg.includes('INVALID_ARGUMENT') || msg.includes('400');
}

/** 判断错误是否为 PROHIBITED_CONTENT（硬性过滤，safetySettings 无法覆盖） */
function isProhibitedContent(e: unknown): boolean {
  if (!e) return false;
  const msg = e instanceof Error ? e.message : String(e);
  return msg.includes('PROHIBITED_CONTENT');
}

/**
 * 从 3x3 九宫格接触表中裁剪出指定格（1-9）的图片。
 * 格编号从左到右、从上到下：1 2 3 / 4 5 6 / 7 8 9
 * 返回裁剪后的 base64 数据和 mimeType。
 */
async function cropPanelFromSheet(
  base64Data: string,
  panelIndex: number,
): Promise<{ data: string; mimeType: string }> {
  const inputBuffer = Buffer.from(base64Data, 'base64');
  const image = sharp(inputBuffer);
  const metadata = await image.metadata();
  const w = metadata.width ?? 0;
  const h = metadata.height ?? 0;
  if (w === 0 || h === 0) throw new Error('无法获取图片尺寸');

  const col = (panelIndex - 1) % 3;   // 0, 1, 2
  const row = Math.floor((panelIndex - 1) / 3); // 0, 1, 2
  const cellW = Math.floor(w / 3);
  const cellH = Math.floor(h / 3);

  const outputBuffer = await sharp(inputBuffer)
    .extract({ left: col * cellW, top: row * cellH, width: cellW, height: cellH })
    .jpeg({ quality: 90 })
    .toBuffer();

  console.log(`[crop] 裁剪第${panelIndex}格: ${w}x${h} → ${cellW}x${cellH}, 输出 ${Math.round(outputBuffer.length / 1024)}KB`);
  return { data: outputBuffer.toString('base64'), mimeType: 'image/jpeg' };
}

/** 安全设置：将所有类别的过滤阈值设为 OFF，避免合法的艺术/摄影内容被误判 */
const SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT' as const, threshold: 'OFF' as const },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT' as const, threshold: 'OFF' as const },
  { category: 'HARM_CATEGORY_HARASSMENT' as const, threshold: 'OFF' as const },
  { category: 'HARM_CATEGORY_HATE_SPEECH' as const, threshold: 'OFF' as const },
];

/** 单次调用 Gemini 生成图片，返回 data URL 或 null */
async function callGeminiImage(
  ai: InstanceType<typeof GoogleGenAI>,
  modelId: string,
  contents: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>,
  aspectRatio: string,
): Promise<string | null> {
  const response = await ai.models.generateContent({
    model: modelId,
    contents,
    config: {
      responseModalities: ['TEXT', 'IMAGE'] as string[],
      imageConfig: { aspectRatio },
      safetySettings: SAFETY_SETTINGS,
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
  if (feedback?.blockReason) throw new Error(`内容被过滤: ${feedback.blockReason}`);
  return null;
}

export async function generateContactSheetImage(
  sourceImageDataUrl: string,
  overrides?: GridPromptOverrides,
  options?: { characterReferenceImage?: string; ethnicity?: EthnicityOption; characterDescription?: string }
): Promise<string | null> {
  lastGridContactSheetError = null;
  const apiKey = await getApiKey();
  if (!apiKey) {
    lastGridContactSheetError = '未配置 Gemini API Key';
    return null;
  }

  const { data: base64Data, mimeType } = parseDataUrl(sourceImageDataUrl);
  if (!isValidBase64(base64Data)) {
    lastGridContactSheetError = '源图片数据无效，请重新上传或使用其它图片';
    console.error('[grid] 源图 base64 无效, 长度:', base64Data.length, '前20字符:', base64Data.slice(0, 20));
    return null;
  }
  console.log(`[grid] 源图 base64 长度: ${base64Data.length} (≈${Math.round(base64Data.length * 0.75 / 1024)}KB), mime: ${mimeType}`);

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
  if (options?.characterDescription?.trim()) {
    prompt += `\n\n【人物特征限定】\n以下是参考图中人物的详细特征，所有格中的人物必须严格符合这些特征：\n${options.characterDescription.trim()}`;
  }

  // 构造 contents：文本 + 源图 + 可选参考图
  const hasRef = !!options?.characterReferenceImage;
  const contents: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    { text: prompt },
    { inlineData: { mimeType, data: base64Data } },
  ];
  let refData = '';
  let refMime = 'image/jpeg';
  if (hasRef) {
    const parsed = parseDataUrl(options!.characterReferenceImage!);
    refData = parsed.data;
    refMime = parsed.mimeType;
    if (isValidBase64(refData)) {
      // 压缩参考图，避免超大 PNG 导致 API 超时
      const compressed = await compressReferenceImage(refData, refMime);
      refData = compressed.data;
      refMime = compressed.mimeType;
      contents.push({ inlineData: { mimeType: refMime, data: refData } });
      console.log(`[grid] 参考图 base64 长度: ${refData.length} (≈${Math.round(refData.length * 0.75 / 1024)}KB), mime: ${refMime}`);
    } else {
      console.warn('[grid] 参考图 base64 无效，跳过参考图');
    }
  }

  // 不带参考图的 contents（400 fallback 时使用）
  const contentsNoRef: typeof contents = [
    { text: prompt },
    { inlineData: { mimeType, data: base64Data } },
  ];

  const ai = new GoogleGenAI({ apiKey });
  const modelIds = ['gemini-3-pro-image-preview', 'gemini-2.5-flash-image'];
  let lastError: unknown;
  let got400 = false;

  for (const modelId of modelIds) {
    try {
      console.log(`[grid] 尝试模型: ${modelId}, 含参考图: ${contents.length > 2}`);
      const result = await callGeminiImage(ai, modelId, contents, '16:9');
      if (result) return result;
      if (!lastError) lastError = new Error('API 未返回图片，可能被限流或内容策略拦截');
    } catch (e) {
      lastError = e;
      console.warn(`[grid] 模型 ${modelId} 失败:`, e instanceof Error ? e.message : e);
      if (is400Error(e)) { got400 = true; break; }
      continue;
    }
  }

  // 若 400 且有参考图 → 去掉参考图重试
  if (got400 && hasRef) {
    console.log('[grid] 400 错误，去掉参考图重试...');
    for (const modelId of modelIds) {
      try {
        const result = await callGeminiImage(ai, modelId, contentsNoRef, '16:9');
        if (result) return result;
      } catch (e) {
        console.warn(`[grid] 去掉参考图后模型 ${modelId} 仍失败:`, e instanceof Error ? e.message : e);
        lastError = e;
        if (is400Error(e)) break;
      }
    }
  }

  // 若不是 400（可能是限流），等 3 秒重试
  if (!got400) {
    await new Promise((r) => setTimeout(r, 3000));
    try {
      const result = await callGeminiImage(ai, modelIds[0], contents, '16:9');
      if (result) return result;
    } catch (retryErr) {
      console.warn('[grid] 3s 后重试失败:', retryErr instanceof Error ? retryErr.message : retryErr);
      if (!is400Error(retryErr)) {
        // 再等 15 秒做最后一次重试
        await new Promise((r) => setTimeout(r, 15000));
        try {
          const result = await callGeminiImage(ai, modelIds[0], contents, '16:9');
          if (result) return result;
        } catch (retry2Err) {
          console.warn('[grid] 15s 后重试失败:', retry2Err instanceof Error ? retry2Err.message : retry2Err);
        }
      }
    }
  }

  const errMsg = lastError instanceof Error ? lastError.message : String(lastError);
  lastGridContactSheetError = got400
    ? '图片或参考图格式不被 API 接受（400 INVALID_ARGUMENT），请尝试更换图片或去掉参考图后重试'
    : errMsg;
  console.error('[grid] 九宫格生成最终失败:', lastError);
  return null;
}

/** expandPanelTo2K 可选参数：人物参考图 + 人种 + 分辨率 + 辅助提示词 + 人物特征描述 */
export interface ExpandPanelOptions {
  characterReferenceImage?: string;
  /** 人种，用于提示中强调【人种】，严格按照参考图人物的所有面部特征 */
  ethnicity?: EthnicityOption;
  /** 输出分辨率，默认 2K */
  imageSize?: '2K' | '4K';
  /** 用户输入的辅助提示词，会追加到生成提示中 */
  auxiliaryPrompt?: string;
  /** 人物特征描述文字，用于在提示词中限定人物特征 */
  characterDescription?: string;
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
  const { data: base64Data, mimeType } = parseDataUrl(contactSheetImageDataUrl);
  if (!isValidBase64(base64Data)) {
    console.error('[expand] 接触表 base64 无效');
    return null;
  }

  const panelDesc = PANEL_DESCRIPTIONS[panelIndex];
  let prompt =
    `附件是一张 3x3 电影接触表（9 格，从左到右、从上到下编号 1–9）。\n\n` +
    `请仅根据「第 ${panelIndex} 格」的画面内容，生成一张独立的高分辨率大图。\n` +
    `该格镜头类型：${panelDesc}。\n\n` +
    `【严格要求】\n` +
    `1. 构图必须与接触表第 ${panelIndex} 格完全一致：相同的画面布局、相同的拍摄角度、相同的景别。\n` +
    `2. 人物的姿态、动作、服装、照明必须与该格完全一致，不得自由发挥或改变任何元素。\n` +
    `3. 如果该格是一个空镜（无人物）或者局部特写（如手、脚、物品等），则严格保持空镜或局部的构图，不要在画面中添加完整的人物。\n` +
    `4. 输出一张 16:9 高分辨率图片，画质清晰细腻。`;
  if (options?.characterReferenceImage && options?.ethnicity) {
    prompt += `\n\n【人物参考图要求】\n` +
      `人物为【${options.ethnicity}】。如果第 ${panelIndex} 格中包含人物（非空镜、非纯局部静物），` +
      `则该人物的面部所有特征（五官、脸型、肤色、发型等）必须与附件中的参考图人物完全一致。` +
      `但如果第 ${panelIndex} 格是空镜、纯景物、或者只有身体局部（无面部），则不需要参考人物面部特征。`;
  }
  if (options?.characterDescription?.trim()) {
    prompt += `\n\n【人物特征限定】\n以下是参考图中人物的详细特征，生成的图片中人物必须严格符合这些特征：\n${options.characterDescription.trim()}`;
  }
  if (options?.auxiliaryPrompt?.trim()) {
    prompt += `\n\n用户补充要求：${options.auxiliaryPrompt.trim()}`;
  }

  const hasRef = !!options?.characterReferenceImage;
  const contents: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    { text: prompt },
    { inlineData: { mimeType, data: base64Data } },
  ];
  if (hasRef) {
    const parsed = parseDataUrl(options!.characterReferenceImage!);
    if (isValidBase64(parsed.data)) {
      // 压缩参考图，避免超大 PNG 导致 API 超时
      const compressed = await compressReferenceImage(parsed.data, parsed.mimeType);
      contents.push({ inlineData: { mimeType: compressed.mimeType, data: compressed.data } });
      console.log(`[expand] 参考图压缩后 base64 长度: ${compressed.data.length} (≈${Math.round(compressed.data.length * 0.75 / 1024)}KB)`);
    }
  }

  const contentsNoRef: typeof contents = [
    { text: prompt },
    { inlineData: { mimeType, data: base64Data } },
  ];

  const ai = new GoogleGenAI({ apiKey });
  const modelIds = ['gemini-3-pro-image-preview', 'gemini-2.5-flash-image'];
  let lastError: unknown;

  let got400 = false;
  let gotProhibited = false;

  for (const modelId of modelIds) {
    try {
      console.log(`[expand] 第${panelIndex}格 → ${size}, 模型: ${modelId}`);
      const result = await callGeminiImage(ai, modelId, contents, '16:9');
      if (result) return result;
      if (!lastError) lastError = new Error('API 未返回图片，可能被限流或内容策略拦截');
    } catch (e) {
      lastError = e;
      console.warn(`[expand] 模型 ${modelId} 失败:`, e instanceof Error ? e.message : e);
      if (isProhibitedContent(e)) {
        gotProhibited = true;
        continue; // 继续尝试下一个模型
      }
      if (is400Error(e)) {
        got400 = true;
        if (hasRef) {
          try {
            console.log(`[expand] 去掉参考图重试 ${modelId}...`);
            const result = await callGeminiImage(ai, modelId, contentsNoRef, '16:9');
            if (result) return result;
          } catch (e2) {
            console.warn(`[expand] 去掉参考图后仍失败:`, e2 instanceof Error ? e2.message : e2);
          }
        }
        break;
      }
      continue;
    }
  }

  // PROHIBITED_CONTENT 策略：裁剪出单格图片 + 简化提示词重试
  // 整张九宫格中其他格可能触发了过滤，裁剪出单格可以避免干扰
  if (gotProhibited) {
    console.log(`[expand] PROHIBITED_CONTENT，裁剪第${panelIndex}格单独重试...`);
    try {
      const cropped = await cropPanelFromSheet(base64Data, panelIndex);
      const croppedPrompt =
        `附件是一张电影场景截图。请根据这张图片，生成一张 16:9 高分辨率大图。\n\n` +
        `【要求】\n` +
        `1. 构图、场景、人物姿态、服装、照明必须与附件图片完全一致。\n` +
        `2. 输出一张 16:9 高清图片，画质清晰细腻，保持原图的风格与色调。`;
      if (options?.characterReferenceImage && options?.ethnicity) {
        // 仅加简短参考图说明
      }
      if (options?.auxiliaryPrompt?.trim()) {
        // 保留用户补充要求
      }

      const croppedContents: typeof contents = [
        { text: croppedPrompt },
        { inlineData: { mimeType: cropped.mimeType, data: cropped.data } },
      ];
      // 如果有参考图，也加上（已压缩过）
      if (hasRef) {
        const parsed = parseDataUrl(options!.characterReferenceImage!);
        if (isValidBase64(parsed.data)) {
          const compressed = await compressReferenceImage(parsed.data, parsed.mimeType);
          croppedContents.push({ inlineData: { mimeType: compressed.mimeType, data: compressed.data } });
        }
      }
      const croppedContentsNoRef: typeof contents = [
        { text: croppedPrompt },
        { inlineData: { mimeType: cropped.mimeType, data: cropped.data } },
      ];

      for (const modelId of modelIds) {
        try {
          console.log(`[expand] 裁剪后重试模型: ${modelId}`);
          const result = await callGeminiImage(ai, modelId, croppedContents, '16:9');
          if (result) return result;
        } catch (e) {
          console.warn(`[expand] 裁剪后模型 ${modelId} 失败:`, e instanceof Error ? e.message : e);
          lastError = e;
          if (isProhibitedContent(e) && hasRef) {
            // 裁剪图 + 参考图仍被过滤 → 去掉参考图
            try {
              console.log(`[expand] 裁剪后去掉参考图重试 ${modelId}...`);
              const result = await callGeminiImage(ai, modelId, croppedContentsNoRef, '16:9');
              if (result) return result;
            } catch (e2) {
              console.warn(`[expand] 裁剪后去掉参考图仍失败:`, e2 instanceof Error ? e2.message : e2);
              lastError = e2;
            }
          }
          if (is400Error(e)) break;
        }
      }
    } catch (cropErr) {
      console.warn('[expand] 裁剪失败:', cropErr instanceof Error ? cropErr.message : cropErr);
    }
  }

  if (!got400 && !gotProhibited) {
    // 503 / 限流：先尝试去掉参考图（减小请求体）
    if (hasRef) {
      console.log('[expand] 503/限流，去掉参考图重试...');
      for (const modelId of modelIds) {
        try {
          const result = await callGeminiImage(ai, modelId, contentsNoRef, '16:9');
          if (result) return result;
        } catch (e) {
          console.warn(`[expand] 去掉参考图模型 ${modelId} 失败:`, e instanceof Error ? e.message : e);
          lastError = e;
          if (is400Error(e)) break;
        }
      }
    }

    // 等 3 秒重试
    console.log('[expand] 等待 3s 后重试...');
    await new Promise((r) => setTimeout(r, 3000));
    try {
      const result = await callGeminiImage(ai, modelIds[0], contentsNoRef, '16:9');
      if (result) return result;
    } catch (retryErr) {
      console.warn('[expand] 3s 后重试失败:', retryErr instanceof Error ? retryErr.message : retryErr);
      if (!is400Error(retryErr)) {
        console.log('[expand] 等待 15s 后最后重试...');
        await new Promise((r) => setTimeout(r, 15000));
        try {
          const result = await callGeminiImage(ai, modelIds[0], contentsNoRef, '16:9');
          if (result) return result;
        } catch (retry2Err) {
          console.warn('[expand] 15s 后重试失败:', retry2Err instanceof Error ? retry2Err.message : retry2Err);
        }
      }
    }
  }

  console.error('[expand] 2K 生成最终失败:', lastError);
  return null;
}
