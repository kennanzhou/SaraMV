import { NextRequest, NextResponse } from 'next/server';
import { readFile, mkdir, writeFile } from 'fs/promises';
import path from 'path';

const XAI_VIDEO_BASE = 'https://api.x.ai/v1/videos';
const MODEL = 'grok-imagine-video';

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

/**
 * 按 xAI 文档：先 POST 提交生成请求得到 request_id，再轮询 GET 获取视频 URL，
 * 下载视频并保存到 step3OutputBaseDir/VIDEO/ 目录。
 * POST body: { imageUrl, prompt, resolution?, duration?, aspectRatio?, step3OutputBaseDir? }
 * 参考：https://docs.x.ai/docs/guides/video-generation
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      imageUrl,
      prompt,
      resolution = '720p',
      duration = 10,
      aspectRatio = '16:9',
      step3OutputBaseDir,
    } = body;

    if (!imageUrl || typeof imageUrl !== 'string' || !prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Missing imageUrl or prompt' },
        { status: 400 }
      );
    }

    const apiKey = await getGrokApiKey();
    if (!apiKey) {
      return NextResponse.json(
        { error: '请先在设置中配置 Grok API Key' },
        { status: 400 }
      );
    }

    // 1) POST 提交视频生成请求（从图片 + 提示词）
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
        duration: Math.min(15, Math.max(1, Number(duration) || 10)),
        aspect_ratio: aspectRatio,
        resolution: resolution === '1080p' ? '720p' : '720p', // 文档仅支持 720p、480p
      }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      let errMsg = '视频生成请求失败';
      try {
        const errJson = JSON.parse(errText);
        errMsg = errJson.error?.message || errJson.message || errText.slice(0, 200);
      } catch {
        errMsg = errText.slice(0, 300);
      }
      return NextResponse.json({ error: errMsg }, { status: createRes.status });
    }

    const createData = await createRes.json();
    const requestId = createData.request_id ?? createData.requestId;
    if (!requestId) {
      return NextResponse.json(
        { error: 'API 未返回 request_id' },
        { status: 502 }
      );
    }

    // 2) 轮询获取视频结果
    const maxAttempts = 120; // 约 10 分钟
    const pollIntervalMs = 5000;
    let videoUrl: string | null = null;

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, pollIntervalMs));

      const getRes = await fetch(`${XAI_VIDEO_BASE}/${requestId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      if (!getRes.ok) {
        const errText = await getRes.text();
        console.warn('grok-video poll error:', getRes.status, errText);
        continue;
      }

      const getData = await getRes.json();
      videoUrl = getData.url ?? getData.video_url ?? null;
      if (videoUrl) break;

      const status = getData.status ?? getData.state;
      if (status === 'failed' || status === 'error') {
        const errMsg = getData.error?.message ?? getData.message ?? '生成失败';
        return NextResponse.json({ error: errMsg }, { status: 502 });
      }
    }

    if (!videoUrl) {
      return NextResponse.json(
        { error: '视频生成超时，请稍后在 xAI 控制台查看' },
        { status: 504 }
      );
    }

    // 3) 下载视频并保存到 step3OutputBaseDir/VIDEO/
    let savedPath: string | undefined;
    try {
      const videoRes = await fetch(videoUrl);
      if (!videoRes.ok) throw new Error('下载视频失败');
      const videoBuffer = Buffer.from(await videoRes.arrayBuffer());

      if (step3OutputBaseDir && typeof step3OutputBaseDir === 'string' && step3OutputBaseDir.trim()) {
        const baseDir = path.resolve(process.cwd(), step3OutputBaseDir.trim());
        const videoDir = path.join(baseDir, 'VIDEO');
        await mkdir(videoDir, { recursive: true });
        const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
        const filename = `video_${timestamp}.mp4`;
        const filepath = path.join(videoDir, filename);
        await writeFile(filepath, videoBuffer);
        savedPath = path.relative(process.cwd(), filepath);
      }
    } catch (saveErr) {
      console.warn('grok-video save failed:', saveErr);
      // 保存失败仍返回视频 URL
    }

    return NextResponse.json({
      videoUrl,
      savedPath,
    });
  } catch (e) {
    console.error('grok-video error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '视频生成失败' },
      { status: 500 }
    );
  }
}
