/**
 * 第三步场景图：根据提示词 + 参考图，调用 Gemini 生成 16:9 场景图。
 */
import { GoogleGenAI } from '@google/genai';
import { readFile } from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { parseDataUrl, isValidBase64 } from './dataUrlUtils';

/**
 * 压缩参考图：将超大图片缩放到指定最大边长并转为 JPEG（质量 85），
 * 避免超大 PNG 导致 API 503 超时。
 */
async function compressReferenceImage(
  base64Data: string,
  mimeType: string,
  maxDimension = 1536,
): Promise<{ data: string; mimeType: string }> {
  const estimatedBytes = base64Data.length * 0.75;
  if (estimatedBytes < 1.5 * 1024 * 1024) {
    return { data: base64Data, mimeType };
  }
  try {
    const inputBuffer = Buffer.from(base64Data, 'base64');
    const image = sharp(inputBuffer);
    const metadata = await image.metadata();
    const w = metadata.width ?? 0;
    const h = metadata.height ?? 0;
    if (w <= maxDimension && h <= maxDimension && mimeType === 'image/jpeg' && estimatedBytes < 2 * 1024 * 1024) {
      return { data: base64Data, mimeType };
    }
    const outputBuffer = await image
      .resize(maxDimension, maxDimension, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    const newBase64 = outputBuffer.toString('base64');
    console.log(`[scene-compress] 参考图压缩: ${Math.round(estimatedBytes / 1024)}KB → ${Math.round(outputBuffer.length / 1024)}KB, ${w}x${h} → max${maxDimension}`);
    return { data: newBase64, mimeType: 'image/jpeg' };
  } catch (err) {
    console.warn('[scene-compress] 压缩失败，使用原图:', err instanceof Error ? err.message : err);
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

/** 生成结果：成功时返回 dataUrl，失败时返回 null，并可通过 getLastSceneImageError() 获取最后错误信息 */
let lastSceneImageError: string | null = null;

export function getLastSceneImageError(): string | null {
  return lastSceneImageError;
}

/**
 * 根据提示词与参考图生成 16:9 场景图。
 * 要求：人物特征与参考图一致，中景或近景，人物面向镜头；严格保持光影与影像风格一致。
 */
export async function generateSceneImage(
  prompt: string,
  referenceImageDataUrl: string,
  characterDescription?: string
): Promise<string | null> {
  lastSceneImageError = null;
  const apiKey = await getApiKey();
  if (!apiKey) {
    lastSceneImageError = '未配置 Gemini API Key，请在设置中填写';
    return null;
  }

  const parsed = parseDataUrl(referenceImageDataUrl);
  if (!isValidBase64(parsed.data)) {
    lastSceneImageError = '参考图片数据无效，请重新上传';
    return null;
  }
  // 压缩参考图，避免超大 PNG 导致 API 503 超时
  const { data: base64Data, mimeType } = await compressReferenceImage(parsed.data, parsed.mimeType);
  console.log(`[scene] 参考图 base64 长度: ${base64Data.length} (≈${Math.round(base64Data.length * 0.75 / 1024)}KB), mime: ${mimeType}`);

  let fullPrompt =
    `你是一位日本人像/场景摄影师，请根据以下提示词与参考图生成一张 16:9 的电影感场景图。\n\n` +
    `【要求】\n` +
    `- 人物面部与身体特征必须与参考图完全一致。\n` +
    `- 严格保持参考图的光影、色调与影像风格一致。\n` +
    `- 构图：中景或近景。人物的脸不要完全正对镜头，可以是微微侧脸或因情绪导致的抬头、低头；人物在画面中的位置不必在正中央，构图自然。\n`;
  if (characterDescription?.trim()) {
    fullPrompt += `\n【人物特征限定】\n以下是参考图中人物的详细特征，生成的图片中人物必须严格符合这些特征：\n${characterDescription.trim()}\n`;
  }
  fullPrompt += `\n【场景提示词】\n${prompt}\n\n` +
    `请输出一张 16:9 的横图，保持电影感与风格统一。`;

  /** 安全设置：将所有类别的过滤阈值设为 OFF，避免合法的艺术/摄影内容被误判 */
  const safetySettings = [
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT' as const, threshold: 'OFF' as const },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT' as const, threshold: 'OFF' as const },
    { category: 'HARM_CATEGORY_HARASSMENT' as const, threshold: 'OFF' as const },
    { category: 'HARM_CATEGORY_HATE_SPEECH' as const, threshold: 'OFF' as const },
  ];

  const ai = new GoogleGenAI({ apiKey });
  const modelIds = ['gemini-3-pro-image-preview', 'gemini-2.5-flash-image'];
  let lastError: unknown;
  let got400 = false;

  const contents: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    { text: fullPrompt },
    { inlineData: { mimeType, data: base64Data } },
  ];

  for (const modelId of modelIds) {
    try {
      console.log(`[scene] 尝试模型: ${modelId}`);
      const response = await ai.models.generateContent({
        model: modelId,
        contents,
        config: {
          responseModalities: ['TEXT', 'IMAGE'] as string[],
          imageConfig: { aspectRatio: '16:9' },
          safetySettings,
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
      if (feedback?.blockReason) {
        console.warn(`[scene] 内容被过滤 (${modelId}):`, feedback.blockReason);
        lastError = new Error(`内容被过滤: ${feedback.blockReason}`);
      } else if (!lastError) {
        lastError = new Error('API 未返回图片，可能被限流或内容策略拦截');
      }
    } catch (e) {
      lastError = e;
      console.warn(`[scene] 模型 ${modelId} 失败:`, e instanceof Error ? e.message : e);
      if (e instanceof Error && (e.message.includes('INVALID_ARGUMENT') || e.message.includes('400'))) {
        got400 = true;
        break;
      }
      continue;
    }
  }

  // 400 错误不重试（参数问题，重试无意义）
  if (!got400) {
    // 可能是速率限制：等 3 秒重试
    await new Promise((r) => setTimeout(r, 3000));
    try {
      const response = await ai.models.generateContent({
        model: modelIds[0],
        contents,
        config: {
          responseModalities: ['TEXT', 'IMAGE'] as string[],
          imageConfig: { aspectRatio: '16:9' },
          safetySettings,
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
    } catch (retryErr) {
      console.warn('[scene] 3s 后重试失败:', retryErr instanceof Error ? retryErr.message : retryErr);
    }

    // 再等 15 秒重试
    await new Promise((r) => setTimeout(r, 15000));
    try {
      const response = await ai.models.generateContent({
        model: modelIds[0],
        contents,
        config: {
          responseModalities: ['TEXT', 'IMAGE'] as string[],
          imageConfig: { aspectRatio: '16:9' },
          safetySettings,
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
      console.warn('[scene] 15s 后重试失败:', retry2Err instanceof Error ? retry2Err.message : retry2Err);
    }
  }

  const errMsg = lastError instanceof Error ? lastError.message : String(lastError);
  lastSceneImageError = got400
    ? '参考图格式或尺寸不被 API 接受，请尝试压缩图片或使用 JPEG/PNG 后重试'
    : errMsg;
  console.error('[scene] 场景图生成最终失败:', lastError);
  return null;
}
