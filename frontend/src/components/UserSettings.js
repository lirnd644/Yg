import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import axios from 'axios';
import { getAvatarUrl } from '../utils/avatarUtils';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const UserSettings = ({ user, onClose }) => {
  const { updateProfile, logout } = useAuth();
  const [formData, setFormData] = useState({
    display_name: user.display_name,
    avatar_url: user.avatar_url || '',
    theme: user.theme || 'light',
    notifications_enabled: user.notifications_enabled ?? true
  });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check file type
    if (!file.type.startsWith('image/')) {
      toast.error('Выберите изображение');
      return;
    }

    // Check file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Файл слишком большой (максимум 5MB)');
      return;
    }

    setUploading(true);
    const formDataUpload = new FormData();
    formDataUpload.append('file', file);

    try {
      const response = await axios.post(`${API}/upload-avatar`, formDataUpload, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const avatarUrl = `${BACKEND_URL}${response.data.avatar_url}`;
      setFormData(prev => ({ ...prev, avatar_url: avatarUrl }));
      toast.success('Аватар загружен!');
    } catch (error) {
      console.error('Avatar upload error:', error);
      toast.error('Ошибка загрузки аватара');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const result = await updateProfile(formData);
    
    if (result.success) {
      toast.success('Настройки сохранены!');
    }
    
    setLoading(false);
  };

  const handleLogout = async () => {
    await logout();
  };

  const getSettingsAvatarUrl = () => {
    if (formData.avatar_url) {
      return formData.avatar_url;
    }
    return getAvatarUrl(user, 80);
  };

  return (
    <div className="flex-1 bg-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Настройки</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 border-r border-gray-200 bg-gray-50">
          <nav className="p-4">
            <button
              onClick={() => setActiveTab('profile')}
              className={`w-full text-left px-3 py-2 rounded-md mb-2 ${
                activeTab === 'profile'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Профиль
            </button>
            <button
              onClick={() => setActiveTab('appearance')}
              className={`w-full text-left px-3 py-2 rounded-md mb-2 ${
                activeTab === 'appearance'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Внешний вид
            </button>
            <button
              onClick={() => setActiveTab('notifications')}
              className={`w-full text-left px-3 py-2 rounded-md mb-2 ${
                activeTab === 'notifications'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Уведомления
            </button>
            <button
              onClick={() => setActiveTab('account')}
              className={`w-full text-left px-3 py-2 rounded-md ${
                activeTab === 'account'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Аккаунт
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 p-6">
          {activeTab === 'profile' && (
            <div className="max-w-lg">
              <h3 className="text-lg font-medium text-gray-900 mb-6">Профиль</h3>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="flex items-center space-x-6">
                  <div className="relative">
                    <img
                      src={getAvatarUrl()}
                      alt="Avatar"
                      className="w-20 h-20 rounded-full object-cover border-2 border-gray-200"
                    />
                    {uploading && (
                      <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-white animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {uploading ? 'Загрузка...' : 'Изменить аватар'}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                    <p className="text-sm text-gray-500 mt-2">
                      Поддерживаются JPG, PNG, GIF до 5MB
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Отображаемое имя
                  </label>
                  <input
                    type="text"
                    name="display_name"
                    value={formData.display_name}
                    onChange={handleChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Имя пользователя
                  </label>
                  <input
                    type="text"
                    value={user.username}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50"
                    disabled
                  />
                  <p className="mt-1 text-sm text-gray-500">Имя пользователя нельзя изменить</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Email
                  </label>
                  <input
                    type="email"
                    value={user.email}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50"
                    disabled
                  />
                  <p className="mt-1 text-sm text-gray-500">Email нельзя изменить</p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                >
                  {loading ? 'Сохранение...' : 'Сохранить изменения'}
                </button>
              </form>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="max-w-lg">
              <h3 className="text-lg font-medium text-gray-900 mb-6">Внешний вид</h3>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Тема
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="theme"
                        value="light"
                        checked={formData.theme === 'light'}
                        onChange={handleChange}
                        className="mr-2"
                      />
                      Светлая
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="theme"
                        value="dark"
                        checked={formData.theme === 'dark'}
                        onChange={handleChange}
                        className="mr-2"
                      />
                      Темная
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="theme"
                        value="auto"
                        checked={formData.theme === 'auto'}
                        onChange={handleChange}
                        className="mr-2"
                      />
                      Автоматическая
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                >
                  {loading ? 'Сохранение...' : 'Сохранить изменения'}
                </button>
              </form>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="max-w-lg">
              <h3 className="text-lg font-medium text-gray-900 mb-6">Уведомления</h3>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      Включить уведомления
                    </label>
                    <p className="text-sm text-gray-500">
                      Получать уведомления о новых сообщениях
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    name="notifications_enabled"
                    checked={formData.notifications_enabled}
                    onChange={handleChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                >
                  {loading ? 'Сохранение...' : 'Сохранить изменения'}
                </button>
              </form>
            </div>
          )}

          {activeTab === 'account' && (
            <div className="max-w-lg">
              <h3 className="text-lg font-medium text-gray-900 mb-6">Аккаунт</h3>
              
              <div className="space-y-6">
                <div className="bg-gray-50 p-4 rounded-md">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Информация об аккаунте</h4>
                  <p className="text-sm text-gray-600">
                    Аккаунт создан: {new Date(user.created_at).toLocaleDateString('ru-RU')}
                  </p>
                  <p className="text-sm text-gray-600">
                    ID: {user.id}
                  </p>
                </div>

                <div className="border-t pt-6">
                  <button
                    onClick={handleLogout}
                    className="w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                  >
                    Выйти из аккаунта
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserSettings;