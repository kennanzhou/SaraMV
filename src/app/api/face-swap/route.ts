import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { parseDataUrl, isValidBase64 } from '@/app/lib/dataUrlUtils';

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

/** 压缩图片到合理大小 */
async function compressImage(
  base64Data: string,
  mimeType: string,
  maxDimension = 1536,
): Promise<{ data: string; mimeType: string }> {
  const estimatedBytes = base64Data.length * 0.75;
  if (estimatedBytes < 1.5 * 1024 * 1024 && mimeType === 'image/jpeg') {
    return { data: base64Data, mimeType };
  }
  try {
    const inputBuffer = Buffer.from(base64Data, 'base64');
    const outputBuffer = await sharp(inputBuffer)
      .resize(maxDimension, maxDimension, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    console.log(`[face-swap] 图片压缩: ${Math.round(estimatedBytes / 1024)}KB → ${Math.round(outputBuffer.length / 1024)}KB`);
    return { data: outputBuffer.toString('base64'), mimeType: 'image/jpeg' };
  } catch {
    return { data: base64Data, mimeType };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SAFETY_SETTINGS: any[] = [
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'OFF' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'OFF' },
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'OFF' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'OFF' },
];

/**
 * 洗脸：保持原图的画面构图和所有细节，但将人物面部特征、发型发色替换为参考图中的人物。
 * POST: { sourceImage, referenceImage, characterDescription? }
 * 返回: { imageUrl }
 */
export async function POST(request: NextRequest) {
  try {
    const { sourceImage, referenceImage, characterDescription, step3OutputBaseDir } = await request.json();

    if (!sourceImage || !referenceImage) {
      return NextResponse.json({ error: '缺少原图或参考图' }, { status: 400 });
    }

    const apiKey = await getApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: '未配置 Gemini API Key' }, { status: 400 });
    }

    /** 将生成的图片保存到本地 */
    const saveToLocal = async (imageDataUrl: string): Promise<string | undefined> => {
      if (!step3OutputBaseDir || typeof step3OutputBaseDir !== 'string') return undefined;
      try {
        const { data: b64, mimeType: mime } = parseDataUrl(imageDataUrl);
        const ext = mime === 'image/png' ? 'png' : 'jpg';
        const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
        const base = path.resolve(process.cwd(), step3OutputBaseDir.trim());
        const dir = path.join(base, 'IMAGE');
        await mkdir(dir, { recursive: true });
        const filepath = path.join(dir, `faceswap_${timestamp}.${ext}`);
        await writeFile(filepath, Buffer.from(b64, 'base64'));
        const rel = path.relative(process.cwd(), filepath);
        console.log(`[face-swap] 已保存到: ${rel}`);
        return rel;
      } catch (saveErr) {
        console.warn('[face-swap] 保存到本地失败:', saveErr instanceof Error ? saveErr.message : saveErr);
        return undefined;
      }
    };

    // 压缩原图和参考图
    const srcParsed = parseDataUrl(sourceImage);
    const refParsed = parseDataUrl(referenceImage);
    if (!isValidBase64(srcParsed.data) || !isValidBase64(refParsed.data)) {
      return NextResponse.json({ error: '图片数据无效' }, { status: 400 });
    }

    const srcCompressed = await compressImage(srcParsed.data, srcParsed.mimeType);
    const refCompressed = await compressImage(refParsed.data, refParsed.mimeType);

    let prompt =
      `请根据以下两张图片生成一张新图片。\n\n` +
      `第一张是【原始场景图】，第二张是【人物参考图】。\n\n` +
      `【严格要求】\n` +
      `1. 新图片的画面构图、拍摄角度、景别、场景、背景、光影、色调、服装风格等所有视觉细节必须与原始场景图完全一致，不得有任何改变。\n` +
      `2. 画面中人物的面部所有特征（五官、脸型、肤色）、发型、发色必须与参考图中的人物完全相同。\n` +
      `3. 仅替换人物的面部和头发，其他一切保持不变。\n` +
      `4. 输出一张与原图相同比例的 16:9 高清图片。`;
    if (characterDescription?.trim()) {
      prompt += `\n\n【人物特征限定】\n${characterDescription.trim()}`;
    }

    const contents = [
      { text: prompt },
      { inlineData: { mimeType: srcCompressed.mimeType, data: srcCompressed.data } },
      { inlineData: { mimeType: refCompressed.mimeType, data: refCompressed.data } },
    ];

    const ai = new GoogleGenAI({ apiKey });
    const modelIds = ['gemini-3-pro-image-preview', 'gemini-2.5-flash-image'];
    let lastError: unknown;

    for (const modelId of modelIds) {
      try {
        console.log(`[face-swap] 尝试模型: ${modelId}`);
        const response = await ai.models.generateContent({
          model: modelId,
          contents,
          config: {
            responseModalities: ['TEXT', 'IMAGE'] as string[],
            imageConfig: { aspectRatio: '16:9' },
            safetySettings: SAFETY_SETTINGS,
          },
        });

        const parts = response.candidates?.[0]?.content?.parts;
        if (Array.isArray(parts)) {
          for (const part of parts) {
            const blob = (part as { inlineData?: { mimeType?: string; data?: string } })?.inlineData;
            if (blob?.data) {
              const imageUrl = `data:${blob.mimeType || 'image/png'};base64,${blob.data}`;
              const savedPath = await saveToLocal(imageUrl);
              return NextResponse.json({ imageUrl, savedPath });
            }
          }
        }

        const feedback = (response as { promptFeedback?: { blockReason?: string } })?.promptFeedback;
        if (feedback?.blockReason) {
          lastError = new Error(`内容被过滤: ${feedback.blockReason}`);
          console.warn(`[face-swap] ${modelId} 被过滤:`, feedback.blockReason);
          continue;
        }
        if (!lastError) lastError = new Error('API 未返回图片');
      } catch (e) {
        lastError = e;
        console.warn(`[face-swap] 模型 ${modelId} 失败:`, e instanceof Error ? e.message : e);
        continue;
      }
    }

    // 重试一次
    await new Promise((r) => setTimeout(r, 3000));
    try {
      console.log('[face-swap] 3s 后重试...');
      const response = await ai.models.generateContent({
        model: modelIds[0],
        contents,
        config: {
          responseModalities: ['TEXT', 'IMAGE'] as string[],
          imageConfig: { aspectRatio: '16:9' },
          safetySettings: SAFETY_SETTINGS,
        },
      });
      const parts = response.candidates?.[0]?.content?.parts;
      if (Array.isArray(parts)) {
        for (const part of parts) {
          const blob = (part as { inlineData?: { mimeType?: string; data?: string } })?.inlineData;
          if (blob?.data) {
            const retryImageUrl = `data:${blob.mimeType || 'image/png'};base64,${blob.data}`;
            const savedPath = await saveToLocal(retryImageUrl);
            return NextResponse.json({ imageUrl: retryImageUrl, savedPath });
          }
        }
      }
    } catch (retryErr) {
      console.warn('[face-swap] 重试失败:', retryErr instanceof Error ? retryErr.message : retryErr);
    }

    const errMsg = lastError instanceof Error ? lastError.message : '洗脸生成失败';
    console.error('[face-swap] 最终失败:', lastError);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  } catch (error) {
    console.error('face-swap error:', error);
    return NextResponse.json({ error: '洗脸生成失败，请重试' }, { status: 500 });
  }
}
