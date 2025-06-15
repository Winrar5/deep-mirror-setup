import { assets } from '@/assets/assets';
import { useAppContext } from '@/context/AppContext';
import axios from 'axios';
import Image from 'next/image';
import React, { useRef, useEffect } from 'react';
import toast from 'react-hot-toast';

const ChatLabel = ({ openMenu, setOpenMenu, id, name, pinned }) => {
  const { fetchUsersChats, chats, setSelectedChat } = useAppContext();
  // Посилання на контейнер меню (Pop-up)
  const menuRef = useRef(null);
  // Посилання на іконку "три крапки"
  const triggerRef = useRef(null);

  // Обробник кліку по чаті:
  const selectChat = () => {
    setOpenMenu({ id: 0, open: false }); // Закриваємо інші меню
    setSelectedChat(chats.find((c) => c._id === id));
  };

  // Перейменування
  const renameHandler = async (e) => {
    e.stopPropagation();
    const newName = prompt('Enter new name');
    if (!newName) return;

    try {
      const { data } = await axios.post('/api/chat/rename', { chatId: id, name: newName });
      if (data.success) {
        fetchUsersChats();
        setOpenMenu({ id: 0, open: false }); // Закриваємо меню
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Видалення
  const deleteHandler = async (e) => {
    e.stopPropagation();
    if (!confirm('Delete this chat?')) return;

    try {
      const { data } = await axios.post('/api/chat/delete', { chatId: id });
      if (data.success) {
        fetchUsersChats();
        setOpenMenu({ id: 0, open: false }); // Закриваємо меню
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Прикріпити / Відкріпити
  const pinHandler = async (e) => {
    e.stopPropagation();

    try {
      const { data } = await axios.post('/api/chat/pin', { chatId: id, pin: !pinned });
      if (data.success) {
        fetchUsersChats();
        setOpenMenu({ id: 0, open: false }); // Закриваємо меню
      } else {
        toast.error(data.message);
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Статус: чи меню цього чату зараз відкрите?
  const menuOpen = openMenu.id === id && openMenu.open;

  // Закривати меню, якщо клік відбувся за межами самого меню і кнопки “три крапки”
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Якщо меню не відкрито — нічого не робимо
      if (!menuOpen) return;

      // Якщо клік був всередині меню або на три крапки, теж нічого не робимо
      if (
        menuRef.current?.contains(event.target) ||
        triggerRef.current?.contains(event.target)
      ) {
        return;
      }

      // Інакше — закриваємо меню
      setOpenMenu({ id: 0, open: false });
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen, setOpenMenu]);

  return (
    <div
      onClick={selectChat}
      className="flex items-center justify-between p-2 text-white/80 hover:bg-white/10 
      rounded-lg text-sm group cursor-pointer"
    >
      <p className="truncate max-w-[150px]">{name}</p>

      {/* Іконка “три крапки” */}
      <div
        ref={triggerRef}
        onClick={(e) => {
          e.stopPropagation();
          setOpenMenu({ id, open: !menuOpen });
        }}
        className="group relative flex items-center justify-center h-6 w-6 hover:bg-black/80 rounded-lg"
      >
        <Image
          src={assets.three_dots}
          alt=""
          className={`w-4 ${menuOpen ? '' : 'hidden'} group-hover:block`}
        />

        {/* Якщо меню відкрито, рендеримо pop-up */}
        {menuOpen && (
          <div
            ref={menuRef}
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-7 z-50 bg-gray-700 rounded-xl w-32 p-2"
          >
            <MenuItem icon={assets.pencil_icon} text="Rename" onClick={renameHandler} />
            <MenuItem icon={assets.delete_icon} text="Delete" onClick={deleteHandler} />
            <MenuItem
              icon={assets.staple_icon}
              text={pinned ? 'Unpin' : 'Pin'}
              onClick={pinHandler}
            />
          </div>
        )}
      </div>
    </div>
  );
};

// Допоміжний компонент для пунктів меню
const MenuItem = ({ icon, text, onClick }) => (
  <div onClick={onClick} className="flex items-center gap-3 hover:bg-white/10 px-3 py-2 rounded-lg">
    <Image src={icon} alt="" className="w-4" />
    <p>{text}</p>
  </div>
);

export default ChatLabel;
