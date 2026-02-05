import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

const VIDEO_UPLOADS_DIR = path.join(process.cwd(), 'output', 'video_uploads');

/**
 * 为第五步生视频上传图片至图床（本地存储），返回可被 xAI 调用的图片 URL。
 * xAI 视频 API 需要图片的公开 URL；若应用部署在公网，返回的 URL 可被 xAI 访问；
 * 若在本地运行，xAI 无法访问 localhost，需部署或使用外部图床。
 * POST: { image: data URL (base64) }
 * 返回: { url: 图片访问地址, needPublicUrl?: 是否需公网地址（本地时为 true） }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { image } = body;
    if (!image || typeof image !== 'string') {
      return NextResponse.json({ error: 'Missing image (data URL)' }, { status: 400 });
    }

    const base64Match = image.match(/^data:image\/\w+;base64,(.+)$/);
    const base64Data = base64Match ? base64Match[1] : image;
    const mimeType = image.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg';
    const ext = mimeType === 'image/png' ? 'png' : 'jpg';

    await mkdir(VIDEO_UPLOADS_DIR, { recursive: true });
    const id = randomUUID();
    const filename = `${id}.${ext}`;
    const filepath = path.join(VIDEO_UPLOADS_DIR, filename);
    await writeFile(filepath, Buffer.from(base64Data, 'base64'));

    const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
    const proto = request.headers.get('x-forwarded-proto') || (request.nextUrl?.protocol?.replace(/:$/, '') || 'http');
    const origin = host ? `${proto}://${host}` : (request.nextUrl?.origin || '');
    const baseUrl = origin || '';
    const url = baseUrl ? `${baseUrl}/api/serve-upload?id=${id}` : `/api/serve-upload?id=${id}`;
    const needPublicUrl = !baseUrl || baseUrl.includes('localhost');

    return NextResponse.json({
      url: url.startsWith('http') ? url : (origin ? `${origin}${url}` : url),
      id,
      needPublicUrl,
    });
  } catch (e) {
    console.error('upload-for-video error:', e);
    return NextResponse.json({ error: '上传失败' }, { status: 500 });
  }
}
