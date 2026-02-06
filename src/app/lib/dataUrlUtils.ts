/**
 * 安全地从 data URL 中提取 base64 数据和 MIME 类型。
 * 使用 indexOf + slice 而非正则，避免对超长字符串调用 .match() 导致
 * "Maximum call stack size exceeded" 的栈溢出问题。
 *
 * 同时：
 * - 清除 base64 数据中的空白字符
 * - 规范化 MIME 类型为 Gemini 支持的格式
 */

const VALID_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * 不使用正则的空白字符移除（避免超长字符串上正则潜在的性能问题）
 */
function stripWhitespace(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    // 跳过 space(32), tab(9), newline(10), carriage-return(13)
    if (c !== 32 && c !== 9 && c !== 10 && c !== 13) {
      out += s[i];
    }
  }
  return out;
}

export function parseDataUrl(dataUrl: string): { data: string; mimeType: string } {
  const marker = ';base64,';
  const idx = dataUrl.indexOf(marker);

  if (idx === -1) {
    // 不是 data URL 格式，原样返回（可能已经是纯 base64）
    return { data: stripWhitespace(dataUrl), mimeType: 'image/jpeg' };
  }

  // 提取 MIME：在 "data:" 与 ";base64," 之间
  const prefix = dataUrl.slice(0, idx); // e.g. "data:image/png"
  const colonIdx = prefix.indexOf(':');
  let mime = colonIdx !== -1 ? prefix.slice(colonIdx + 1) : 'image/jpeg';

  // 规范化 MIME
  if (!VALID_MIMES.has(mime)) {
    mime = 'image/jpeg';
  }

  // 提取 base64 数据并清除空白
  const data = stripWhitespace(dataUrl.slice(idx + marker.length));

  return { data, mimeType: mime };
}

/**
 * 验证 base64 数据是否看起来合法
 */
export function isValidBase64(data: string): boolean {
  if (!data || data.length < 100) return false; // 太短不可能是有效图片
  // 检查前 64 字符是否全部为合法 base64 字符
  const sample = data.slice(0, 64);
  for (let i = 0; i < sample.length; i++) {
    const c = sample.charCodeAt(i);
    if (
      !(c >= 65 && c <= 90) && // A-Z
      !(c >= 97 && c <= 122) && // a-z
      !(c >= 48 && c <= 57) && // 0-9
      c !== 43 && // +
      c !== 47 && // /
      c !== 61 // =
    ) {
      return false;
    }
  }
  return true;
}
