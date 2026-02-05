import { NextRequest, NextResponse } from 'next/server';
import { uploadImageToOss } from '@/app/lib/ossClient';

/**
 * 为第五步生视频上传图片至阿里云 OSS，返回公网可访问的预签名 URL（私有 bucket 也可用）。
 * 必须在设置中配置 OSS（Region、AccessKey、Bucket）。
 * POST: { image: data URL (base64) }
 * 返回: { url: 预签名 URL（外网可访问）, needPublicUrl: false, source: 'oss' }
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

    // 1. 优先尝试上传到阿里云 OSS（返回预签名 URL，私有 bucket 也可外网访问）
    const ossResult = await uploadImageToOss(base64Data, mimeType);
    if (ossResult.url) {
      const res = {
        url: ossResult.url,
        needPublicUrl: false,
        source: 'oss',
      };
      console.log('[upload-for-video] OSS 上传成功, 返回预签名 URL');
      return NextResponse.json(res);
    }

    // 2. OSS 失败：返回错误，提示用户配置或检查
    console.warn('[upload-for-video] OSS 失败:', ossResult.error);
    return NextResponse.json(
      { error: ossResult.error || 'OSS 上传失败，请检查设置中的 OSS 配置' },
      { status: 400 }
    );
  } catch (e) {
    console.error('upload-for-video error:', e);
    return NextResponse.json({ error: '上传失败' }, { status: 500 });
  }
}
