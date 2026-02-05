import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

// 从配置文件读取 API Key
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

export async function POST(request: NextRequest) {
  try {
    const { image } = await request.json();

    if (!image) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    const apiKey = await getApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: 'API Key not configured. Please set it in Settings.' }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    // Extract base64 data from data URL
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const mimeType = image.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg';

    // 尝试使用不同的模型名称
    const modelNames = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-pro-vision', 'gemini-1.5-pro-latest'];
    let model = null;
    let lastError = null;

    for (const modelName of modelNames) {
      try {
        model = genAI.getGenerativeModel({ model: modelName });
        break;
      } catch (e) {
        lastError = e;
        continue;
      }
    }

    if (!model) {
      // 如果都失败，默认使用 gemini-2.0-flash
      model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    }

    const prompt = `你是一位专业的视觉分析师和文学创作者。请仔细观察这张图片，并完成以下任务：

任务一【characterGender】：人物的基本性别特征。用中文一个词：如「女性」「男性」等。

任务二【characterHairColor】：人物的发色。用简短中文描述，如「黑色长发」「棕色短发」「金色卷发」等。

任务三【sceneDescription】：用一句话（约 20～50 字）概括这张图的场景，例如：「狭小公寓里昏黄的夜灯下」「深夜便利店外的霓虹灯前」「老旧酒吧吧台旁的暖光中」。要包含场景类型与氛围，用于后续在同一空间或同一风格下拓展。

任务四【shortContext】：
用 6 个字以内，提炼出这张图片的意境核心词。必须是一句完整的话或一个词组（不要只写零散关键词），捕捉画面的本质氛围和主题。

任务五【fullContext】：
写一段约300字的文学性描述，需要包含以下四个方面：
1. 人物的状态与情绪：描述画面中人物的姿态、表情、内心状态
2. 环境与光影的描述：详细描述光线、阴影、色调、氛围
3. 画面中关键道具的描述：注意细节，如服装、配饰、物品等
4. 人物所处场景的类型与风格描述：是城市、自然、室内？风格是复古、现代、梦幻？

请用优美的文学语言，创造一种旖旎、暧昧、富有电影感的氛围。语言风格应该是感性的、诗意的，能够激发音乐创作的灵感。

任务六【sceneContext】：
分析这张照片的场景、光影和影像风格。假设这个场景在日本。请描述：
1. 场景类型（如：狭小的公寓、深夜便利店、老旧酒吧、街角咖啡馆等）
2. 光影特征（如：昏黄的室内灯光、霓虹灯的反射、清晨的柔光、深夜的蓝调等）
3. 影像风格（如：日系写实、胶片质感、电影感构图、lo-fi美学等）
4. 色调氛围（如：暖色调、冷色调、高对比度、低饱和度等）

这个描述将用于生成风格一致的其他场景，约200字。

请以JSON格式返回（不要包含markdown代码块标记）：
{
  "characterGender": "女性或男性等",
  "characterHairColor": "发色简短描述",
  "sceneDescription": "一句话场景概括",
  "shortContext": "6字以内的意境核心词（一句完整的话或一个词组）",
  "fullContext": "约300字的文学性描述",
  "sceneContext": "约200字的场景、光影、风格分析"
}`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType,
          data: base64Data,
        },
      },
    ]);

    const response = await result.response;
    let text = response.text();

    // Clean up potential markdown code blocks
    text = text.trim();
    if (text.startsWith('```json')) {
      text = text.replace(/^```json\n/, '').replace(/\n```$/, '');
    } else if (text.startsWith('```')) {
      text = text.replace(/^```\n/, '').replace(/\n```$/, '');
    }

    const data = JSON.parse(text);

    // TODO: 生成空场景图片（去掉人物）
    // 这需要使用 Gemini的图片编辑功能或其他图片处理 API
    // 目前先返回 null，后续实现
    const emptySceneImage = null;

    return NextResponse.json({
      characterGender: data.characterGender || '',
      characterHairColor: data.characterHairColor || '',
      sceneDescription: data.sceneDescription || '',
      shortContext: data.shortContext,
      fullContext: data.fullContext,
      sceneContext: data.sceneContext || '',
      emptySceneImage,
    });
  } catch (error) {
    console.error('Image analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze image' },
      { status: 500 }
    );
  }
}
