import { NextRequest, NextResponse } from 'next/server';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { generateContactSheetImage, getLastGridContactSheetError } from '@/app/lib/gridImageGen';
import { getPromptsConfig } from '@/app/lib/promptsConfig';

const GRID_OUTPUT_DIR = path.join(process.cwd(), 'output', 'grid');

/**
 * 九宫格：生成一张内含 9 格的接触表图。
 * POST body: { image, characterReferenceImage?, ethnicity?, step3OutputBaseDir? }
 * 若提供 step3OutputBaseDir 则保存到该目录下 IMAGE/contact_*.{ext}，否则保存到 output/grid/<timestamp>。
 */
export async function POST(request: NextRequest) {
  try {
    let body: { image?: string; characterReferenceImage?: string; ethnicity?: string; step3OutputBaseDir?: string; type?: 'normal' | 'closeup' };
    try {
      body = await request.json();
    } catch (parseErr) {
      return NextResponse.json(
        { error: '请求体过大或格式错误，请尝试使用较小的图片或刷新后重试' },
        { status: 413 }
      );
    }
    const { image, characterReferenceImage, ethnicity, step3OutputBaseDir, type: gridType } = body;

    if (!image || typeof image !== 'string') {
      return NextResponse.json(
        { error: 'Missing image (data URL or base64)' },
        { status: 400 }
      );
    }

    const promptsConfig = await getPromptsConfig();
    const isCloseup = gridType === 'closeup';
    const imageUrl = await generateContactSheetImage(
      image,
      {
        gridContactSheetPrompt: promptsConfig.gridContactSheetPrompt,
        gridPanelDescriptions: promptsConfig.gridPanelDescriptions,
        ...(isCloseup && promptsConfig.gridCloseupPrompt
          ? { gridCloseupPrompt: promptsConfig.gridCloseupPrompt }
          : {}),
      },
      characterReferenceImage && ethnicity
        ? { characterReferenceImage, ethnicity }
        : undefined
    );
    if (!imageUrl) {
      const detail = getLastGridContactSheetError();
      return NextResponse.json(
        { error: detail || '九宫格接触表生成失败，请检查 API Key 或稍后重试' },
        { status: 500 }
      );
    }

    const match = imageUrl.match(/^data:image\/\w+;base64,(.+)$/);
    const base64 = match ? match[1] : imageUrl;
    const ext = imageUrl.startsWith('data:image/png') ? 'png' : 'jpg';
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);

    let saveDir: string;
    let filepath: string;
    if (typeof step3OutputBaseDir === 'string' && step3OutputBaseDir.trim()) {
      const base = path.resolve(process.cwd(), step3OutputBaseDir.trim());
      saveDir = path.join(base, 'IMAGE');
      await mkdir(saveDir, { recursive: true });
      filepath = path.join(saveDir, `contact_${timestamp}.${ext}`);
    } else {
      saveDir = path.join(GRID_OUTPUT_DIR, timestamp);
      await mkdir(saveDir, { recursive: true });
      filepath = path.join(saveDir, `contact.${ext}`);
    }
    await writeFile(filepath, Buffer.from(base64, 'base64'));
    const savedDir = path.relative(process.cwd(), path.dirname(filepath));

    return NextResponse.json({
      imageUrl,
      savedDir,
    });
  } catch (error) {
    console.error('Generate grid (contact sheet) error:', error);
    return NextResponse.json(
      { error: '九宫格接触表生成失败' },
      { status: 500 }
    );
  }
}
