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

/**
 * 根据第二步的 5 段爱欲现场与主场景拓展的 5 组提示词，生成 5 组爱欲现场提示词。
 * 五组与 5 段一一对应；场景不得与主场景拓展中已用的场景重复。
 */
export async function POST(request: NextRequest) {
  try {
    const {
      story,
      segments,
      mainScenePrompts,
      sceneContext,
      image,
      characterGender,
      characterHairColor,
      otherScene,
    } = await request.json();
    if (!story || typeof story !== 'string') {
      return NextResponse.json({ error: 'Missing story (爱欲现场)' }, { status: 400 });
    }

    const apiKey = await getApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: 'API Key not configured' }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const segList = Array.isArray(segments) && segments.length >= 5
      ? segments.slice(0, 5)
      : [];
    const mainScenes = Array.isArray(mainScenePrompts) ? mainScenePrompts.slice(0, 5) : [];

    const prompt = `你是一位专业的电影场景与视觉风格顾问。根据下面「爱欲现场」的 5 段文字，生成「五组」场景提示词，且与 5 段一一对应。所有提示词必须使用中文，且必须符合第一步提取的人物基本特征。

【爱欲现场 5 段】（第 i 组提示词必须与第 i 段内容、情绪、场景相符）
${segList.length >= 5
  ? segList.map((s: string, i: number) => `第 ${i + 1} 段：\n${(s || '').slice(0, 400)}`).join('\n\n')
  : story.slice(0, 6000)}

【主场景拓展已用场景 - 禁止重复】
以下场景已在「主场景拓展」中使用，本五组爱欲现场提示词不得再使用这些场景（如厨房、卧室、玄关、浴室、阳台等若在下文出现则不可用）：
${mainScenes.length > 0 ? mainScenes.map((p: string, i: number) => `${i + 1}. ${(p || '').slice(0, 120)}...`).join('\n') : '（无，可自由选择场景）'}

【参考图的场景、光影、影像风格】（用于保持风格一致）
${sceneContext || '（无）'}

${otherScene ? `【另一日本场景】可选用：${otherScene}\n` : ''}

【人物基本特征】（提示词中必须符合，与第一步参考图一致）
- 性别：${characterGender || '（未指定）'}
- 发色/发型：${characterHairColor || '（未指定）'}
描述人物时请使用上述特征，例如「年轻${characterGender || '女性'}」「${characterHairColor || '长发'}」等，不要单独写「女孩」。

【核心要求】
1. 第 1 组提示词对应第 1 段爱欲现场、第 2 组对应第 2 段……共 5 组与 5 段一一对应；场景与情绪需与该段相符。
2. 五组场景均不得使用「主场景拓展」里已用过的空间/场景，须为爱欲现场中的其它场景（可与 5 段中的地点、氛围一致）。
3. 人物正处在某种「充满情绪的、温柔暧昧的状态」，语气温和，不要使用露骨或明显情欲、诱惑等词汇。
4. 人物状态只能是以下之一：思念的、悲伤的、喜悦的、害羞的、温柔的、渴望的、放空的。不要写她在做具体动作。
5. 与镜头的关系可多样化；在画面中的位置不必在正中央；视觉风格与参考图一致；中景或近景。

请直接输出一个 JSON 数组，包含 5 个中文字符串，每个字符串是一组可直接用于图生图的场景提示词。不要输出 markdown 代码块，只输出纯 JSON：
["第一组提示词（对应第1段）", "第二组提示词（对应第2段）", "第三组提示词（对应第3段）", "第四组提示词（对应第4段）", "第五组提示词（对应第5段）"]`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text()?.trim() || '';
    if (text.startsWith('```')) {
      text = text.replace(/^```\w*\n?/, '').replace(/\n?```$/, '');
    }
    const prompts: string[] = JSON.parse(text);
    if (!Array.isArray(prompts) || prompts.length < 5) {
      return NextResponse.json({ error: 'Invalid prompts format' }, { status: 500 });
    }

    return NextResponse.json({
      prompts: prompts.slice(0, 5).map((p, i) => ({ id: `desire-${i + 1}`, prompt: p, imageUrl: null })),
    });
  } catch (e) {
    console.error('generate-desire-scene-prompts error:', e);
    return NextResponse.json({ error: 'Failed to generate desire scene prompts' }, { status: 500 });
  }
}
