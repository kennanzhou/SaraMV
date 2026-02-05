import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';

const CONFIG_DIR = path.join(process.cwd(), 'config');
const CONFIG_FILE = path.join(CONFIG_DIR, 'settings.json');

// 默认设置
const defaultSettings = {
  geminiApiKey: '',
  promptOutputDir: '',
  grokApiKey: '',
  openaiApiKey: '',
  anthropicApiKey: '',
  sunoApiKey: '',
  murekaApiKey: '',
  runwayApiKey: '',
  pikaApiKey: '',
  // 阿里云 OSS（第五步视频生成图片上传）
  ossRegion: '',
  ossAccessKeyId: '',
  ossAccessKeySecret: '',
  ossBucket: '',
  ossCustomDomain: '', // 可选：自定义域名，留空则使用 OSS 默认域名
};

// GET - 读取设置
export async function GET() {
  try {
    const content = await readFile(CONFIG_FILE, 'utf8');
    const settings = JSON.parse(content);
    
    // 对 API Key 进行脱敏处理（只返回前4位和后4位）
    const maskedSettings: Record<string, string> = {};
    for (const [key, value] of Object.entries(settings)) {
      if ((key.includes('ApiKey') || key.includes('AccessKey') || key.endsWith('Secret')) && typeof value === 'string' && value.length > 8) {
        maskedSettings[key] = value.slice(0, 4) + '****' + value.slice(-4);
      } else {
        maskedSettings[key] = value as string;
      }
    }
    
    return NextResponse.json(maskedSettings);
  } catch (error) {
    // 文件不存在时返回默认设置
    return NextResponse.json(defaultSettings);
  }
}

// POST - 保存设置
export async function POST(request: NextRequest) {
  try {
    const newSettings = await request.json().catch(() => ({}));
    if (typeof newSettings !== 'object' || newSettings === null) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    // 确保配置目录存在
    await mkdir(CONFIG_DIR, { recursive: true });

    // 读取现有设置
    let existingSettings = { ...defaultSettings };
    try {
      const content = await readFile(CONFIG_FILE, 'utf8');
      existingSettings = { ...existingSettings, ...JSON.parse(content) };
    } catch {
      // 文件不存在，使用默认设置
    }

    // 合并设置（如果新值是脱敏的，保留原值）；以 defaultSettings 为基础，确保所有 key 都存在
    const mergedSettings: Record<string, string> = { ...defaultSettings };
    for (const [key, value] of Object.entries(newSettings)) {
      const strValue = typeof value === 'string' ? value : '';
      if ((key.includes('ApiKey') || key.includes('AccessKey') || key.endsWith('Secret')) && strValue.includes('****')) {
        // 脱敏值，保留原始值
        mergedSettings[key] = existingSettings[key as keyof typeof existingSettings] || '';
      } else {
        mergedSettings[key] = strValue;
      }
    }
    
    // 保存设置
    await writeFile(CONFIG_FILE, JSON.stringify(mergedSettings, null, 2), 'utf8');
    
    // 同时更新 .env.local 文件以便 API 路由使用
    const envContent = `# Auto-generated from settings panel
# Do not edit manually

GEMINI_API_KEY=${mergedSettings.geminiApiKey || ''}
PROMPT_DIR=${mergedSettings.promptOutputDir || ''}
GROK_API_KEY=${mergedSettings.grokApiKey || ''}
OPENAI_API_KEY=${mergedSettings.openaiApiKey || ''}
ANTHROPIC_API_KEY=${mergedSettings.anthropicApiKey || ''}
SUNO_API_KEY=${mergedSettings.sunoApiKey || ''}
MUREKA_API_KEY=${mergedSettings.murekaApiKey || ''}
RUNWAY_API_KEY=${mergedSettings.runwayApiKey || ''}
PIKA_API_KEY=${mergedSettings.pikaApiKey || ''}

# 阿里云 OSS
OSS_REGION=${mergedSettings.ossRegion || ''}
OSS_ACCESS_KEY_ID=${mergedSettings.ossAccessKeyId || ''}
OSS_ACCESS_KEY_SECRET=${mergedSettings.ossAccessKeySecret || ''}
OSS_BUCKET=${mergedSettings.ossBucket || ''}
OSS_CUSTOM_DOMAIN=${mergedSettings.ossCustomDomain || ''}
`;
    
    await writeFile(path.join(process.cwd(), '.env.local'), envContent, 'utf8');
    
    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Failed to save settings:', error);
    return NextResponse.json(
      { error: `保存失败: ${msg}` },
      { status: 500 }
    );
  }
}
