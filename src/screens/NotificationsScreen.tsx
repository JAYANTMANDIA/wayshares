import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Bell, CheckCheck, Trash2, Calendar, ShieldCheck, CreditCard, Car } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { AppScreen, NotificationItem } from '../types';
import { store } from '../services/store';

interface NotificationsScreenProps {
  onNavigate: (screen: AppScreen) => void;
}

export const NotificationsScreen: React.FC<NotificationsScreenProps> = ({ onNavigate }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>(store.notifications);

  useEffect(() => {
    const update = () => setNotifications([...store.notifications]);
    return store.subscribe(update);
  }, []);

  const handleMarkRead = (id: string) => {
    store.markNotificationAsRead(id);
  };

  const handleClearAll = () => {
    store.clearAllNotifications();
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'booking':
        return <Calendar className="w-4 h-4 text-blue-500" />;
      case 'safety':
        return <ShieldCheck className="w-4 h-4 text-[#EF4444]" />;
      case 'payment':
        return <CreditCard className="w-4 h-4 text-emerald-500" />;
      case 'driver':
        return <Car className="w-4 h-4 text-amber-500" />;
      default:
        return <Bell className="w-4 h-4 text-neutral-600" />;
    }
  };

  return (
    <div className="w-full min-h-[720px] bg-white flex flex-col justify-between select-none pb-12">
      <div>
        <TopBar
          title="Notifications"
          onBack={() => onNavigate('home')}
          showMore={false}
          rightAction={
            notifications.length > 0 ? (
              <button
                onClick={handleClearAll}
                className="text-xs text-neutral-400 hover:text-black font-semibold flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            ) : null
          }
        />

        <div className="px-5 pt-2 space-y-2.5">
          {notifications.length === 0 ? (
            <div className="text-center py-16 px-4 bg-neutral-50 rounded-2xl border border-neutral-200">
              <Bell className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-neutral-700">No new notifications</p>
              <p className="text-xs text-neutral-500 mt-0.5">You're all caught up with trip updates.</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => handleMarkRead(n.id)}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                  n.read
                    ? 'border-neutral-200 bg-white text-neutral-600'
                    : 'border-neutral-900 bg-neutral-50 text-black shadow-2xs'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-white border border-neutral-200 shadow-2xs flex items-center justify-center shrink-0 mt-0.5">
                    {getIcon(n.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold leading-tight">{n.title}</h4>
                      <span className="text-[10px] text-neutral-400">{n.createdAt}</span>
                    </div>
                    <p className="text-xs text-neutral-600 mt-1 leading-relaxed font-normal">
                      {n.message}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
