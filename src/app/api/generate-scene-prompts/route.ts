import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { readFile } from 'fs/promises';
import path from 'path';
import { parseDataUrl } from '@/app/lib/dataUrlUtils';

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
 * 根据【SCENECONTEST】生成五组场景拓展提示词。
 * 考虑空间相邻的连续空间或其它角度；严格保持光影、影像风格一致；
 * 人物特征与参考图一致，人物状态可与爱欲现场主题相关，中景或近景、面向镜头。
 */
export async function POST(request: NextRequest) {
  try {
    const { image, sceneContext, fullContext, characterGender, characterHairColor, sceneDescription } = await request.json();
    if (!image || typeof image !== 'string') {
      return NextResponse.json({ error: 'Missing image' }, { status: 400 });
    }

    const apiKey = await getApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: 'API Key not configured' }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const { data: base64Data, mimeType } = parseDataUrl(image);

    const personDesc = [characterGender, characterHairColor].filter(Boolean).join('、') || '人物';
    const sceneBase = sceneDescription?.trim() || '（无）';

    const prompt = `你是一位日本优秀的私房/少女写真摄影师的视觉顾问。根据附件中的参考图片和下面的信息，生成「五组」场景拓展提示词。所有提示词必须使用中文。

【场景基础】第一步提取的场景一句话描述（用于判断整体空间类型，如公寓、独居、酒吧等）：
${sceneBase}

【重要 - 五组必须是「不同空间」，不是同一房间的五个角度】
请根据上述场景基础，推断整体空间类型（例如：公寓、独居、一户建、酒吧、喫茶店等）。然后由你作为日本私房摄影师决定：在这个整体空间里，女孩还会在哪些「不同房间/不同区域」进行拍摄？
- 五条提示词必须分别对应「五个不同的空间/房间」，例如：厨房、卧室、玄关、浴室、阳台、客厅、走廊、窗边等。不要拘泥于示例，由你根据空间类型自由决定还有哪些适合私房写真的区域。
- 禁止五条都描述同一个房间（例如不能五条全是厨房）。每条对应一个明确不同的空间。
- 若参考图已是某一房间（如厨房），则第一组可保留该房间，其余四组必须是其他房间或区域。

【参考信息】
- 场景、光影、影像风格分析：${sceneContext || '（无）'}
- 文学性描述（人物状态、环境、氛围）：${fullContext || '（无）'}

【人物基本特征】（提示词中必须符合，与参考图一致）
- 性别：${characterGender || '（未指定）'}
- 发色/发型：${characterHairColor || '（未指定）'}
描述人物时请使用上述特征，不要单独写「女孩」，可写「年轻${characterGender || '女性'}」「${characterHairColor || '长发'}」等与参考图一致。

【核心要求】
1. 每条提示词明确写出所在空间（如厨房、卧室、玄关等），且五条空间互不重复。
2. 人物正处在某种「充满情绪的、温柔暧昧的状态」，不是在具体做某件事。语气温和，不要使用露骨或明显情欲、诱惑等词汇，用含蓄、私密感、氛围感等替代。
3. 人物状态只能是以下之一（选一种）：思念的、悲伤的、喜悦的、害羞的、温柔的、渴望的、放空的。不要写她在做具体动作。
4. 脸微微侧或抬头低头，位置不必在正中央，构图自然。
5. 严格保持光影、影像风格与参考图一致；人物特征与参考图完全一致。中景或近景。

请直接输出一个 JSON 数组，包含 5 个中文字符串，每个字符串是一组可直接用于图生图的场景提示词。不要输出 markdown 代码块，只输出纯 JSON：
["第一组提示词（空间A）", "第二组提示词（空间B）", "第三组提示词（空间C）", "第四组提示词（空间D）", "第五组提示词（空间E）"]`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: { mimeType, data: base64Data },
      },
    ]);
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
      prompts: prompts.slice(0, 5).map((p, i) => ({ id: `scene-${i + 1}`, prompt: p, imageUrl: null })),
    });
  } catch (e) {
    console.error('generate-scene-prompts error:', e);
    return NextResponse.json({ error: 'Failed to generate scene prompts' }, { status: 500 });
  }
}
