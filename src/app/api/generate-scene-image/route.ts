import { NextRequest, NextResponse } from 'next/server';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { generateSceneImage, getLastSceneImageError } from '@/app/lib/sceneImageGen';
import { parseDataUrl } from '@/app/lib/dataUrlUtils';

const SCENE_OUTPUT_BASE = path.join(process.cwd(), 'output', 'scene');

/**
 * 根据提示词 + 参考图生成 16:9 场景图，并可选保存到 表格编号_核心词_YYYYMMDD/IMAGE/ 下。
 * POST: { prompt, referenceImage, keywordId?, coreWord?, saveDir?, filename? }
 * 若提供 keywordId + coreWord，则 saveDir = keywordId_coreWord_YYYYMMDD，保存到其 IMAGE 子目录。
 */
export async function POST(request: NextRequest) {
  try {
    let body: { prompt?: string; referenceImage?: string; keywordId?: string; coreWord?: string; filename?: string; characterDescription?: string };
    try {
      body = await request.json();
    } catch (parseErr) {
      return NextResponse.json(
        { error: '请求体过大或格式错误，请尝试使用较小的参考图或刷新后重试' },
        { status: 413 }
      );
    }
    const { prompt, referenceImage, keywordId, coreWord, filename: givenFilename, characterDescription } = body;
    if (!prompt || !referenceImage) {
      return NextResponse.json({ error: 'Missing prompt or referenceImage' }, { status: 400 });
    }

    const imageDataUrl = await generateSceneImage(prompt, referenceImage, characterDescription);
    if (!imageDataUrl) {
      const detail = getLastSceneImageError();
      const message = detail || '场景图生成失败，请检查 API Key 与提示词内容';
      return NextResponse.json({ error: message }, { status: 500 });
    }

    let savedPath: string | null = null;
    let saveDir: string | null = null;

    const needSave = keywordId && coreWord;
    if (needSave) {
      const YYYYMMDD = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const safeCore = String(coreWord).replace(/[/\\:*?"<>|]/g, '_').slice(0, 30);
      const dirName = `${String(keywordId).padStart(3, '0')}_${safeCore}_${YYYYMMDD}`;
      const absDir = path.join(SCENE_OUTPUT_BASE, dirName, 'IMAGE');
      await mkdir(absDir, { recursive: true });
      saveDir = path.relative(process.cwd(), path.join(SCENE_OUTPUT_BASE, dirName));

      const baseName = givenFilename && /^[\w.-]+$/.test(givenFilename)
        ? givenFilename.replace(/\.(png|jpg|jpeg)$/i, '')
        : `scene_${Date.now()}`;
      const { data: base64, mimeType: saveMime } = parseDataUrl(imageDataUrl);
      const ext = saveMime === 'image/png' ? 'png' : 'jpg';
      const filename = `${baseName}.${ext}`;
      const filepath = path.join(absDir, filename);
      await writeFile(filepath, Buffer.from(base64, 'base64'));
      savedPath = path.relative(process.cwd(), filepath);
    }

    return NextResponse.json({
      imageUrl: imageDataUrl,
      savedPath: savedPath ?? undefined,
      saveDir: saveDir ?? undefined,
    });
  } catch (e) {
    console.error('generate-scene-image error:', e);
    const detail = getLastSceneImageError();
    const message = detail || (e instanceof Error ? e.message : '场景图生成失败，请检查 API Key 或稍后重试');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
