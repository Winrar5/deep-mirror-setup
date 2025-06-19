"use client";

import React, { useRef, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import Image from "next/image";
import { assets } from "@/assets/assets";
import { useAppContext } from "@/context/AppContext";

const MODES = {
  NORMAL: "normal",
  DEEP: "deepthink",
  SEARCH: "search",
};

export default function PromptBox({ isLoading, setIsLoading }) {
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState(MODES.NORMAL);
  const [blink, setBlink] = useState(false);
  const [files, setFiles] = useState([]);
  const [edit, setEdit] = useState(null);
  const fileInput = useRef(null);
  const { user, selectedChat, setSelectedChat } = useAppContext();

  const addAssistant = (txt) => {
    const assistant = { role: "assistant", content: txt, timestamp: Date.now() };
    setSelectedChat((prev) => ({
      ...prev,
      messages: [...prev.messages, assistant],
    }));
  };

  const startEdit = (index = 0, originalContent = '', originalFiles = []) => {
    setPrompt(originalContent);
    setFiles(
      originalFiles.map((f) => ({
        name: f.name,
        size: f.size,
        type: f.type,
        serverFileId: f.serverFileId,
      }))
    );
    setEdit({ index, files: originalFiles });
  };
  useAppContext().startEdit = startEdit;

  const sendPrompt = async (e) => {
    e.preventDefault();
    if (!user) return toast.error("Увійдіть, щоб відправити запит");
    if (isLoading) return toast.error("Почекайте на відповідь попереднього запиту");
    // if (!prompt.trim() && !files.length && mode === MODES.NORMAL) return;
    if (!prompt.trim() && !files.length) {
   // або просто: if (!prompt.trim()) — якщо хочете обов'язково текст
    return toast.error('Введіть текст або додайте файл');
    }
    const userMsg = {
      role: "user",
      content: prompt.trim(),
      timestamp: Date.now(),
      files: files.map((f) => ({
        name: f.name,
        size: f.size,
        type: f.type,
        ...(f.serverFileId ? { serverFileId: f.serverFileId } : {}),
      })),
      ...(edit ? { editedFrom: edit.index } : {}),
    };
    setSelectedChat((prev) => ({
      ...prev,
      messages: [...prev.messages, userMsg],
    }));

    const fd = new FormData();
    files.forEach((f) =>
      fd.append(f.serverFileId ? "fileId" : "file", f.serverFileId || f)
    );
    fd.append("chatId", selectedChat._id);
    fd.append("prompt", prompt.trim());
    fd.append("mode", mode);

    setPrompt("");
    setEdit(null);
    setFiles([]);
    if (fileInput.current) fileInput.current.value = "";
    setIsLoading(true);
    setBlink(true);

    try {
      // const resp = files.length
      //   ? await axios.post("/api/chat/upload", fd)
      //   : await axios.post("/api/chat/ai", {
      //       chatId: selectedChat._id,
      //       prompt: prompt.trim(),
      //       mode,
      //     });
      // const data = resp.data;
      let data;

// 1) якщо є файли – спершу upload
if (files.length) {
  const up = await axios.post('/api/chat/upload', fd);
  if (!up.data.success) throw new Error(up.data.error);

  // fileIds можемо зберегти у користувацькому bubble
  const fileIds = up.data.data?.fileIds || [];
  setSelectedChat(prev => {
    const msgs = [...prev.messages];
    const lastUser = msgs.map(m => m.role).lastIndexOf('user');
    if (lastUser >= 0 && fileIds.length) {
      msgs[lastUser] = {
        ...msgs[lastUser],
        files: msgs[lastUser].files.map((f, i) => ({
          ...f,
          serverFileId: fileIds[i],
        })),
      };
    }
    return { ...prev, messages: msgs };
  });

  // 2) одразу слідом викликаємо chat/ai
  const ai = await axios.post('/api/chat/ai', {
    chatId: selectedChat._id,
    prompt: prompt.trim(),
    mode,
  });
  data = ai.data;
} else {
  // без файлів – одразу chat/ai
  const ai = await axios.post('/api/chat/ai', {
    chatId: selectedChat._id,
    prompt: prompt.trim(),
    mode,
  });
  data = ai.data;
}

      if (!data.success) throw new Error(data.error);

      // const answer = data.data.content || data.answer;
      // const fileIds = data.data.fileIds || [];
     const answer = data.answer ?? data.data?.content;

        if (!answer) throw new Error('AI did not return content');

      const fileIds = data.data?.fileIds || [];

      setSelectedChat((prev) => {
        const msgs = [...prev.messages];
        const lastUserIdx = msgs.map((m) => m.role).lastIndexOf("user");
        if (lastUserIdx >= 0 && fileIds.length) {
          const oldFiles = msgs[lastUserIdx].files || [];
          msgs[lastUserIdx] = {
            ...msgs[lastUserIdx],
            files: oldFiles.map((f, i) => ({
              ...f,
              serverFileId: fileIds[i],
            })),
          };
        }
        msgs.push({ role: "assistant", content: answer, timestamp: Date.now() });
        return { ...prev, messages: msgs };
      });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
      setBlink(false);
      setMode(MODES.NORMAL);
    }
  };

  const handleChoose = (e) => {
    const list = Array.from(e.target.files || []);
    if (!list.length) return;
    const tooBig = list.find((f) => f.size > 5 * 1024 * 1024);
    if (tooBig) return toast.error(`${tooBig.name} занадто великий (>5 MB)`);
    setFiles((prev) => [...prev, ...list]);
  };

  const removeFile = (name) => {
    setFiles((prev) => prev.filter((f) => f.name !== name));
  };

  const toggleMode = (t) => {
    setMode((cur) => (cur === t ? MODES.NORMAL : t));
  };

  const baseStyles =
    "flex items-center gap-2 text-xs border px-2 py-1 rounded-full transition";
  const activeStyles = "bg-primary text-white border-primary";

  return (
    <form
      onSubmit={sendPrompt}
      className={`w-full ${
        selectedChat?.messages.length ? "max-w-3xl" : "max-w-2xl"
      } bg-[#404045] p-4 rounded-3xl mt-4`}
    >
      {edit && (
        <div className="mb-2 text-xs text-yellow-400">
          Редагується попереднє повідомлення…{" "}
          <span
            onClick={() => {
              setEdit(null);
              setPrompt("");
              setFiles([]);
            }}
            className="cursor-pointer underline"
          >
            відмінити
          </span>
        </div>
      )}

      {!!files.length && (
        <div className="flex flex-wrap gap-2 mb-2">
          {files.map((f) => (
            <div
              key={f.name}
              className="flex items-center gap-1 bg-white/10 px-2 py-1 rounded-full"
            >
              <Image src={assets.file_icon} alt="" className="w-4" />
              <span className="truncate max-w-[140px]">{f.name}</span>
              <span
                onClick={() => removeFile(f.name)}
                className="cursor-pointer text-lg leading-none"
              >
                &times;
              </span>
            </div>
          ))}
        </div>
      )}

      <textarea
        rows={2}
        placeholder="Message DeepMirror."
        className="outline-none w-full resize-none bg-transparent"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />

      <div className="flex items-center justify-between text-sm mt-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => toggleMode(MODES.DEEP)}
            className={`${baseStyles} ${
              mode === MODES.DEEP ? activeStyles : "border-gray-400/40"
            } ${blink && mode === MODES.DEEP ? "animate-pulse" : ""}`}
          >
            <Image className="h-5" src={assets.deepthink_icon} alt="" />
            DeepThink (R1)
          </button>
          <button
            type="button"
            onClick={() => toggleMode(MODES.SEARCH)}
            className={`${baseStyles} ${
              mode === MODES.SEARCH ? activeStyles : "border-gray-400/40"
            } ${
              blink && mode === MODES.SEARCH ? "animate-pulse" : ""
            }`}
          >
            <Image className="h-5" src={assets.search_icon} alt="" />
            Search
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="p-1.5 rounded-full hover:bg-white/20"
          >
            <Image className="w-4" src={assets.pin_icon} alt="Attach file" />
          </button>
          <input
            ref={fileInput}
            type="file"
            hidden
            multiple
            accept=".pdf,doc,docx,txt,csv"
            onChange={handleChoose}
          />
          <button
            type="submit"
            disabled={
              !prompt.trim() && !files.length && mode === MODES.NORMAL
            }
            className={`rounded-full p-2 ${
              prompt.trim() || files.length || mode !== MODES.NORMAL
                ? "bg-primary"
                : "bg-[#71717a]"
            }`}
          >
            <Image
              className="w-4"
              src={
                prompt.trim() || files.length || mode !== MODES.NORMAL
                  ? assets.arrow_icon
                  : assets.arrow_icon_dull
              }
              alt="Send"
            />
          </button>
        </div>
      </div>
    </form>
  );
}
