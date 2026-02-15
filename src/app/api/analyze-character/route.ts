import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';
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
 * 分析参考图中的人物特征，返回详细的人物特征描述文字。
 * POST: { image: string (data URL) }
 * 返回: { characterDescription: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { image } = await request.json();

    if (!image) {
      return NextResponse.json({ error: '未提供图片' }, { status: 400 });
    }

    const apiKey = await getApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: '未配置 Gemini API Key' }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const { data: base64Data, mimeType } = parseDataUrl(image);

    const modelNames = ['gemini-2.0-flash', 'gemini-1.5-flash'];
    let model = null;
    for (const modelName of modelNames) {
      try {
        model = genAI.getGenerativeModel({ model: modelName });
        break;
      } catch {
        continue;
      }
    }
    if (!model) {
      model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    }

    const prompt = `你是一位专业的人物外形分析师。请仔细观察这张图片中的人物，详细描述以下特征，用于后续AI图片生成时保持人物一致性。

请用**简洁精确的中文**描述以下五方面，每个方面一行，格式为"类别：描述内容"：

1. 面部特征：脸型、五官特点（眼睛形状/大小、鼻子、嘴唇、眉型等）、肤色、是否有痣/雀斑等标志性特征
2. 种族特征：判断人物的种族/民族外观特征（如东亚、东南亚、欧美白人、混血等）
3. 年龄特征：估算年龄范围及面部年龄感（如"约20-22岁，面容年轻稚嫩"）
4. 体貌特征：身材体型（纤细/丰满/匀称等）、身高感、肩宽、体态姿态等可见特征
5. 其他特征：发型发色、当前妆容风格、气质类型（清冷/甜美/知性等）、其他显著辨识特征

要求：
- 只描述图片中可见的客观特征，不要编造
- 语言精确简练，避免主观评价
- 每个类别的描述控制在一行内（约30-60字）
- 直接输出5行描述，不要加额外说明`;

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
    const text = response.text().trim();

    return NextResponse.json({ characterDescription: text });
  } catch (error) {
    console.error('Analyze character error:', error);
    return NextResponse.json(
      { error: '人物特征分析失败，请重试' },
      { status: 500 }
    );
  }
}
