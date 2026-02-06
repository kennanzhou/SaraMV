import { NextRequest, NextResponse } from 'next/server';
import { readFile, mkdir, writeFile } from 'fs/promises';
import path from 'path';

const MUREKA_BASE = 'https://api.mureka.ai/v1';

async function getMurekaApiKey(): Promise<string> {
  try {
    const configPath = path.join(process.cwd(), 'config', 'settings.json');
    const content = await readFile(configPath, 'utf8');
    const settings = JSON.parse(content);
    return settings.murekaApiKey || process.env.MUREKA_API_KEY || '';
  } catch {
    return process.env.MUREKA_API_KEY || '';
  }
}

/**
 * POST: 提交歌曲生成任务
 * Body: { lyrics, stylePrompt, model?, title? }
 *
 * Mureka 原生 API (api.mureka.ai) 参数:
 *   - lyrics: 歌词（支持 [Verse] [Chorus] 等标记）
 *   - model: "auto" (默认，自动选择最新模型如 mureka-6)
 *   - prompt: 风格描述（如 "r&b, slow, passionate, male vocal"）
 *
 * 返回 id，前端轮询 GET /api/mureka-song?taskId=xxx
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      lyrics,
      stylePrompt,
      model = 'auto',
      title,
    } = body;

    if (!lyrics || typeof lyrics !== 'string') {
      return NextResponse.json({ error: '缺少歌词 (lyrics)' }, { status: 400 });
    }

    const apiKey = await getMurekaApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: '请先在设置中配置 Mureka API Key' }, { status: 400 });
    }

    // 映射前端模型名 → Mureka 原生 API 模型名
    // V8/O1/O2 是第三方 useapi.net 的命名，原生 API 使用 "auto" / "mureka-6" 等
    const modelMap: Record<string, string> = {
      V8: 'auto',
      O1: 'auto',
      O2: 'auto',
      auto: 'auto',
    };
    const apiModel = modelMap[model] || 'auto';

    // 构造 Mureka 原生 API 请求体
    const reqBody: Record<string, unknown> = {
      lyrics: lyrics.slice(0, 5000),
      model: apiModel,
    };

    // 风格描述 → prompt 字段（不是 desc）
    if (stylePrompt && typeof stylePrompt === 'string' && stylePrompt.trim()) {
      reqBody.prompt = stylePrompt.trim().slice(0, 1000);
    }

    console.log('[mureka] 提交歌曲生成, 前端模型:', model, '→ API模型:', apiModel, ', 歌词长度:', lyrics.length);
    console.log('[mureka] 请求体:', JSON.stringify(reqBody).slice(0, 800));

    const res = await fetch(`${MUREKA_BASE}/song/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(reqBody),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[mureka] 提交失败:', res.status, errText);

      // 如果是 400 且有 title，尝试去掉 title 重试
      // （title 可能不是原生 API 支持的参数）
      return NextResponse.json(
        { error: `Mureka 提交失败 (${res.status}): ${errText}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    console.log('[mureka] 提交成功, 返回:', JSON.stringify(data).slice(0, 500));

    // Mureka 原生 API 返回格式:
    // 异步: { id: "1436211", created_at: ..., model: "mureka-7.6", status: "preparing", trace_id: "..." }
    // 同步: { id: ..., status: "succeeded", choices: [{ url, flac_url, duration(ms), ... }] }
    const taskId = data.id || data.task_id || data.taskId;

    // 检查是否同步完成（choices/songs 已返回）
    const rawSongs = data.choices || data.songs || data.result?.songs || [];
    if (rawSongs.length > 0) {
      return NextResponse.json({
        taskId,
        status: 'completed',
        songs: rawSongs.map((s: { url?: string; mp3_url?: string; flac_url?: string; title?: string; duration?: number }, i: number) => ({
          url: s.url || s.mp3_url || s.flac_url,
          title: s.title || title || `歌曲 ${i + 1}`,
          // duration 可能是毫秒（如 148110）也可能是秒，>1000 认为是毫秒
          duration: s.duration ? (s.duration > 1000 ? s.duration / 1000 : s.duration) : undefined,
        })),
      });
    }

    // 异步任务已创建，返回 taskId 给前端轮询
    return NextResponse.json({
      taskId,
      status: data.status || 'preparing',
    });
  } catch (e) {
    console.error('[mureka] POST error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '歌曲生成请求失败' },
      { status: 500 }
    );
  }
}

/**
 * GET: 查询歌曲生成任务状态
 * Query: ?taskId=xxx&step3OutputBaseDir=xxx
 *
 * 调用 GET /v1/song/query/{task_id}
 * 如果完成，下载音频并保存到本地
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');
    const step3OutputBaseDir = searchParams.get('step3OutputBaseDir');
    const keywordId = searchParams.get('keywordId');
    const coreWord = searchParams.get('coreWord');

    if (!taskId) {
      return NextResponse.json({ error: '缺少 taskId' }, { status: 400 });
    }

    const apiKey = await getMurekaApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: '请先配置 Mureka API Key' }, { status: 400 });
    }

    const queryUrl = `${MUREKA_BASE}/song/query/${taskId}`;
    console.log('[mureka] 查询任务:', queryUrl);

    const res = await fetch(queryUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[mureka] 查询失败:', res.status, errText);
      return NextResponse.json(
        { error: `查询失败 (${res.status}): ${errText}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    console.log('[mureka] 查询结果:', JSON.stringify(data).slice(0, 500));
    const status = data.status || 'unknown';

    // Mureka 原生 API 返回结构：
    // { id, status: "succeeded"/"preparing"/"running"/"failed", choices: [{ url, flac_url, duration(ms), ... }] }
    const rawSongs = data.choices || data.songs || data.result?.songs || [];
    const songs: Array<{ url: string; title?: string; duration?: number }> = rawSongs.map(
      (s: { url?: string; mp3_url?: string; flac_url?: string; title?: string; duration?: number }) => ({
        url: s.url || s.mp3_url || s.flac_url || '',
        title: s.title,
        // duration 可能是毫秒（如 148110）也可能是秒，>1000 认为是毫秒
        duration: s.duration ? (s.duration > 1000 ? s.duration / 1000 : s.duration) : undefined,
      })
    ).filter((s: { url: string }) => s.url);

    // "succeeded" 是 Mureka 原生 API 表示完成的状态
    const isComplete = status === 'succeeded' || status === 'completed' || status === 'complete' || songs.length > 0;

    if (isComplete && songs.length > 0) {
      // 下载并保存到本地（与照片相同的命名规则和项目目录）
      const savedPaths: string[] = [];
      const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);

      for (let i = 0; i < songs.length; i++) {
        const song = songs[i];
        if (!song.url) continue;
        try {
          const audioRes = await fetch(song.url);
          const buffer = Buffer.from(await audioRes.arrayBuffer());

          // 与照片一致：保存到项目目录/MUSIC/
          // 优先级：step3OutputBaseDir > 由 keywordId+coreWord 构建 > 回退 output/music/
          let saveDir: string;
          if (step3OutputBaseDir) {
            saveDir = path.resolve(process.cwd(), step3OutputBaseDir, 'MUSIC');
          } else if (keywordId && coreWord) {
            // 与 generate-scene-image 相同的目录构建方式
            const YYYYMMDD = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const safeCore = String(coreWord).replace(/[/\\:*?"<>|]/g, '_').slice(0, 30);
            const dirName = `${String(keywordId).padStart(3, '0')}_${safeCore}_${YYYYMMDD}`;
            saveDir = path.join(process.cwd(), 'output', 'scene', dirName, 'MUSIC');
          } else {
            saveDir = path.join(process.cwd(), 'output', 'music');
          }
          await mkdir(saveDir, { recursive: true });

          // 命名与照片一致：song_{序号}_{YYYYMMDDHHmmss}.ext
          const ext = song.url.includes('.wav') ? 'wav' : 'mp3';
          const num = String(i + 1).padStart(2, '0');
          const filename = `song_${num}_${timestamp}.${ext}`;
          const filepath = path.join(saveDir, filename);
          await writeFile(filepath, buffer);
          savedPaths.push(path.relative(process.cwd(), filepath));
          console.log('[mureka] 已保存:', filepath);
        } catch (saveErr) {
          console.error('[mureka] 保存音频失败:', saveErr);
        }
      }

      return NextResponse.json({
        status: 'completed',
        songs: songs.map((s, i) => ({
          url: s.url,
          title: s.title || `歌曲 ${i + 1}`,
          duration: s.duration,
          savedPath: savedPaths[i] || undefined,
        })),
      });
    }

    // 未完成或失败
    const isFailed = status === 'failed' || status === 'error' || status === 'cancelled';
    return NextResponse.json({
      status: isFailed ? 'failed' : 'pending',
      message: data.message || data.error || undefined,
    });
  } catch (e) {
    console.error('[mureka] GET error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '查询失败' },
      { status: 500 }
    );
  }
}
