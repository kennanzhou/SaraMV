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

/** 重新生成单条爱欲现场提示词（中文，状态/情欲感规则同 generate-desire-scene-prompts） */
export async function POST(request: NextRequest) {
  try {
    const { story, sceneContext, characterGender, characterHairColor, index, existingPrompts } = await request.json();
    if (!story || typeof story !== 'string') {
      return NextResponse.json({ error: 'Missing story' }, { status: 400 });
    }
    const i = typeof index === 'number' ? index : 0;

    const apiKey = await getApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: 'API Key not configured' }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const other = Array.isArray(existingPrompts) ? existingPrompts.filter((_: unknown, j: number) => j !== i) : [];

    const prompt = `你是一位专业的电影场景与视觉风格顾问。根据下面「爱欲现场」故事，生成「一条」场景提示词（中文）。这是第 ${i + 1} 条，与其余条风格一致但场景/状态不同。

【爱欲现场故事】
${story.slice(0, 6000)}

【参考图的场景、光影、影像风格】
${sceneContext || '（无）'}

${other.length > 0 ? `【已有其它提示词（勿重复）】\n${other.map((p: string, j: number) => `${j + 1}. ${p}`).join('\n')}\n\n` : ''}

【人物基本特征】性别：${characterGender || '（未指定）'}；发色/发型：${characterHairColor || '（未指定）'}。描述人物时使用上述特征，与参考图一致。

【要求】同前：人物符合性别与发色特征，处在某种充满情绪、温柔暧昧的「状态」中，不做具体事；可写姿势、发型、穿着方式、与镜头的眼神交互，带含蓄与私密感，语气温和不露骨；状态为思念/悲伤/喜悦/害羞/温柔/渴望/放空之一；脸微微侧或抬头低头，位置不居中；来自爱欲现场其它场景，视觉风格与参考图一致。中景或近景。

只输出这一条中文提示词，不要 JSON、不要序号、不要引号，直接一段文字。`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = (response.text() || '').trim().replace(/^["']|["']$/g, '');
    return NextResponse.json({ prompt: text });
  } catch (e) {
    console.error('regenerate-one-desire-prompt error:', e);
    return NextResponse.json({ error: 'Failed to regenerate prompt' }, { status: 500 });
  }
}
