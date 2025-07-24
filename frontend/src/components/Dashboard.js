import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../context/WebSocketContext';
import Sidebar from './Sidebar';
import ChatWindow from './ChatWindow';
import UserSettings from './UserSettings';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Dashboard = () => {
  const { user } = useAuth();
  const { isConnected } = useWebSocket();
  const [activeView, setActiveView] = useState('chat');
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

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
      
      // Update conversations list if not already exists
      setConversations(prev => {
        const exists = prev.find(conv => conv.id === newConversation.id);
        if (exists) {
          return prev;
        }
        return [newConversation, ...prev];
      });
      
      setSelectedConversation(newConversation);
      setActiveView('chat');
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-gray-100">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <Sidebar
          user={user}
          conversations={conversations}
          users={users}
          selectedConversation={selectedConversation}
          onSelectConversation={setSelectedConversation}
          onStartConversation={handleStartConversation}
          onCreateGroup={handleCreateGroup}
          onOpenSettings={() => setActiveView('settings')}
          isConnected={isConnected}
          refreshConversations={refreshConversations}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {activeView === 'chat' && (
          <ChatWindow
            conversation={selectedConversation}
            user={user}
            onConversationUpdate={refreshConversations}
          />
        )}
        
        {activeView === 'settings' && (
          <UserSettings
            user={user}
            onClose={() => setActiveView('chat')}
          />
        )}
      </div>

      {/* Mobile responsive overlay for sidebar */}
      <div className="md:hidden">
        {/* Add mobile menu toggle functionality here if needed */}
      </div>
    </div>
  );
};

export default Dashboard;