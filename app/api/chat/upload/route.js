// /app/api/chat/upload/route.js
export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getAuth }      from '@clerk/nextjs/server';
import connectDB        from '@/config/db';
import Chat             from '@/models/Chat';
import OpenAI           from 'openai';

/* helpers */
const pdfText = async b => (await (await import('pdf-parse')).default(b)).text;
const docText = async b => (await (await import('mammoth')).extractRawText({ buffer: b })).value;
const csvText = async t => (await import('csv-parse/sync')).parse(t, { to_line: 10 })
  .map(r => r.join(', ')).join('\n');

const openai = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: process.env.DEEPSEEK_API_KEY,
});

export async function POST(req) {
  try {
    const { userId } = getAuth(req);
    if (!userId) return NextResponse.json({ success: false, error: 'Not authenticated' });

    const fd     = await req.formData();
    const files  = fd.getAll('file');              // масив файлів
    const chatId = fd.get('chatId');
    const prompt = (fd.get('prompt') || '').toString().trim();

    if (!files.length) return NextResponse.json({ success: false, error: 'No file' });

    await connectDB();
    const chat = await Chat.findOne({ _id: chatId, userId });
    if (!chat) return NextResponse.json({ success: false, error: 'Chat not found' });

    // ——— додаємо system-повідомлення з метаданими по файлах ———
    for (const f of files) {
      if (f.size > 5 * 1024 * 1024) continue;
      const buf = Buffer.from(await f.arrayBuffer());
      const ext = f.name.split('.').pop().toLowerCase();
      let text = '';
      switch (ext) {
        case 'pdf':
          text = await pdfText(buf);
          break;
        case 'doc':
        case 'docx':
          text = await docText(buf);
          break;
        case 'csv':
          text = await csvText(buf.toString());
          break;
        default:
          text = buf.toString();
      }
      text = text.trim().slice(0, 10_000);
      chat.messages.push({
        role:    'system',
        content: `[FILE] ${f.name} (${text.split(/\s+/).length} words)\n\n${text}`,
        timestamp: Date.now(),
      });
    }

    // ——— якщо є prompt, додаємо user-повідомлення та шлемо по ньому AI ———
    if (prompt) {
      chat.messages.push({
        role:     'user',
        content:  prompt,
        files:    files.map(f => ({ name: f.name, size: f.size, type: f.type })),
        timestamp: Date.now(),
      });

      // будуємо масив останніх file- та user-повідомлень
      const recent = chat.messages.slice(-files.length - 1);

      const { choices } = await openai.chat.completions.create({
        model:   'deepseek-chat',
        store:   true,
        messages: recent.map(m => ({ role: m.role, content: m.content })),
      });
      const answer = choices[0].message.content;

      // **не зберігаємо** цей assistant-summary у чаті
      await chat.save();
      return NextResponse.json({ success: true, answer });
    }

    // ——— якщо prompt відсутній — просто зберігаємо metadata по файлах ———
    await chat.save();
    return NextResponse.json({ success: true, answer: '' });

  } catch (err) {
    return NextResponse.json({ success: false, error: err.message });
  }
}
