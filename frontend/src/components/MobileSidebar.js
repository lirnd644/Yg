import React, { useState } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import CreateGroupModal from './CreateGroupModal';
import { getAvatarUrl, getGroupAvatarUrl } from '../utils/avatarUtils';

const MobileSidebar = ({
  user,
  conversations,
  users,
  selectedConversation,
  onSelectConversation,
  onStartConversation,
  onCreateGroup,
  onOpenSettings,
  isConnected,
  refreshConversations,
  isMobile = false
}) => {
  const [activeTab, setActiveTab] = useState('chats');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  const filteredConversations = conversations.filter(conv => {
    if (!searchQuery) return true;
    
    if (conv.is_group) {
      return conv.group_name?.toLowerCase().includes(searchQuery.toLowerCase());
    } else {
      const otherParticipant = conv.participants.find(p => p.id !== user.id);
      return otherParticipant?.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
             otherParticipant?.username.toLowerCase().includes(searchQuery.toLowerCase());
    }
  });

  const filteredUsers = users.filter(u => {
    if (!searchQuery) return true;
    return u.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
           u.username.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return format(date, 'HH:mm');
    } else if (diffInHours < 48) {
      return 'Вчера';
    } else {
      return format(date, 'dd.MM', { locale: ru });
    }
  };

  const getConversationTitle = (conversation) => {
    if (conversation.is_group) {
      return conversation.group_name;
    } else {
      const otherParticipant = conversation.participants.find(p => p.id !== user.id);
      return otherParticipant?.display_name || 'Неизвестный пользователь';
    }
  };

  const getConversationAvatar = (conversation) => {
    if (conversation.is_group) {
      return getGroupAvatarUrl(conversation.group_name, 48);
    } else {
      const otherParticipant = conversation.participants.find(p => p.id !== user.id);
      return getAvatarUrl(otherParticipant, 48);
    }
  };

  return (
    <>
      <div className={`flex flex-col h-full ${isMobile ? 'bg-white' : ''}`}>
        {/* Header - только на десктопе или когда не мобильная версия */}
        {!isMobile && (
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <img
                  src={user.avatar_url || `https://via.placeholder.com/40x40/3B82F6/FFFFFF?text=${user.display_name[0]}`}
                  alt={user.display_name}
                  className="w-10 h-10 rounded-full"
                />
                <div className="ml-3">
                  <h3 className="font-semibold text-gray-900">{user.display_name}</h3>
                  <div className="flex items-center">
                    <div className={`w-2 h-2 rounded-full mr-1 ${isConnected ? 'bg-green-400' : 'bg-gray-400'}`}></div>
                    <span className="text-xs text-gray-500">
                      {isConnected ? 'В сети' : 'Не в сети'}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={onOpenSettings}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <input
              type="text"
              placeholder="Поиск..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <svg className="w-5 h-5 text-gray-400 absolute left-3 top-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('chats')}
            className={`flex-1 py-4 px-4 text-base font-medium ${
              activeTab === 'chats'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Чаты
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`flex-1 py-4 px-4 text-base font-medium ${
              activeTab === 'users'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Пользователи
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'chats' && (
            <div>
              {/* Create Group Button */}
              <div className="p-4 border-b border-gray-100">
                <button
                  onClick={() => setShowCreateGroup(true)}
                  className="w-full flex items-center justify-center py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-base font-medium"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Создать группу
                </button>
              </div>

              {/* Conversations List */}
              <div className="divide-y divide-gray-100">
                {filteredConversations.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">
                    {searchQuery ? 'Чаты не найдены' : 'Нет активных чатов'}
                  </div>
                ) : (
                  filteredConversations.map((conversation) => (
                    <div
                      key={conversation.id}
                      onClick={() => onSelectConversation(conversation)}
                      className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                        selectedConversation?.id === conversation.id ? 'bg-blue-50 border-r-2 border-blue-600' : ''
                      }`}
                    >
                      <div className="flex items-center">
                        <img
                          src={getConversationAvatar(conversation)}
                          alt={getConversationTitle(conversation)}
                          className="w-12 h-12 rounded-full flex-shrink-0"
                        />
                        <div className="ml-3 flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4 className="text-base font-medium text-gray-900 truncate">
                              {getConversationTitle(conversation)}
                            </h4>
                            {conversation.last_message && (
                              <span className="text-sm text-gray-500 flex-shrink-0 ml-2">
                                {formatTime(conversation.last_message.timestamp)}
                              </span>
                            )}
                          </div>
                          {conversation.last_message ? (
                            <p className="text-sm text-gray-500 truncate mt-1">
                              {conversation.last_message.sender_name}: {conversation.last_message.content}
                            </p>
                          ) : (
                            <p className="text-sm text-gray-400 italic mt-1">Нет сообщений</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="divide-y divide-gray-100">
              {filteredUsers.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  {searchQuery ? 'Пользователи не найдены' : 'Нет пользователей'}
                </div>
              ) : (
                filteredUsers.map((u) => (
                  <div
                    key={u.id}
                    onClick={() => onStartConversation(u.id)}
                    className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center">
                      <div className="relative flex-shrink-0">
                        <img
                          src={u.avatar_url || `https://via.placeholder.com/48x48/6B7280/FFFFFF?text=${u.display_name[0]}`}
                          alt={u.display_name}
                          className="w-12 h-12 rounded-full"
                        />
                        <div className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-white ${
                          u.is_online ? 'bg-green-400' : 'bg-gray-400'
                        }`}></div>
                      </div>
                      <div className="ml-3 min-w-0">
                        <h4 className="text-base font-medium text-gray-900 truncate">{u.display_name}</h4>
                        <p className="text-sm text-gray-500 truncate">@{u.username}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create Group Modal */}
      {showCreateGroup && (
        <CreateGroupModal
          users={users}
          onClose={() => setShowCreateGroup(false)}
          onCreateGroup={onCreateGroup}
        />
      )}
    </>
  );
};

export default MobileSidebar;