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

export async function POST(request: NextRequest) {
  try {
    const { fullContext, lyrics } = await request.json();

    if (!fullContext || !lyrics) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const apiKey = await getApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: 'API Key not configured' }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `你是一位才华横溢的女性视角小说作家，擅长书写细腻、感性、充满电影感的私密情感故事。

【灵感来源】
情境描述 [fullContext]：
${fullContext}

最终选定版本的日文歌词：
${lyrics}

【创作任务】
请基于上述 [fullContext] 和日文歌词，创作「5 段」带编号的情节连续、情绪丰富的爱欲现场。每段约 180 字，场景完全不同但符合歌词逻辑，女性视角的私密情感场景。

【核心要求 - 请严格遵守】
1. **女性视角**：每段从女孩的视角展开，表达她的寂寞、思念、欲望、对爱与亲密的渴求、对亲密关系的怀念等。
2. **5 段编号**：输出格式为「1. …」「2. …」「3. …」「4. …」「5. …」，共 5 段，每段约 180 字。
3. **情节连续、情绪丰富**：5 段在情节或情绪上连贯，但每段场景完全不同（不同地点、不同时刻、不同情境）。
4. **故事中不能出现男性的正面形象**。若有男性，仅可写：手、后脑、肩头、背影等局部或抽象描述（如「一只手握住她的手」「凌乱头发的背影」「靠在他的肩头」）。禁止出现男性的脸或完整身体描写。
5. **主题**：可以是回忆、欲望、爱情、两性关系、亲密体验等，情绪与 [fullContext] 表达的情绪相符。
6. 必须使用第一人称「我」的视角叙述，语言感性、暧昧、有电影画面感。

【输出格式】
直接输出 5 段文字，每段以编号开头（1. 2. 3. 4. 5.），段与段之间空一行。不要输出「【另一场景】」或其它标记。`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text().trim();

    // 解析 5 段：按 "1." "2." "3." "4." "5." 分割
    const segments: string[] = [];
    const regex = /([1-5])\.\s*([\s\S]*?)(?=\s*[1-5]\.\s*|$)/g;
    let m;
    while ((m = regex.exec(text)) !== null) {
      segments.push(m[2].trim());
    }
    // 若正则未匹配满 5 段，则按换行分割带编号的行
    if (segments.length < 5) {
      const lines = text.split(/\n\n+/);
      segments.length = 0;
      for (let i = 1; i <= 5; i++) {
        const line = lines.find((l) => l.trim().startsWith(`${i}.`));
        segments.push(line ? line.replace(new RegExp(`^${i}\\.\\s*`), '').trim() : '');
      }
    }
    const padded = segments.slice(0, 5);
    while (padded.length < 5) padded.push('');

    const story = padded.map((s, i) => `${i + 1}. ${s}`).join('\n\n');
    const otherScene = ''; // 新方案不再单独生成「另一场景」，由 5 段内容覆盖

    return NextResponse.json({
      success: true,
      story,
      segments: padded,
      otherScene: otherScene || undefined,
    });
  } catch (error) {
    console.error('Story generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate story' },
      { status: 500 }
    );
  }
}
