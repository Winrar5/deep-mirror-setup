export const maxDuration = 60;

import connectDB from '@/config/db';
import Chat from '@/models/Chat';
import { getAuth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: process.env.DEEPSEEK_API_KEY,
});

/* ───── веб-пошук через SerpAPI ───── */
async function webSearch(query) {
  const key = process.env.SERP_API_KEY;
  if (!key) throw new Error('SERP_API_KEY missing');
  const url = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${key}&num=5`;
  const res = await fetch(url);
  const json = await res.json();
  const list = json.organic_results ?? [];
  return list
    .slice(0, 5)
    .map(
      (r, i) => `${i + 1}. ${r.title}\n${r.link}\n${r.snippet || r.summary || ''}`,
    )
    .join('\n\n');
}

export async function POST(req) {
  try {
    const { userId } = getAuth(req);
    if (!userId)
      return NextResponse.json({ success: false, error: 'Not authenticated' });

    const { chatId, prompt, mode = 'normal' } = await req.json();

    await connectDB();
    const chat = await Chat.findOne({ userId, _id: chatId });
    if (!chat)
      return NextResponse.json({ success: false, error: 'Chat not found' });

    /* ───── system-prompt за режимом ───── */
    let systemPrompt =
      mode === 'deepthink'
        ? 'Відповідай максимально докладно, з прикладами, кодом та джерелами.'
        : 'Ти – корисний асистент. Відповідай стисло і по суті.';

    if (mode === 'search') {
      const results = await webSearch(prompt);
      systemPrompt =
        'Використовуючи наведені веб-результати, дай відповідь, додаючи посилання у квадратних дужках.\n\nРезультати пошуку:\n' +
        results;
    }

    chat.messages.push({ role: 'user', content: prompt, timestamp: Date.now() });

    const completion = await openai.chat.completions.create({
      model: 'deepseek-chat',
      store: true,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
    });

    const assistant = completion.choices[0].message;
    assistant.timestamp = Date.now();
    chat.messages.push(assistant);
    await chat.save();

    return NextResponse.json({ success: true, data: assistant });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message });
  }
}
