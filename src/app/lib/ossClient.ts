/**
 * 阿里云 OSS 上传工具
 * 从 config/settings.json 或环境变量读取配置
 */
import OSS from 'ali-oss';
import { readFile } from 'fs/promises';
import path from 'path';

export interface OssConfig {
  region: string;
  accessKeyId: string;
  accessKeySecret: string;
  bucket: string;
  customDomain?: string;
}

async function getOssConfig(): Promise<OssConfig | null> {
  const fromEnv = () => ({
    region: process.env.OSS_REGION || '',
    accessKeyId: process.env.OSS_ACCESS_KEY_ID || '',
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET || '',
    bucket: process.env.OSS_BUCKET || '',
    customDomain: process.env.OSS_CUSTOM_DOMAIN || undefined,
  });

  try {
    const configPath = path.join(process.cwd(), 'config', 'settings.json');
    const content = await readFile(configPath, 'utf8');
    const settings = JSON.parse(content);
    const cfg = {
      region: settings.ossRegion || process.env.OSS_REGION || '',
      accessKeyId: settings.ossAccessKeyId || process.env.OSS_ACCESS_KEY_ID || '',
      accessKeySecret: settings.ossAccessKeySecret || process.env.OSS_ACCESS_KEY_SECRET || '',
      bucket: settings.ossBucket || process.env.OSS_BUCKET || '',
      customDomain: (settings.ossCustomDomain || process.env.OSS_CUSTOM_DOMAIN || '') || undefined,
    };
    if (cfg.region && cfg.accessKeyId && cfg.accessKeySecret && cfg.bucket) {
      return cfg;
    }
  } catch {
    // 回退到环境变量
  }

  const envCfg = fromEnv();
  if (envCfg.region && envCfg.accessKeyId && envCfg.accessKeySecret && envCfg.bucket) {
    return envCfg;
  }
  return null;
}

export interface OssUploadResult {
  url: string;
  error?: never;
}
export interface OssUploadError {
  url?: never;
  error: string;
}

/**
 * 上传 base64 图片到 OSS，返回公网可访问的预签名 URL（私有 bucket 也可用）
 */
export async function uploadImageToOss(
  base64Data: string,
  mimeType: string
): Promise<OssUploadResult | OssUploadError> {
  const config = await getOssConfig();
  if (!config) {
    console.warn('[ossClient] OSS 未配置：请在设置中填写 ossRegion、ossAccessKeyId、ossAccessKeySecret、ossBucket');
    return { error: 'OSS 未配置：请在设置中填写阿里云 OSS 相关配置（Region、AccessKey、Bucket）' };
  }

  const ext = mimeType === 'image/png' ? 'png' : 'jpg';
  const objectName = `smv/video/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

  const client = new OSS({
    region: config.region,
    accessKeyId: config.accessKeyId,
    accessKeySecret: config.accessKeySecret,
    bucket: config.bucket,
  });

  const buffer = Buffer.from(base64Data, 'base64');

  try {
    await client.put(objectName, buffer, {
      mime: mimeType,
      headers: {
        'Cache-Control': 'public, max-age=31536000',
      },
    });

    console.log('[ossClient] OSS put 成功, objectName:', objectName);

    // 使用预签名 URL，私有 bucket 也可外网访问（有效期 2 小时）
    const expires = 7200;
    let signedUrl = client.signatureUrl(objectName, { expires, method: 'GET' });
    // xAI 等外部服务要求 HTTPS，强制使用 https
    if (signedUrl.startsWith('http://')) {
      signedUrl = 'https://' + signedUrl.slice(7);
    }
    console.log('[ossClient] 预签名 URL（外网可访问）:', signedUrl.slice(0, 80) + '...');
    return { url: signedUrl };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error('[ossClient] OSS upload error:', errMsg, e);
    return { error: `OSS 上传失败: ${errMsg}` };
  }
}

/** 检查 OSS 是否已配置 */
export async function isOssConfigured(): Promise<boolean> {
  const config = await getOssConfig();
  return config !== null;
}
