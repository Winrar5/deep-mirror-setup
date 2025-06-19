'use client';

import { assets } from '@/assets/assets';
import { useAppContext } from '@/context/AppContext';
import axios from 'axios';
import Image from 'next/image';
import React, { useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import Prism from 'prismjs';
import toast from 'react-hot-toast';

const MODE_LABEL = {
  normal: '',
  deepthink: 'DeepThink',
  search: 'Search',
};

const FileChip = ({ name }) => (
  <div className="flex items-center gap-1 mt-1 bg-white/10 px-2 py-1 rounded-md">
    <Image src={assets.file_icon} alt="file" className="w-4" />
    <span className="text-xs">{name}</span>
  </div>
);

const Message = ({ msg, index }) => {
  // дефолти, щоб не було undefined
  const { role = 'assistant', content = '', files = [] } = msg;
  const { selectedChat, setSelectedChat, startEdit } = useAppContext();
  const [regenLoading, setRegenLoading] = useState(false);

  useEffect(() => {
    Prism.highlightAll();
  }, [content]);

  /* ---------- Злиття [FILE] ---------- */
  let mergedFileName = null;
  if (
    role === 'user' &&
    index > 0 &&
    selectedChat.messages[index - 1]?.role === 'system' &&
    selectedChat.messages[index - 1].content?.startsWith('[FILE]')
  ) {
    const prev = selectedChat.messages[index - 1].content;
    const rawName = prev
      .replace('[FILE]', '')
      .trim()
      .split(/\n/, 2)[0]
      .replace(/\s*\(.*?\)$/, '')
      .trim();
    mergedFileName = rawName;
  }

  // ховаємо системне [FILE], якщо воно злите
  if (
    role === 'system' &&
    content.startsWith('[FILE]') &&
    selectedChat.messages[index + 1]?.role === 'user'
  ) {
    return null;
  }

  /* ---------- Копіювання ---------- */
  const copy = () => {
    navigator.clipboard.writeText(content);
    toast.success('Copied!');
  };

  /* ---------- Regenerate ---------- */
  const regenerate = async (mode) => {
    try {
      setRegenLoading(true);
      const msgs = [...selectedChat.messages];

      // шукаємо попередній user-prompt
      const promptIdxRel = msgs
        .slice(0, index)
        .reverse()
        .findIndex((m) => m.role === 'user');
      if (promptIdxRel < 0) return toast.error('Prompt not found');

      const userIdx = index - 1 - promptIdxRel;
      const promptMsg = msgs[userIdx];
      const promptContent = promptMsg.content || '';
      const promptFiles = promptMsg.files || [];

      // дублюємо prompt
      msgs.push({
        role: 'user',
        content: promptContent,
        timestamp: Date.now(),
        files: promptFiles.map((f) => ({ ...f })),
      });
      const placeholder = {
        role: 'assistant',
        content: '↻ Regenerating…',
        timestamp: Date.now(),
      };
      msgs.push(placeholder);
      setSelectedChat((prev) => ({ ...prev, messages: msgs }));

      // запит
      let data;
      if (promptFiles.length) {
        const fd = new FormData();
        promptFiles.forEach(
          (f) => f.serverFileId && fd.append('fileId', f.serverFileId)
        );
        fd.append('chatId', selectedChat._id);
        fd.append('prompt', promptContent);
        fd.append('mode', mode);
        const resp = await axios.post('/api/chat/upload', fd);
        data = resp.data;
      } else {
        const resp = await axios.post('/api/chat/ai', {
          chatId: selectedChat._id,
          prompt: promptContent,
          mode,
        });
        data = resp.data;
      }

      const aiText = data?.data?.content ?? data?.answer ?? '';
      if (!aiText) throw new Error('No content returned');

      placeholder.content =
        (MODE_LABEL[mode] ? `[${MODE_LABEL[mode]}] ` : '') + aiText;
      placeholder.timestamp = Date.now();

      // оновлюємо fileIds
      if (data?.data?.fileIds?.length && promptFiles.length) {
        msgs[userIdx] = {
          ...promptMsg,
          files: promptFiles.map((f, i) => ({
            ...f,
            serverFileId: data.data.fileIds[i],
          })),
        };
      }

      setSelectedChat((prev) => ({ ...prev, messages: [...msgs] }));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRegenLoading(false);
    }
  };

  /* ---------- RENDER ---------- */
  const renderBody = () => {
    if (role === 'user') {
      return (
        <div className="flex flex-col">
          <span className="text-white/90 whitespace-pre-wrap">{content}</span>
          {mergedFileName && <FileChip name={mergedFileName} />}
          {files.map((f, i) => (
            <FileChip key={i} name={f.name} />
          ))}
        </div>
      );
    }

    /* assistant / system */
    return (
      <>
        <Image
          src={assets.logo_icon}
          alt="assistant"
          className="h-9 w-9 p-1 border border-white/15 rounded-full"
        />
        <div className="chat-message space-y-4 w-full overflow-x-auto">
          {content === '↻ Regenerating…' ? (
            <div className="flex items-center gap-2 text-white text-sm">
              <span>↻ Regenerating</span>
              <div className="flex gap-[2px]">
                <div className="w-1 h-1 rounded-full bg-white animate-bounce" />
                <div className="w-1 h-1 rounded-full bg-white animate-bounce [animation-delay:0.15s]" />
                <div className="w-1 h-1 rounded-full bg-white animate-bounce [animation-delay:0.3s]" />
              </div>
            </div>
          ) : (
            <Markdown>{content}</Markdown>
          )}
        </div>
      </>
    );
  };

  return (
    <div className="flex flex-col items-center w-full max-w-3xl text-sm">
      <div
        className={`flex flex-col w-full mb-8 ${
          role === 'user' ? 'items-end' : ''
        }`}
      >
        <div
          className={`group relative flex max-w-2xl py-3 rounded-xl ${
            role === 'user' ? 'bg-[#414158] px-5' : 'gap-3'
          }`}
        >
          {role !== 'system' && (
            <div
              className={`opacity-0 group-hover:opacity-100 absolute ${
                role === 'user' ? '-left-16 top-2.5' : 'left-9 -bottom-6'
              } transition-all`}
            >
              <div className="flex items-center gap-2 opacity-70">
                <Image
                  onClick={copy}
                  src={assets.copy_icon}
                  alt="copy"
                  className="w-4 cursor-pointer"
                />
                {role === 'assistant' && (
                  <Dropdown
                    disabled={regenLoading}
                    onSelect={regenerate}
                  />
                )}
                {role === 'user' && content && (
                  <Image
                    src={assets.pencil_icon}
                    alt="edit"
                    className="w-4.5 cursor-pointer"
                    onClick={() => startEdit(index, content, files)}
                  />
                )}
              </div>
            </div>
          )}
          {renderBody()}
        </div>
      </div>
    </div>
  );
};

const Dropdown = ({ onSelect, disabled }) => {
  const [open, setOpen] = useState(false);
  const opts = [
    { label: 'Normal', mode: 'normal' },
    { label: 'DeepThink (R1)', mode: 'deepthink' },
    { label: 'Search', mode: 'search' },
  ];
  return (
    <div className="relative">
      <Image
        src={assets.regenerate_icon}
        alt="regen"
        className={`w-4 cursor-pointer ${disabled ? 'opacity-40' : ''}`}
        onClick={() => !disabled && setOpen((o) => !o)}
      />
      {open && (
        <div className="absolute top-5 -left-8 bg-[#30303d] border border-white/20 rounded text-xs">
          {opts.map((o) => (
            <div
              key={o.mode}
              onClick={() => {
                setOpen(false);
                onSelect(o.mode);
              }}
              className="px-3 py-1 hover:bg-white/20 cursor-pointer whitespace-nowrap"
            >
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Message;
