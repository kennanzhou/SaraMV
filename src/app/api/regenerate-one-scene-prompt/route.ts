import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
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

/** 重新生成单条场景拓展提示词（中文，状态/情欲感规则同 generate-scene-prompts） */
export async function POST(request: NextRequest) {
  try {
    const { image, sceneContext, fullContext, characterGender, characterHairColor, sceneDescription, index, existingPrompts } = await request.json();
    if (!image || typeof image !== 'string') {
      return NextResponse.json({ error: 'Missing image' }, { status: 400 });
    }
    const i = typeof index === 'number' ? index : 0;

    const apiKey = await getApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: 'API Key not configured' }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const mimeType = image.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg';

    const other = Array.isArray(existingPrompts) ? existingPrompts.filter((_: unknown, j: number) => j !== i) : [];

    const personDesc = [characterGender, characterHairColor].filter(Boolean).join('、') || '人物';
    const sceneBase = sceneDescription?.trim() || '（无）';

    const prompt = `你是一位日本少女写真摄影师的视觉顾问。根据附件中的参考图片和下面的场景基础，生成「一条」场景拓展提示词（中文）。这是第 ${i + 1} 条。

【场景基础】${sceneBase}

【重要】本条必须对应一个与其余四条「不同」的空间/房间（如厨房、卧室、玄关、浴室、阳台、客厅、走廊等）。若已有提示词描述了某房间，本条必须选另一个房间或区域，不要重复同一空间。

【参考信息】
- 场景、光影、影像风格分析：${sceneContext || '（无）'}
- 文学性描述：${fullContext || '（无）'}

【人物基本特征】性别：${characterGender || '（未指定）'}；发色/发型：${characterHairColor || '（未指定）'}。描述人物时使用上述特征，与参考图一致。

${other.length > 0 ? `【已有其它提示词（对应不同空间，本条勿与它们重复同一房间）】\n${other.slice(0, 4).map((p: string, j: number) => `${j + 1}. ${p}`).join('\n')}\n\n` : ''}

【要求】人物符合性别与发色特征，处在某种充满情绪/情欲/诱惑的「状态」中，不做具体事；可写姿势、发型、穿着方式、与镜头的眼神交互，带含蓄性暗示与私密感，语气温和不露骨；状态为思念/悲伤/喜悦/害羞/情欲/渴望/放空之一；脸微微侧或抬头低头，不居中死板；光影与人物特征与参考图一致，中景或近景。提示词中需明确写出所在空间（如厨房、卧室等）。

只输出这一条中文提示词，不要 JSON、不要序号、不要引号，直接一段文字。`;

    const result = await model.generateContent([
      prompt,
      { inlineData: { mimeType, data: base64Data } },
    ]);
    const response = await result.response;
    let text = (response.text() || '').trim().replace(/^["']|["']$/g, '');
    return NextResponse.json({ prompt: text });
  } catch (e) {
    console.error('regenerate-one-scene-prompt error:', e);
    return NextResponse.json({ error: 'Failed to regenerate prompt' }, { status: 500 });
  }
}
