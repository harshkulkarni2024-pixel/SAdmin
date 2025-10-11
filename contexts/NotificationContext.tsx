import React, { createContext, useContext, useState, useCallback } from 'react';
import { Icon } from '../components/common/Icon';

type NotificationType = 'success' | 'error' | 'info';

interface Notification {
  id: number;
  message: string;
  type: NotificationType;
}

// The context will provide a function to add notifications
const NotificationContext = createContext<((message: string, type?: NotificationType) => void) | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback((message: string, type: NotificationType = 'info') => {
    const id = Date.now() + Math.random();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000); // Notifications disappear after 5 seconds
  }, []);

  const removeNotification = (id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const getStyling = (type: NotificationType) => {
    switch (type) {
      case 'success': return { bg: 'bg-green-600', border: 'border-green-500', icon: 'check-circle' as const };
      case 'error': return { bg: 'bg-red-600', border: 'border-red-500', icon: 'exclamation-triangle' as const };
      case 'info':
      default:
        return { bg: 'bg-blue-600', border: 'border-blue-500', icon: 'information-circle' as const };
    }
  };

  return (
    <NotificationContext.Provider value={addNotification}>
      {children}
      <div className="fixed top-5 right-5 z-[100] space-y-2 w-full max-w-sm">
        {notifications.map(notification => {
          const { bg, border, icon } = getStyling(notification.type);
          return (
            <div
              key={notification.id}
              className={`${bg} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 border ${border} animate-fade-in`}
            >
              <Icon name={icon} className="w-6 h-6 flex-shrink-0" />
              <span className="flex-grow text-sm">{notification.message}</span>
              <button onClick={() => removeNotification(notification.id)} className="text-white/70 hover:text-white flex-shrink-0 p-1">&times;</button>
            </div>
          );
        })}
      </div>
    </NotificationContext.Provider>
  );
};

export const useNotification = (): ((message: string, type?: NotificationType) => void) => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
