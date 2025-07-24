import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../context/WebSocketContext';
import MobileSidebar from './MobileSidebar';
import MobileChatWindow from './MobileChatWindow';
import UserSettings from './UserSettings';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const MobileDashboard = () => {
  const { user } = useAuth();
  const { isConnected } = useWebSocket();
  const [activeView, setActiveView] = useState('conversations'); // conversations, chat, settings
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [conversationsRes, usersRes] = await Promise.all([
          axios.get(`${API}/conversations`),
          axios.get(`${API}/users`)
        ]);
        
        setConversations(conversationsRes.data);
        setUsers(usersRes.data);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleStartConversation = async (userId) => {
    try {
      const response = await axios.post(`${API}/conversations`, {
        participant_ids: [userId],
        is_group: false
      });
      
      const newConversation = response.data;
      
      setConversations(prev => {
        const exists = prev.find(conv => conv.id === newConversation.id);
        if (exists) {
          return prev;
        }
        return [newConversation, ...prev];
      });
      
      setSelectedConversation(newConversation);
      setActiveView('chat');
      setSidebarOpen(false);
    } catch (error) {
      console.error('Error creating conversation:', error);
    }
  };

  const handleCreateGroup = async (groupData) => {
    try {
      const response = await axios.post(`${API}/groups`, groupData);
      const newGroup = response.data;
      
      setConversations(prev => [newGroup, ...prev]);
      setSelectedConversation(newGroup);
      setActiveView('chat');
      setSidebarOpen(false);
    } catch (error) {
      console.error('Error creating group:', error);
    }
  };

  const refreshConversations = async () => {
    try {
      const response = await axios.get(`${API}/conversations`);
      setConversations(response.data);
    } catch (error) {
      console.error('Error refreshing conversations:', error);
    }
  };

  const handleSelectConversation = (conversation) => {
    setSelectedConversation(conversation);
    setActiveView('chat');
    setSidebarOpen(false);
  };

  const handleBackToList = () => {
    setActiveView('conversations');
    setSidebarOpen(true);
    setSelectedConversation(null);
  };

  const handleOpenSettings = () => {
    setActiveView('settings');
    setSidebarOpen(false);
  };

  const handleCloseSettings = () => {
    setActiveView('conversations');
    setSidebarOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100 overflow-hidden">
      {/* Mobile Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between md:hidden">
        <div className="flex items-center">
          {activeView === 'chat' && (
            <button
              onClick={handleBackToList}
              className="mr-3 p-2 text-gray-600 hover:text-gray-900"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <h1 className="text-lg font-semibold text-gray-900">
            {activeView === 'chat' && selectedConversation 
              ? (selectedConversation.is_group 
                  ? selectedConversation.group_name 
                  : selectedConversation.participants?.find(p => p.id !== user.id)?.display_name || 'Чат')
              : activeView === 'settings' 
                ? 'Настройки'
                : 'Мессенджер'
            }
          </h1>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
          {activeView === 'conversations' && (
            <button
              onClick={handleOpenSettings}
              className="p-2 text-gray-600 hover:text-gray-900"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Layout */}
        <div className="hidden md:flex w-80 bg-white border-r border-gray-200">
          <MobileSidebar
            user={user}
            conversations={conversations}
            users={users}
            selectedConversation={selectedConversation}
            onSelectConversation={handleSelectConversation}
            onStartConversation={handleStartConversation}
            onCreateGroup={handleCreateGroup}
            onOpenSettings={handleOpenSettings}
            isConnected={isConnected}
            refreshConversations={refreshConversations}
          />
        </div>

        {/* Mobile Layout */}
        <div className="flex-1 md:hidden">
          {activeView === 'conversations' && (
            <MobileSidebar
              user={user}
              conversations={conversations}
              users={users}
              selectedConversation={selectedConversation}
              onSelectConversation={handleSelectConversation}
              onStartConversation={handleStartConversation}
              onCreateGroup={handleCreateGroup}
              onOpenSettings={handleOpenSettings}
              isConnected={isConnected}
              refreshConversations={refreshConversations}
              isMobile={true}
            />
          )}
          
          {activeView === 'chat' && (
            <MobileChatWindow
              conversation={selectedConversation}
              user={user}
              onConversationUpdate={refreshConversations}
              onBack={handleBackToList}
            />
          )}
          
          {activeView === 'settings' && (
            <UserSettings
              user={user}
              onClose={handleCloseSettings}
            />
          )}
        </div>

        {/* Desktop Main Content */}
        <div className="hidden md:flex flex-1 flex-col">
          {activeView === 'chat' && (
            <MobileChatWindow
              conversation={selectedConversation}
              user={user}
              onConversationUpdate={refreshConversations}
            />
          )}
          
          {activeView === 'settings' && (
            <UserSettings
              user={user}
              onClose={() => setActiveView('conversations')}
            />
          )}
          
          {activeView === 'conversations' && !selectedConversation && (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Выберите чат</h3>
                <p className="text-gray-500">Выберите существующий чат или начните новый разговор</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MobileDashboard;