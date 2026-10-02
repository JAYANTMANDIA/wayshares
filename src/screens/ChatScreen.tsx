import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Send,
  Phone,
  Shield,
  CheckCheck,
  ChevronLeft,
  Car,
  Clock,
  Sparkles,
  Search,
  MessageSquare,
  AlertCircle,
  ThumbsUp,
  X
} from 'lucide-react';
import { store } from '../services/store';
import { AppScreen, ChatConversation } from '../types';
import { RateDriverModal } from '../components/RateDriverModal';

interface ChatScreenProps {
  onNavigate: (screen: AppScreen) => void;
  defaultDriverId?: string;
}

const QUICK_PROMPTS = [
  'Where are you now?',
  'I am at the pickup point',
  'Running 3 mins late',
  'Is boot space empty?',
  'Which color is the car?'
];

export const ChatScreen: React.FC<ChatScreenProps> = ({ onNavigate, defaultDriverId }) => {
  const [conversations, setConversations] = useState<ChatConversation[]>(store.conversations);
  const [selectedConvId, setSelectedConvId] = useState<string>(() => {
    if (defaultDriverId) {
      const match = store.conversations.find((c) => c.driverId === defaultDriverId);
      if (match) return match.id;
    }
    return store.conversations[0]?.id || 'conv_rajesh_01';
  });
  const [inputText, setInputText] = useState<string>('');
  const [showCallModal, setShowCallModal] = useState<boolean>(false);
  const [showRateModal, setShowRateModal] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'chat' | 'list'>('chat');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Subscribe to store updates
  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setConversations([...store.conversations]);
    });
    return unsubscribe;
  }, []);

  const activeConv = conversations.find((c) => c.id === selectedConvId) || conversations[0];
  const activeMessages = Array.isArray(activeConv?.messages) ? activeConv.messages : [];

  // Mark as read when active
  useEffect(() => {
    if (activeConv && activeConv.unreadCount > 0) {
      store.markConversationRead(activeConv.id);
    }
  }, [activeConv?.id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages.length]);

  const handleSend = (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text.trim() || !activeConv) return;

    store.sendMessage(activeConv.id, text.trim());
    setInputText('');
  };

  const handleSelectConv = (convId: string) => {
    setSelectedConvId(convId);
    setViewMode('chat');
  };

  return (
    <div className="w-full min-h-[720px] bg-neutral-50 flex flex-col justify-between select-none relative pb-16">
      {/* Top Header */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-neutral-200 shadow-2xs">
        <div className="px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (viewMode === 'chat' && conversations.length > 1) {
                  setViewMode('list');
                } else {
                  onNavigate('home');
                }
              }}
              className="p-1.5 -ml-1 text-neutral-700 hover:text-black hover:bg-neutral-100 rounded-full transition-colors"
            >
              <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
            </button>

            {viewMode === 'chat' && activeConv ? (
              <div
                onClick={() => setViewMode('list')}
                className="flex items-center gap-2.5 cursor-pointer group"
              >
                <div className="relative">
                  <img
                    src={activeConv.driverPhoto}
                    alt={activeConv.driverName}
                    className="w-10 h-10 rounded-full object-cover border border-neutral-200 group-hover:ring-2 group-hover:ring-orange-500/40 transition-all"
                  />
                  {activeConv.isOnline && (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-bold text-neutral-900 leading-tight">
                      {activeConv.driverName}
                    </h3>
                    <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded-sm">
                      {activeConv.driverRating} ★
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-500 line-clamp-1">
                    {activeConv.isOnline ? 'Online • In Highway Transit' : 'Offline'}
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <h3 className="text-base font-extrabold text-neutral-900 leading-tight">
                  Driver Chats
                </h3>
                <p className="text-xs text-neutral-500">Communicate with verified drivers</p>
              </div>
            )}
          </div>

          {/* Right Header Actions */}
          {viewMode === 'chat' && activeConv && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowRateModal(true)}
                className="text-[11px] font-bold text-amber-600 bg-amber-50 hover:bg-amber-100 px-2.5 py-1.5 rounded-lg flex items-center gap-1 border border-amber-200 transition-colors"
              >
                <span>★ Rate</span>
              </button>

              <button
                onClick={() => setShowCallModal(true)}
                className="w-8 h-8 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-700 flex items-center justify-center border border-emerald-200 transition-colors"
                title="Call driver"
              >
                <Phone className="w-4 h-4" />
              </button>

              <button
                onClick={() => onNavigate('safety')}
                className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-700 flex items-center justify-center transition-colors"
                title="Safety shield"
              >
                <Shield className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Active Route banner when in chat mode */}
        {viewMode === 'chat' && activeConv && (
          <div className="px-4 py-1.5 bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50/50 border-t border-orange-100/60 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-neutral-700 font-medium">
              <Car className="w-3.5 h-3.5 text-orange-600" />
              <span className="font-semibold text-neutral-900">{activeConv.rideRoute || 'Intercity Ride'}</span>
              <span className="text-neutral-400">•</span>
              <span className="text-neutral-500 text-[11px] truncate max-w-[150px]">
                {activeConv.vehicleMakeModel}
              </span>
            </div>
            <button
              onClick={() => onNavigate('ride_tracking')}
              className="text-[11px] font-bold text-orange-600 hover:text-orange-700 hover:underline flex items-center gap-0.5"
            >
              <span>Live Track →</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {!activeConv ? (
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center mb-4">
            <MessageSquare className="w-7 h-7" />
          </div>
          <h2 className="text-base font-bold text-neutral-900">No driver chats yet</h2>
          <p className="max-w-xs text-xs leading-relaxed text-neutral-500 mt-1.5">
            Your conversation will appear here after a driver is assigned to your ride.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="mt-5 rounded-xl bg-black px-4 py-2.5 text-xs font-semibold text-white hover:bg-neutral-800"
          >
            Back to Home
          </button>
        </div>
      ) : viewMode === 'list' ? (
        /* Conversation List Mode */
        <div className="flex-1 p-4 space-y-3">
          <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
            Active Driver Conversations ({conversations.length})
          </div>

          {conversations.map((conv) => (
            <motion.div
              key={conv.id}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleSelectConv(conv.id)}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                conv.id === selectedConvId
                  ? 'bg-orange-50/40 border-orange-200 shadow-xs'
                  : 'bg-white border-neutral-200/80 hover:border-neutral-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img
                    src={conv.driverPhoto}
                    alt={conv.driverName}
                    className="w-12 h-12 rounded-full object-cover border border-neutral-200"
                  />
                  {conv.isOnline && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-neutral-900 truncate">
                      {conv.driverName}
                    </h4>
                    <span className="text-[10px] text-neutral-400 font-medium">
                      {conv.lastMessageTime}
                    </span>
                  </div>

                  <p className="text-xs text-orange-600 font-medium truncate mt-0.5">
                    {conv.rideRoute}
                  </p>

                  <p className="text-xs text-neutral-500 truncate mt-0.5">
                    {conv.lastMessage}
                  </p>
                </div>

                {conv.unreadCount > 0 && (
                  <span className="w-5 h-5 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                    {conv.unreadCount}
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        /* Single Chat Thread */
        <div className="flex-1 flex flex-col justify-between">
          {/* Messages list */}
          <div className="flex-1 p-4 space-y-3 overflow-y-auto">
            {/* Safety & Encryption notice */}
            <div className="text-center py-1">
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-neutral-500 bg-neutral-100 px-3 py-1 rounded-full">
                <Shield className="w-3 h-3 text-emerald-600" />
                <span>End-to-end encrypted carpool safety channel</span>
              </span>
            </div>

            {activeMessages.map((msg) => {
              const isUser = msg.sender === 'user';
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start items-end gap-2'}`}
                >
                  {!isUser && (
                    <img
                      src={activeConv.driverPhoto}
                      alt={activeConv.driverName}
                      className="w-6 h-6 rounded-full object-cover shrink-0 mb-1 border border-neutral-200"
                    />
                  )}

                  <div
                    className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 shadow-2xs text-xs leading-relaxed ${
                      isUser
                        ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-br-xs'
                        : 'bg-white border border-neutral-200/90 text-neutral-800 rounded-bl-xs'
                    }`}
                  >
                    <p className="font-normal">{msg.text}</p>
                    <div
                      className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                        isUser ? 'text-orange-100' : 'text-neutral-400'
                      }`}
                    >
                      <span>{msg.time}</span>
                      {isUser && <CheckCheck className="w-3.5 h-3.5 stroke-[2.5]" />}
                    </div>
                  </div>
                </motion.div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Reply Chips */}
          <div className="px-3 py-1.5 bg-white/80 border-t border-neutral-150 overflow-x-auto no-scrollbar flex items-center gap-1.5">
            <span className="text-[10px] uppercase font-bold text-neutral-400 shrink-0 pl-1">
              Quick:
            </span>
            {QUICK_PROMPTS.map((prompt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSend(prompt)}
                className="shrink-0 text-xs px-2.5 py-1 bg-neutral-100 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 text-neutral-600 rounded-full font-medium border border-neutral-200/60 transition-colors whitespace-nowrap"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Sticky Input Footer */}
          <div className="sticky bottom-0 bg-white border-t border-neutral-200 px-3 py-2.5 flex items-center gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={`Message ${activeConv.driverName.split(' ')[0]}...`}
              className="flex-1 text-xs py-2.5 px-3.5 bg-neutral-50 rounded-xl border border-neutral-200 focus:outline-hidden focus:border-orange-500 focus:bg-white text-neutral-900 placeholder:text-neutral-400"
            />

            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={() => handleSend()}
              disabled={!inputText.trim()}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                inputText.trim()
                  ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-xs'
                  : 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
              }`}
            >
              <Send className="w-4 h-4 ml-0.5" />
            </motion.button>
          </div>
        </div>
      )}

      {/* Simulated Audio Call Modal */}
      {showCallModal && activeConv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-neutral-900 text-white rounded-3xl w-full max-w-xs p-6 text-center space-y-4 shadow-2xl relative"
          >
            <div className="relative mx-auto w-20 h-20">
              <img
                src={activeConv.driverPhoto}
                alt={activeConv.driverName}
                className="w-20 h-20 rounded-full object-cover border-2 border-orange-500"
              />
              <span className="absolute inset-0 rounded-full border-2 border-emerald-400 animate-ping opacity-75" />
            </div>

            <div>
              <h4 className="text-lg font-bold">{activeConv.driverName}</h4>
              <p className="text-xs text-neutral-400">{activeConv.vehicleMakeModel}</p>
              <span className="inline-block mt-2 text-xs font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2.5 py-0.5 rounded-full">
                Calling via In-App VOIP (Number Masked)
              </span>
            </div>

            <p className="text-[11px] text-neutral-400 leading-relaxed">
              Your real mobile number is masked for privacy. Audio is routed securely via UberX Intercity Voice.
            </p>

            <div className="pt-2 flex justify-center">
              <button
                onClick={() => setShowCallModal(false)}
                className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-lg transition-transform active:scale-95"
              >
                <Phone className="w-6 h-6 rotate-[135deg]" />
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Rate Driver Modal */}
      {showRateModal && activeConv && (
        <RateDriverModal
          isOpen={showRateModal}
          onClose={() => setShowRateModal(false)}
          rideId="ride_blr_mys_01"
          driverId={activeConv.driverId}
          driverName={activeConv.driverName}
          driverPhoto={activeConv.driverPhoto}
          vehicleInfo={activeConv.vehicleMakeModel}
          route={activeConv.rideRoute}
        />
      )}
    </div>
  );
};
