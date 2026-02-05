import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { expandPanelTo2K } from '@/app/lib/gridImageGen';

/**
 * 根据接触表图 + 格编号（1–9），生成该格的 2K/4K 大图。
 * POST body: { image, panelIndex: 1-9, saveDir?, useCharacterReference?: boolean, characterReferenceImage?, ethnicity?, step3OutputBaseDir?, resolution?: '2K'|'4K', auxiliaryPrompt? }
 */
export async function POST(request: NextRequest) {
  try {
    const {
      image,
      panelIndex,
      saveDir,
      useCharacterReference = true,
      characterReferenceImage,
      ethnicity,
      step3OutputBaseDir,
      resolution = '2K',
      auxiliaryPrompt,
    } = await request.json();

    if (!image || typeof image !== 'string') {
      return NextResponse.json(
        { error: 'Missing image (data URL or base64)' },
        { status: 400 }
      );
    }

    const cell = Number(panelIndex);
    if (!Number.isInteger(cell) || cell < 1 || cell > 9) {
      return NextResponse.json(
        { error: 'panelIndex must be 1-9' },
        { status: 400 }
      );
    }

    const options: Parameters<typeof expandPanelTo2K>[2] = {};
    if (useCharacterReference && characterReferenceImage && typeof characterReferenceImage === 'string') {
      options.characterReferenceImage = characterReferenceImage;
    }
    if (ethnicity) options.ethnicity = ethnicity;
    if (resolution === '4K') options.imageSize = '4K';
    if (typeof auxiliaryPrompt === 'string' && auxiliaryPrompt.trim()) options.auxiliaryPrompt = auxiliaryPrompt.trim();
    const imageUrl = await expandPanelTo2K(image, cell, Object.keys(options).length ? options : undefined);
    if (!imageUrl) {
      return NextResponse.json(
        { error: `第 ${cell} 格 2K 生成失败` },
        { status: 500 }
      );
    }

    let savedPath: string | undefined;
    const match = imageUrl.match(/^data:image\/\w+;base64,(.+)$/);
    const base64 = match ? match[1] : imageUrl;
    const ext = imageUrl.startsWith('data:image/png') ? 'png' : 'jpg';
    const num = String(cell).padStart(2, '0');
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    if (typeof step3OutputBaseDir === 'string' && step3OutputBaseDir.trim()) {
      const base = path.resolve(process.cwd(), step3OutputBaseDir.trim());
      const dir = path.join(base, 'IMAGE');
      await mkdir(dir, { recursive: true });
      const filepath = path.join(dir, `panel_${num}_2K_${timestamp}.${ext}`);
      await writeFile(filepath, Buffer.from(base64, 'base64'));
      savedPath = path.relative(process.cwd(), filepath);
    } else if (typeof saveDir === 'string' && saveDir.trim()) {
      const dir = path.resolve(process.cwd(), saveDir.trim());
      const filepath = path.join(dir, `panel_${num}_2K.${ext}`);
      await writeFile(filepath, Buffer.from(base64, 'base64'));
      savedPath = path.relative(process.cwd(), filepath);
    }

    return NextResponse.json({
      imageUrl,
      panelIndex: cell,
      imageSize: options.imageSize === '4K' ? '4K' : '2K',
      savedPath,
    });
  } catch (error) {
    console.error('Generate grid cell (2K) error:', error);
    return NextResponse.json(
      { error: '单格 2K 生成失败' },
      { status: 500 }
    );
  }
}
