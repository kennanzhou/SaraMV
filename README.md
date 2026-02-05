# Sara Music Video Studio (SMV)

创作旖旎夜色的音乐盒 MTV 软件

## 功能概览

本应用由五个核心模块组成：

1. **🎤 歌词创作** - 上传素材，AI 生成音乐提示词
2. **🎵 歌曲创作** - 管理提示词版本，生成爱情故事
3. **🎬 分镜创作** - *开发中*
4. **📹 视频创作** - *开发中*
5. **🎞️ MV 创作** - *开发中*

## 快速开始

### 1. 配置环境变量

复制示例配置文件并填入您的 Gemini API Key：

```bash
cp .env.local.example .env.local
```

编辑 `.env.local` 文件：

```
GEMINI_API_KEY=your_gemini_api_key_here
```

获取 API Key: [Google AI Studio](https://makersuite.google.com/app/apikey)

### 2. 安装依赖

```bash
npm install
```

### 3. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

## 使用指南

### 第一部分：歌词创作

1. **上传关键词 CSV**
   - 支持的列名：`keyword`、`核心词`、`关键词`、`word`
   - 可选的 ID 列：`id`、`编号`、`序号`
   - 示例文件：`sample-keywords.csv`

2. **上传参考图片**
   - 支持格式：JPG、PNG、GIF、WebP
   - AI 将自动分析图片并提取：
     - **情境核心词** [context]：不超过10字的描述
     - **文学性描述** [fullContext]：约300字的详细描述

3. **生成音乐提示词**
   - 选择关键词后，点击「生成音乐提示词」
   - 生成的文件将保存至 `output/prompts/` 目录
   - 文件命名格式：`编号_核心词_YYYYMMDD_HHMM_VXX.csv`

### 第二部分：歌曲创作

1. **查看提示词内容**
   - 每个字段显示在独立的可编辑窗口中
   - 所有窗口都有复制按钮

2. **版本管理**
   - 使用版本选择器切换不同版本
   - 点击「选定此版本为最终版本」确认使用

3. **反馈与重新生成**
   - 输入修改建议，AI 将根据反馈生成新版本
   - 版本号自动顺延（V01 → V02 → V03...）

4. **爱情故事生成**
   - 基于 [fullContext] 和最终版本的日文歌词
   - 生成约1000字的爱情短文

## 技术栈

- **前端**: Next.js 16, TypeScript, Tailwind CSS
- **状态管理**: Zustand
- **AI**: Google Gemini 1.5 Pro
- **图标**: Lucide React

## 项目结构

```
smv/
├── src/
│   ├── app/
│   │   ├── api/              # API 路由
│   │   │   ├── analyze-image/    # 图片分析
│   │   │   ├── generate-prompt/  # 提示词生成
│   │   │   ├── regenerate-prompt/# 重新生成
│   │   │   └── generate-story/   # 故事生成
│   │   ├── globals.css       # 全局样式
│   │   ├── layout.tsx        # 根布局
│   │   └── page.tsx          # 主页面
│   ├── components/           # React 组件
│   │   ├── Sidebar.tsx       # 侧边导航栏
│   │   ├── Module1Lyrics.tsx # 歌词创作模块
│   │   ├── Module2Song.tsx   # 歌曲创作模块
│   │   ├── ModulePlaceholder.tsx
│   │   ├── CopyButton.tsx
│   │   └── EditableField.tsx
│   └── store/
│       └── appStore.ts       # Zustand 状态管理
├── output/
│   └── prompts/              # 生成的提示词文件
├── sample-keywords.csv       # 示例关键词文件
└── .env.local               # 环境变量配置
```

## 设计理念

- **深灰色主题**：营造录音棚的专业氛围
- **荧光绿装点**：单一荧光色点缀，象征创作的灵感火花
- **极简导航**：5个图标，一目了然
- **渐进解锁**：完成当前模块后，下一模块才会亮起

## 许可证

Private - All Rights Reserved
