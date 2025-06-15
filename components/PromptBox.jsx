// /components/PromptBox.jsx
'use client';

import { assets } from '@/assets/assets';
import { useAppContext } from '@/context/AppContext';
import axios from 'axios';
import Image from 'next/image';
import React, { useRef, useState } from 'react';
import toast from 'react-hot-toast';

const MODES = { NORMAL: 'normal', DEEP: 'deepthink', SEARCH: 'search' };

export default function PromptBox({ isLoading, setIsLoading }) {
  const [prompt, setPrompt] = useState('');
  const [mode,   setMode]   = useState(MODES.NORMAL);
  const [blink,  setBlink]  = useState(false);
  const [files,  setFiles]  = useState([]);
  const [edit,   setEdit]   = useState(null);

  const fileInput = useRef(null);
  const { user, selectedChat, setSelectedChat } = useAppContext();

  const addAssistant = (txt, label = '') => {
    const words = (label ? `[${label}] ` : '').concat(txt).split(' ');
    const assistant = { role: 'assistant', content: '', timestamp: Date.now() };
    setSelectedChat(prev => ({
      ...prev,
      messages: [...prev.messages, assistant],
    }));
    words.forEach((_, idx) => {
      setTimeout(() => {
        assistant.content = words.slice(0, idx + 1).join(' ');
        setSelectedChat(prev => {
          const msgs = [...prev.messages];
          msgs[msgs.length - 1] = assistant;
          return { ...prev, messages: msgs };
        });
      }, idx * 25);
    });
  };

  const sendPrompt = async (e) => {
    e.preventDefault();
    if (!user) return toast.error('Login to send');
    if (isLoading) return toast.error('Wait for previous response');
    if (!prompt.trim() && !files.length && mode === MODES.NORMAL) return;

    const userMsg = {
      role: 'user',
      content: prompt.trim(),
      timestamp: Date.now(),
      files: Array.isArray(files)
        ? files.map(f => ({
            name: f.name,
            size: f.size,
            type: f.type,
            ...(f.serverFileId ? { serverFileId: f.serverFileId } : {})
          }))
        : [],
      ...(edit ? { editedFrom: edit.index } : {})
    };

    setSelectedChat(prev => ({
      ...prev,
      messages: [...prev.messages, userMsg],
    }));

    const fd = new FormData();
    let hasAnyFile = false;

    (files || []).forEach(f => {
      if (f.serverFileId) {
        hasAnyFile = true;
        fd.append('fileId', f.serverFileId);
      } else {
        hasAnyFile = true;
        fd.append('file', f);
      }
    });

    fd.append('chatId', selectedChat._id);
    fd.append('prompt', prompt.trim());
    fd.append('mode', mode);

    setPrompt('');
    setEdit(null);
    setFiles([]);
    if (fileInput.current) fileInput.current.value = '';
    setIsLoading(true);
    setBlink(true);

    try {
      let data;
      if (hasAnyFile) {
        const resp = await axios.post('/api/chat/upload', fd);
        data = resp.data;
      } else {
        const resp = await axios.post('/api/chat/ai', {
          chatId: selectedChat._id,
          prompt: prompt.trim(),
          mode,
        });
        data = resp.data;
      }

      const answer  = data?.data?.content ?? data?.answer;
      const fileIds = data?.data?.fileIds || [];

      if (!answer) throw new Error('No content returned');

      setSelectedChat(prev => {
        const msgs = [...prev.messages];
        const lastUserIdx = msgs.map(m => m.role).lastIndexOf('user');
        if (lastUserIdx >= 0 && fileIds.length) {
          const oldFiles = msgs[lastUserIdx].files || [];
          msgs[lastUserIdx] = {
            ...msgs[lastUserIdx],
            files: oldFiles.map((f, i) => ({
              ...f,
              serverFileId: fileIds[i],
            }))
          };
        }
        msgs.push({ role:'assistant', content: answer, timestamp: Date.now() });
        return { ...prev, messages: msgs };
      });
    }
    catch(err) {
      toast.error(err.message);
    }
    finally {
      setIsLoading(false);
      setBlink(false);
      setMode(MODES.NORMAL);
    }
  };

  const startEdit = (index, originalContent, originalFiles = []) => {
    setPrompt(originalContent);
    setFiles((originalFiles || []).map(f => ({
      name: f.name,
      size: f.size,
      type: f.type,
      serverFileId: f.serverFileId,
    })));
    setEdit({ index, files: originalFiles || [] });
  };
  useAppContext().startEdit = startEdit;

  const handleChoose = (e) => {
    const list = Array.from(e.target.files || []);
    if (!list.length) return;
    const tooBig = list.find(f => f.size > 5 * 1024 * 1024);
    if (tooBig) return toast.error(`${tooBig.name} > 5 MB`);
    setFiles(prev => [...prev, ...list]);
  };
  const removeFile = name => {
    setFiles(prev => prev.filter(f => f.name !== name));
  };

  const toggleMode = (t) => {
    setMode(cur => (cur === t ? MODES.NORMAL : t));
  };

  const base   = 'flex items-center gap-2 text-xs border px-2 py-1 rounded-full transition';
  const active = 'bg-primary text-white border-primary';

  return (
    <form
      onSubmit={sendPrompt}
      className={`w-full ${selectedChat?.messages.length ? 'max-w-3xl' : 'max-w-2xl'} bg-[#404045] p-4 rounded-3xl mt-4`}
    >
      {edit && (
        <div className="mb-2 text-xs text-yellow-400">
          Editing previous message…{' '}
          <span
            onClick={() => {
              setEdit(null);
              setPrompt('');
              setFiles([]);
            }}
            className="cursor-pointer underline"
          >
            cancel
          </span>
        </div>
      )}

      {!!(files || []).length && (
        <div className="flex flex-wrap gap-2 mb-2">
          {(files || []).map(f => (
            <div key={f.name} className="flex items-center gap-1 bg-white/10 px-2 py-1 rounded-full">
              <Image src={assets.file_icon} alt="" className="w-4" />
              <span className="truncate max-w-[140px]">{f.name}</span>
              <span onClick={() => removeFile(f.name)} className="cursor-pointer text-lg leading-none">&times;</span>
            </div>
          ))}
        </div>
      )}

      <textarea
        className="outline-none w-full resize-none bg-transparent"
        rows={2}
        placeholder="Message DeepSeek"
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
      />

      <div className="flex items-center justify-between text-sm">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => toggleMode(MODES.DEEP)}
            className={`${base} ${mode === MODES.DEEP ? active : 'border-gray-400/40'} ${blink && mode === MODES.DEEP ? 'animate-pulse' : ''}`}
          >
            <Image className="h-5" src={assets.deepthink_icon} alt="" />
            DeepThink&nbsp;(R1)
          </button>
          <button
            type="button"
            onClick={() => toggleMode(MODES.SEARCH)}
            className={`${base} ${mode === MODES.SEARCH ? active : 'border-gray-400/40'} ${blink && mode === MODES.SEARCH ? 'animate-pulse' : ''}`}
          >
            <Image className="h-5" src={assets.search_icon} alt="" />
            Search
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button type="button" onClick={() => fileInput.current?.click()} className="p-1.5 rounded-full hover:bg-white/20">
            <Image className="w-4" src={assets.pin_icon} alt="Attach" />
          </button>
          <input
            ref={fileInput}
            type="file"
            hidden
            multiple
            accept=".pdf,.doc,.docx,.txt,.csv"
            onChange={handleChoose}
          />
          <button
            disabled={!prompt.trim() && !(files || []).length && mode === MODES.NORMAL}
            className={`${
              prompt.trim() || (files || []).length || mode !== MODES.NORMAL
                ? 'bg-primary'
                : 'bg-[#71717a]'
            } rounded-full p-2`}
          >
            <Image
              className="w-3.5"
              src={
                prompt.trim() || (files || []).length || mode !== MODES.NORMAL
                  ? assets.arrow_icon
                  : assets.arrow_icon_dull
              }
              alt=""
            />
          </button>
        </div>
      </div>
    </form>
  );
}
