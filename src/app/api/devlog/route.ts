import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, mkdir, access } from 'fs/promises';
import path from 'path';

const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'devlog.json');

// Debug: Log the paths
console.log('LOG_DIR:', LOG_DIR);
console.log('LOG_FILE:', LOG_FILE);
console.log('process.cwd():', process.cwd());

interface LogEntry {
  timestamp: string;
  content: string;
}

// 获取当前时间戳 YYYYMMDD_HHMM
const getTimestamp = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  return `${year}${month}${day}_${hour}${minute}`;
};

// GET - 读取日志
export async function GET() {
  try {
    console.log('Attempting to read log file from:', LOG_FILE);
    
    // Check if file exists
    try {
      await access(LOG_FILE);
      console.log('Log file exists');
    } catch {
      console.log('Log file does not exist');
      return NextResponse.json({ logs: [], debug: { path: LOG_FILE, exists: false } });
    }
    
    const content = await readFile(LOG_FILE, 'utf8');
    console.log('Read content length:', content.length);
    
    const logs: LogEntry[] = JSON.parse(content);
    console.log('Parsed logs count:', logs.length);
    
    // 按时间倒序排列（最新的在前面）
    logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return NextResponse.json({ logs, debug: { path: LOG_FILE, count: logs.length } });
  } catch (error) {
    console.error('Error reading log file:', error);
    // 文件不存在时返回空数组
    return NextResponse.json({ logs: [], error: String(error), debug: { path: LOG_FILE } });
  }
}

// POST - 添加日志
export async function POST(request: NextRequest) {
  try {
    const { content } = await request.json();
    
    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    // 确保日志目录存在
    await mkdir(LOG_DIR, { recursive: true });
    
    // 读取现有日志
    let logs: LogEntry[] = [];
    try {
      const existingContent = await readFile(LOG_FILE, 'utf8');
      logs = JSON.parse(existingContent);
    } catch {
      // 文件不存在，使用空数组
    }
    
    // 添加新日志
    const newEntry: LogEntry = {
      timestamp: getTimestamp(),
      content: content.trim(),
    };
    logs.unshift(newEntry); // 添加到数组开头
    
    // 保存日志
    await writeFile(LOG_FILE, JSON.stringify(logs, null, 2), 'utf8');
    
    return NextResponse.json({ success: true, entry: newEntry });
  } catch (error) {
    console.error('Failed to save log:', error);
    return NextResponse.json(
      { error: 'Failed to save log' },
      { status: 500 }
    );
  }
}
