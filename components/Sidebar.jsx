import { assets } from '@/assets/assets';
import Image from 'next/image';
import React, { useState } from 'react';
import { useClerk, UserButton } from '@clerk/nextjs';
import { useAppContext } from '@/context/AppContext';
import ChatLabel from './ChatLabel';
import axios from 'axios';
import toast from 'react-hot-toast';

const Sidebar = ({ expand, setExpand }) => {
  const { openSignIn } = useClerk();
  const { user, chats, createNewChat, fetchUsersChats } = useAppContext();
  const [openMenu, setOpenMenu] = useState({ id: 0, open: false });

  /* clear all chats */
  const clearHistory = async () => {
    if (!confirm('Delete ALL chats?')) return;
    try {
      const { data } = await axios.post('/api/chat/pin', { action: 'clear' });
      data.success ? fetchUsersChats() : toast.error(data.message);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const sorted = [...chats].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

  /* Тепер фіксована висота 580px і завжди overflowY: scroll */
  const chatListStyle = {
    height: '580px',
    overflowY: 'scroll',
  };

  return (
    <div
      className={`flex flex-col justify-between bg-[#212327] pt-7 transition-all z-50 max-md:absolute max-md:h-screen
                  ${expand ? 'p-4 w-64' : 'md:w-20 w-0 max-md:overflow-hidden'}`}
    >
      {/* top */}
      <div>
        {/* logo + burger */}
        <div className={`flex ${expand ? 'flex-row gap-10' : 'flex-col items-center gap-8'}`}>
          <Image className={expand ? 'w-36' : 'w-10'} src={expand ? assets.logo_text : assets.logo_icon} alt="" />
          <div
            onClick={() => setExpand(!expand)}
            className="group relative flex items-center justify-center hover:bg-gray-500/20 transition h-9 w-9 rounded-lg cursor-pointer"
          >
            <Image src={assets.menu_icon} alt="" className="md:hidden" />
            <Image
              src={expand ? assets.sidebar_close_icon : assets.sidebar_icon}
              alt=""
              className="hidden md:block w-7"
            />
          </div>
        </div>

        {/* New chat + Clear */}
        <div className={`mt-8 flex ${expand ? 'gap-2' : 'flex-col items-center gap-6'}`}>
          <button
            onClick={createNewChat}
            className={`flex items-center justify-center ${expand ? 'bg-primary hover:bg-gray-500/20 gap-2 p-2.5 rounded-2xl' : 
              'group h-9 w-9 hover:bg-gray-500/30 rounded-lg'}`}
          >
            <Image className={expand ? 'w-6' : 'w-7'} src={expand ? assets.chat_icon : assets.chat_icon_dull} alt="" />
            {expand && <p className="text-white font-medium">New chat</p>}
          </button>

          <button
            onClick={clearHistory}
            className={`flex items-center justify-center hover:bg-gray-500/20 transition
                        ${expand ? 'p-2.5 rounded-2xl' : 'h-10 w-10 rounded-lg'}`}
          >
            {/* className="group relative flex items-center justify-center hover:bg-gray-500/20 transition h-9 w-9 rounded-lg cursor-pointer" */}
            <Image src={assets.clear_history_icon} alt="Clear" className={expand ? 'w-7' : 'w-7'} />
            {expand && <p className="text-white font-small">Clear</p>}
          </button>
        </div>

        {/* chat list */}
        <div className={`mt-8 text-white/25 text-sm ${expand ? 'block' : 'hidden'}`}>
          <p className="my-1">Recents</p>
          <div style={chatListStyle} className="pr-1">
            {sorted.map((chat) => (
              <ChatLabel
                key={chat._id}
                id={chat._id}
                name={chat.name}
                pinned={chat.pinned}
                openMenu={openMenu}
                setOpenMenu={setOpenMenu}
              />
            ))}
          </div>
        </div>
      </div>

      {/* profile / login */}
      <div
        onClick={user ? null : openSignIn}
        className={`flex items-center ${expand ? 'hover:bg-white/10 rounded-lg' : 'justify-center w-full'} 
        gap-3 text-white/60 text-sm p-2 cursor-pointer`}
      >
        {user ? <UserButton /> : <Image src={assets.profile_icon} alt="" className="w-7" />}
        {expand && <span>My Profile</span>}
      </div>
    </div>
  );
};

export default Sidebar;
