import { NextRequest, NextResponse } from 'next/server';
import { readFile, mkdir, writeFile } from 'fs/promises';
import path from 'path';

const XAI_VIDEO_BASE = 'https://api.x.ai/v1/videos';
const MODEL = 'grok-imagine-video';

// 设置超时：Vercel 免费版是 10s，Pro 是 60s，本地无限制
// 如果你部署在 Vercel，必须在配置文件设置 maxDuration
export const maxDuration = 60; 

async function getGrokApiKey(): Promise<string> {
  try {
    const configPath = path.join(process.cwd(), 'config', 'settings.json');
    const content = await readFile(configPath, 'utf8');
    const settings = JSON.parse(content);
    return settings.grokApiKey || process.env.GROK_API_KEY || '';
  } catch {
    return process.env.GROK_API_KEY || '';
  }
}

// 封装一个异步等待函数，防止阻塞栈
const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    console.log("111111111111111111111111111111", body)
    const {
      imageUrl,
      prompt,
      resolution = '720p',
      duration = 10,
      aspectRatio = '16:9',
      step3OutputBaseDir,
    } = body;

    // 1. 参数校验
    if (!imageUrl || !prompt) {
      return NextResponse.json({ error: 'Missing imageUrl or prompt' }, { status: 400 });
    }

    const apiKey = await getGrokApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: '请先配置 Grok API Key' }, { status: 400 });
    }

    // 2. 提交生成任务
    const createRes = await fetch(`${XAI_VIDEO_BASE}/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        prompt,
        model: MODEL,
        image: { url: imageUrl },
        duration: Math.min(15, Math.max(1, Number(duration))),
        aspect_ratio: aspectRatio,
        resolution: '720p',
      }),
    });

    console.log("2222222222222222222222222222222222", createRes)

    if (!createRes.ok) {
      const errText = await createRes.text();
      return NextResponse.json({ error: `提交失败: ${errText}` }, { status: createRes.status });
    }

    const { request_id: requestId } = await createRes.json();

    console.log("333333333333333333333333333333", requestId)
    // 3. 后端内部轮询 (注意：这里必须小心处理超时)
    let videoUrl = '';
    const startTime = Date.now();
    const TIMEOUT_LIMIT = 55000; // 55秒超时保护（适配 Vercel Pro）

    while (!videoUrl) {
      // 检查总耗时，防止 API 永远不返回导致服务器挂掉
      if (Date.now() - startTime > TIMEOUT_LIMIT) {
        return NextResponse.json({ 
            error: '任务处理时间过长，请稍后检查', 
            requestId 
        }, { status: 202 }); 
      }

      await delay(5000); // 每次等 5 秒

      const pollRes = await fetch(`${XAI_VIDEO_BASE}/${requestId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      
      console.log("44444444444444444444444444444444", pollRes)

      if (!pollRes.ok) continue;

      const pollData = await pollRes.json();
      videoUrl = pollData.url || pollData.video_url || pollData.video?.url || '';

      console.log("555555555555555555555555555", pollData)
      console.log("666666666666666666666666666", videoUrl)
      const status = pollData.status || pollData.state;
      if (status === 'failed' || status === 'error') {
        return NextResponse.json({ error: 'Grok 生成视频失败' }, { status: 502 });
      }
    }

    // 4. 下载并保存
    let savedPath = '';
    if (step3OutputBaseDir) {
      try {
        const videoRes = await fetch(videoUrl);
        const buffer = Buffer.from(await videoRes.arrayBuffer());
        const videoDir = path.resolve(process.cwd(), step3OutputBaseDir, 'VIDEO');
        await mkdir(videoDir, { recursive: true });
        const filename = `video_${Date.now()}.mp4`;
        const filepath = path.join(videoDir, filename);
        await writeFile(filepath, buffer);
        savedPath = path.relative(process.cwd(), filepath);
      } catch (e) {
        console.error('Save failed:', e);
      }
    }

    return NextResponse.json({ videoUrl, savedPath });

  } catch (e: any) {
    console.error('Main error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}