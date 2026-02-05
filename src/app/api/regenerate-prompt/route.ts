import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, readdir, readFile } from 'fs/promises';
import path from 'path';

// 从配置文件读取设置
async function getSettings(): Promise<{ apiKey: string; promptDir: string }> {
  try {
    const configPath = path.join(process.cwd(), 'config', 'settings.json');
    const content = await readFile(configPath, 'utf8');
    const settings = JSON.parse(content);
    return {
      apiKey: settings.geminiApiKey || process.env.GEMINI_API_KEY || '',
      promptDir: settings.promptOutputDir || process.env.PROMPT_DIR || path.join(process.cwd(), 'output', 'prompts'),
    };
  } catch {
    return {
      apiKey: process.env.GEMINI_API_KEY || '',
      promptDir: process.env.PROMPT_DIR || path.join(process.cwd(), 'output', 'prompts'),
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const { previousVersion, feedback } = await request.json();

    if (!previousVersion || !feedback) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const { apiKey, promptDir: PROMPT_DIR } = await getSettings();
    if (!apiKey) {
      return NextResponse.json({ error: 'API Key not configured' }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const systemPrompt = `Role: 顶级 AI 音乐监制、意象派词人。
Task: 根据用户反馈，修改并优化之前生成的音乐提示词。

【之前版本的内容】
Style Prompt: ${previousVersion.data.stylePrompt}
Style Prompt CN: ${previousVersion.data.stylePromptCN}
Lyrics: ${previousVersion.data.lyrics}
Lyrics CN: ${previousVersion.data.lyricsCN}

【用户反馈】
${feedback}

【Engine Rules 8.1】
1. Vocal Spectrum: 根据情境选择 Breathy, Smoky, Velvety 等性感声线。
2. Style Matrix: 必须具有电影感 (Cinematic, Atmospheric)。
3. Poetic Logic: 意象具体 (Show, Don't Tell)，感官化 (湿润、热度、气味)。
4. Lyrics Engineering: 
   - 歌词原文：日文为主（严格押韵），偶尔出现的英文也要押韵（与相邻句或段内形成押韵或音韵呼应）。
   - **核心词汇（Keywords）必须出现在 Chorus 段落中**，且自然融入。
   - **严禁**在歌词原文中包含罗马音、翻译或括号注释。
   - 歌词必须分段 (Intro, Verse, Chorus...)。
   - 尺度：Sensual & Erotic (性感、露骨但艺术)。

请根据用户反馈进行修改，保持原有的优点，改进不足之处。

【Output JSON Format】
必须输出纯 JSON 格式，不要包含 Markdown 代码块标记：
{
  "stylePrompt": "英文风格提示词",
  "stylePromptCN": "风格提示词的中文翻译",
  "lyrics": "歌词原文 (保留换行)",
  "lyricsCN": "歌词的中文翻译 (必须与原文逐行对应，保留换行和结构标记)"
}`;

    const result = await model.generateContent(systemPrompt);
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

    // Validate result
    if (!data.stylePrompt || !data.lyrics) {
      throw new Error('Incomplete response from AI');
    }

    // Ensure output directory exists
    await mkdir(PROMPT_DIR, { recursive: true });

    // Parse previous filename to extract info
    const prevFilename = previousVersion.filename;
    const match = prevFilename.match(/^(\d+)_(.+)_(\d{8})_\d{4}_V(\d+)\.csv$/);
    
    if (!match) {
      throw new Error('Invalid previous filename format');
    }

    const [, paddedId, safeKeyword, dateStr, prevVersionNum] = match;
    const now = new Date();
    const timeStr = now.toTimeString().slice(0, 5).replace(':', '');
    
    // Find the next version number
    const files = await readdir(PROMPT_DIR).catch(() => []);
    const versionPattern = new RegExp(`^${paddedId}_${safeKeyword}_${dateStr}_\\d{4}_V(\\d+)\\.csv$`);
    let maxVersion = parseInt(prevVersionNum);
    for (const file of files) {
      const fileMatch = file.match(versionPattern);
      if (fileMatch) {
        const v = parseInt(fileMatch[1]);
        if (v > maxVersion) maxVersion = v;
      }
    }
    const nextVersion = `V${String(maxVersion + 1).padStart(2, '0')}`;
    
    const filename = `${paddedId}_${safeKeyword}_${dateStr}_${timeStr}_${nextVersion}.csv`;
    const filepath = path.join(PROMPT_DIR, filename);

    // Build CSV content
    const escapeCsv = (str: string) => `"${str.replace(/"/g, '""')}"`;
    const csvContent = `字段,原文,中文翻译
stylePrompt,${escapeCsv(data.stylePrompt)},${escapeCsv(data.stylePromptCN)}
lyrics,${escapeCsv(data.lyrics)},${escapeCsv(data.lyricsCN)}`;

    await writeFile(filepath, csvContent, 'utf8');

    // Also save as JSON
    const jsonFilepath = filepath.replace('.csv', '.json');
    await writeFile(jsonFilepath, JSON.stringify({
      filename,
      version: nextVersion,
      data,
      createdAt: now.toISOString(),
      feedback,
      previousVersion: prevFilename,
    }, null, 2), 'utf8');

    return NextResponse.json({
      success: true,
      version: {
        filename,
        version: nextVersion,
        data,
        createdAt: now.toISOString(),
      },
    });
  } catch (error) {
    console.error('Prompt regeneration error:', error);
    return NextResponse.json(
      { error: 'Failed to regenerate prompt' },
      { status: 500 }
    );
  }
}
