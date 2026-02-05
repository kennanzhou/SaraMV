import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, readdir, readFile } from 'fs/promises';
import path from 'path';
import { getPromptsConfig, applyMusicTemplate } from '@/app/lib/promptsConfig';

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
    const { keywords, keywordId, context, fullContext } = await request.json();

    if (!keywords || !context) {
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

    const promptsConfig = await getPromptsConfig();
    const systemPrompt = applyMusicTemplate(
      promptsConfig.musicPromptTemplate,
      context,
      keywords,
      fullContext ?? ''
    );

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

    // Generate filename
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = now.toTimeString().slice(0, 5).replace(':', '');
    const safeKeyword = keywords.slice(0, 15).replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '');
    const paddedId = String(keywordId).padStart(3, '0');
    
    // Find existing versions
    const files = await readdir(PROMPT_DIR).catch(() => []);
    const versionPattern = new RegExp(`^${paddedId}_${safeKeyword}_${dateStr}_\\d{4}_V(\\d+)\\.csv$`);
    let maxVersion = 0;
    for (const file of files) {
      const match = file.match(versionPattern);
      if (match) {
        const v = parseInt(match[1]);
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

    // Also save as JSON for easier parsing
    const jsonFilepath = filepath.replace('.csv', '.json');
    await writeFile(jsonFilepath, JSON.stringify({
      filename,
      version: nextVersion,
      data,
      createdAt: now.toISOString(),
      metadata: { keywords, keywordId, context, fullContext },
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
    console.error('Prompt generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate prompt' },
      { status: 500 }
    );
  }
}
