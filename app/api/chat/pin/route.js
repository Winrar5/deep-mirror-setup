export const runtime     = 'nodejs';
export const maxDuration = 30;

import { NextResponse } from 'next/server';
import { getAuth }      from '@clerk/nextjs/server';
import connectDB        from '@/config/db';
import Chat             from '@/models/Chat';

/* ── POST /api/chat/pin ────────────────────────────── */
export async function POST(req) {
  try {
    const { userId } = getAuth(req);
    if (!userId) return NextResponse.json({ success:false, message:'Not auth' });

    const { action, chatId, pin } = await req.json();
    await connectDB();

    /* clear all chats */
    if (action === 'clear') {
      await Chat.deleteMany({ userId });
      return NextResponse.json({ success:true });
    }

    /* pin / unpin */
    const chat = await Chat.findOne({ _id: chatId, userId });
    if (!chat) return NextResponse.json({ success:false, message:'Chat not found' });

    chat.pinned = !!pin;
    await chat.save();
    return NextResponse.json({ success:true });
  } catch (err) {
    return NextResponse.json({ success:false, message:err.message });
  }
}
