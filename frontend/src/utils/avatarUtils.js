const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const getAvatarUrl = (user, size = 48) => {
  if (user?.avatar_url) {
    // If avatar_url starts with /api, prepend backend URL
    if (user.avatar_url.startsWith('/api')) {
      return `${BACKEND_URL}${user.avatar_url}`;
    }
    return user.avatar_url;
  }
  
  // Generate beautiful avatar using UI Avatars service
  const name = user?.display_name || user?.username || '?';
  const backgroundColor = getBackgroundColor(name);
  
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=${size}&background=${backgroundColor}&color=ffffff&bold=true&font-size=0.6`;
};

export const getGroupAvatarUrl = (groupName, size = 48) => {
  const backgroundColor = getBackgroundColor(groupName || 'Group');
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(groupName || 'Группа')}&size=${size}&background=${backgroundColor}&color=ffffff&bold=true&font-size=0.5`;
};

// Generate consistent color based on name
const getBackgroundColor = (name) => {
  const colors = [
    '3B82F6', // Blue
    '10B981', // Green  
    'F59E0B', // Yellow
    'EF4444', // Red
    '8B5CF6', // Purple
    'F97316', // Orange
    '06B6D4', // Cyan
    'EC4899', // Pink
    '84CC16', // Lime
    '6366F1', // Indigo
  ];
  
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
};

export const preloadAvatar = (url) => {
  const img = new Image();
  img.src = url;
  return img;
};