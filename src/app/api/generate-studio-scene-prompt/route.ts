import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';
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

/**
 * 录音棚模式：根据模式（1 录音棚 / 2 原图生成 / 3 用户输入场景）+ 参考图 + 歌词，生成一条 16:9 场景图用的中文提示词。
 * POST: { mode: 1|2|3, image (base64), lyrics, fullContext?, userScene? }
 */
export async function POST(request: NextRequest) {
  try {
    const { mode, image, lyrics, fullContext, userScene } = await request.json();
    if (!image || typeof image !== 'string') {
      return NextResponse.json({ error: 'Missing image' }, { status: 400 });
    }
    const m = Number(mode);
    if (m !== 1 && m !== 2 && m !== 3) {
      return NextResponse.json({ error: 'mode must be 1, 2, or 3' }, { status: 400 });
    }
    if (m === 3 && typeof userScene !== 'string') {
      return NextResponse.json({ error: 'userScene required when mode is 3' }, { status: 400 });
    }

    const apiKey = await getApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: 'API Key not configured' }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const mimeType = image.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg';

    let instruction = '';
    if (m === 1) {
      instruction = `请根据参考图，生成一条「16:9 场景图」用的中文提示词，要求：
- 描述参考图中的人物身穿符合录音棚环境的服饰、发型、妆面；
- 头戴专业耳机；
- 在录音棚中录制歌曲的中景画面；
- 语气温和，不要露骨。`;
    } else if (m === 2) {
      instruction = `请根据参考图，生成一条「16:9 场景图」用的中文提示词，要求：
- 场景、人物、服装均与参考图一致，不变；
- 人物在唱歌的中景画面；
- 人物情绪符合下面歌词的氛围；
- 语气温和，不要露骨。`;
    } else {
      instruction = `请根据参考图和用户输入的场景，生成一条「16:9 场景图」用的中文提示词，要求：
- 描述参考图中的人物身穿符合歌词气质的服饰、发型、妆面；
- 在用户输入的场景中唱歌的中景画面；
- 人物情绪符合下面歌词；
- 用户场景：${String(userScene).trim()}
- 语气温和，不要露骨。`;
    }

    const prompt = `你是一位日本少女写真/电影场景的视觉顾问。请根据附件参考图及以下要求，生成「一条」可直接用于图生图的中文场景提示词（不要输出多段或编号）。

【要求】
${instruction}

【歌词/氛围参考】
${fullContext ? `文学性描述：${fullContext}\n\n` : ''}${lyrics ? `日文歌词：\n${lyrics}` : '（无）'}

请只输出这一条中文提示词，不要引号、不要编号、不要其他解释。`;

    const result = await model.generateContent([
      prompt,
      { inlineData: { mimeType, data: base64Data } },
    ]);
    const response = await result.response;
    let text = (response.text() || '').trim().replace(/^["']|["']$/g, '');

    return NextResponse.json({ prompt: text });
  } catch (e) {
    console.error('generate-studio-scene-prompt error:', e);
    return NextResponse.json(
      { error: '生成录音棚场景提示词失败' },
      { status: 500 }
    );
  }
}
