// /app/api/chat/ai/route.js
import connectDB from '@/config/db';
import Chat      from '@/models/Chat';
import { getAuth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import OpenAI    from 'openai';

export const maxDuration = 60;

const openai = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: process.env.DEEPSEEK_API_KEY,
});

/* ───── веб-пошук через Serper.dev ───── */
async function webSearch(query) {
  const key = process.env.SERPER_API_KEY;
  if (!key) throw new Error('SERPER_API_KEY missing');

  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: query }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Serper error ${res.status} — ${errText}`);
  }
  const { organic = [] } = await res.json();
  return organic
    .slice(0, 5)
    .map((r, i) => `${i + 1}. ${r.title}\n${r.url}\n${r.snippet || ''}`)
    .join('\n\n');
}

export async function POST(request) {
  try {
    const { userId } = getAuth(request);
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Not authenticated' });
    }

    const { chatId, prompt, mode = 'normal' } = await request.json();
    await connectDB();

    const chat = await Chat.findOne({ userId, _id: chatId });
    if (!chat) {
      return NextResponse.json({ success: false, error: 'Chat not found' });
    }

    // custom system-prompt
    let customSystem;
    if (mode === 'deepthink') {
      customSystem =
        'Відповідай максимально докладно, з прикладами, кодом та джерелами. ' +
        'Якщо тебе запитають “з якою моделлю я працюю?”, відповідай точно “deepseek-chat” а мод "deepthink".';
    } else if (mode === 'search') {
      const results = await webSearch(prompt);
      customSystem =
        'Використовуючи наведені веб-результати, дай відповідь, додаючи посилання в квадратних дужках.\n\n' +
        'Результати пошуку:\n' +
        results;
    } else {
      customSystem = 'Ти – корисний асистент. Відповідай стисло і по суті.';
    }

    // історія з БД → формат для OpenAI
    const history = chat.messages.map(m => ({
      role: m.role,
      content: m.content,
    }));

    // формуємо запит
    const messages = [
      ...history,
      { role: 'system', content: customSystem },
      { role: 'user',   content: prompt },
    ];

    const completion = await openai.chat.completions.create({
    model: 'deepseek-chat',
    store: true,
    messages,
    });
    console.log('🔍 Model used for completion:', completion.model);
    const assistant = completion.choices[0].message;
    assistant.timestamp = Date.now();

    // зберігаємо нові user + assistant повідомлення
    chat.messages.push({ role: 'user', content: prompt, timestamp: Date.now() });
    chat.messages.push(assistant);
    await chat.save();

    return NextResponse.json({
      success: true,
      model: completion.model,
      answer: assistant.content,
      data: assistant,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message });
  }
}
