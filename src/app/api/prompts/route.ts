import { NextRequest, NextResponse } from 'next/server';
import { getPromptsConfig, savePromptsConfig } from '@/app/lib/promptsConfig';

export async function GET() {
  try {
    const config = await getPromptsConfig();
    return NextResponse.json(config);
  } catch (e) {
    console.error('GET /api/prompts', e);
    return NextResponse.json({ error: 'Failed to load prompts' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const musicPromptTemplate = typeof body.musicPromptTemplate === 'string' ? body.musicPromptTemplate : undefined;
    const gridContactSheetPrompt = typeof body.gridContactSheetPrompt === 'string' ? body.gridContactSheetPrompt : undefined;
    const gridPanelDescriptions = Array.isArray(body.gridPanelDescriptions) ? body.gridPanelDescriptions : undefined;
    const gridCloseupPrompt = typeof body.gridCloseupPrompt === 'string' ? body.gridCloseupPrompt : undefined;

    const current = await getPromptsConfig();
    const config = {
      musicPromptTemplate: musicPromptTemplate ?? current.musicPromptTemplate,
      gridContactSheetPrompt: gridContactSheetPrompt ?? current.gridContactSheetPrompt,
      gridPanelDescriptions: gridPanelDescriptions ?? current.gridPanelDescriptions,
      gridCloseupPrompt: gridCloseupPrompt ?? current.gridCloseupPrompt,
    };
    await savePromptsConfig(config);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('POST /api/prompts', e);
    return NextResponse.json({ error: 'Failed to save prompts' }, { status: 500 });
  }
}
