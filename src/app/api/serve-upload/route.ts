import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

const VIDEO_UPLOADS_DIR = path.join(process.cwd(), 'output', 'video_uploads');

/**
 * GET ?id=uuid 返回已上传的图片（供 xAI 视频 API 拉取）。
 * 仅当应用在公网可访问时，xAI 才能访问此地址。
 */
export async function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id');
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      return new NextResponse('Bad Request', { status: 400 });
    }
    const filepath = path.join(VIDEO_UPLOADS_DIR, `${id}.jpg`);
    try {
      const buf = await readFile(filepath);
      return new NextResponse(buf, {
        headers: { 'Content-Type': 'image/jpeg' },
      });
    } catch {
      const pngPath = path.join(VIDEO_UPLOADS_DIR, `${id}.png`);
      const buf = await readFile(pngPath);
      return new NextResponse(buf, {
        headers: { 'Content-Type': 'image/png' },
      });
    }
  } catch (e) {
    console.error('serve-upload error:', e);
    return new NextResponse('Not Found', { status: 404 });
  }
}
