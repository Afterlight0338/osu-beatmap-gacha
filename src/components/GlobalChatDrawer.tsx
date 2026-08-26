import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGacha } from '../context/GachaContext';
import { chatService, ChatMessage, OnlinePlayer } from '../services/chatService';
import { GiftModal } from './GiftModal';
import { TradeModal } from './TradeModal';
import {
  MessageSquare,
  Users,
  Send,
  X,
  Gift,
  Shield,
  Clock,
  AlertCircle,
  Trash2,
  ArrowLeftRight,
} from 'lucide-react';
import { sfx } from '../audio/sfx';

interface GlobalChatDrawerProps {
  allUsers?: { osu_id: number; username: string; avatar_url?: string; country_code?: string }[];
}

export const GlobalChatDrawer: React.FC<GlobalChatDrawerProps> = ({ allUsers = [] }) => {
  const { user, isAuthenticated } = useAuth();
  const { totalPulls, collectionRecords, poolMap } = useGacha();

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'players'>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [onlinePlayers, setOnlinePlayers] = useState<OnlinePlayer[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedGiftTarget, setSelectedGiftTarget] = useState<OnlinePlayer | null>(null);
  const [isGiftModalOpen, setIsGiftModalOpen] = useState<boolean>(false);
  const [selectedTradeTarget, setSelectedTradeTarget] = useState<OnlinePlayer | null>(null);
  const [isTradeModalOpen, setIsTradeModalOpen] = useState<boolean>(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const lastReadTimestampRef = useRef<number>(Date.now());

  const userIsAdmin = user?.username === 'RyoYamada' || user?.osuId === 14671577;

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize Chat & Presence on mount / auth change
  useEffect(() => {
    // Find rarest card owned
    const rarestRecord = collectionRecords.slice().sort((a, b) => {
      const mapA = poolMap.get(a.beatmapId);
      const mapB = poolMap.get(b.beatmapId);
      return (mapB?.popularityScore || 0) - (mapA?.popularityScore || 0);
    })[0];
    const rarestCardTitle = rarestRecord ? poolMap.get(rarestRecord.beatmapId)?.title : undefined;

    chatService.init(
      user?.osuId
        ? {
            osuId: user.osuId,
            username: user.username,
            avatarUrl: user.avatarUrl || undefined,
            countryCode: user.countryCode || undefined,
            totalPulls,
            rarestCard: rarestCardTitle,
          }
        : null
    );

    const unsubMessages = chatService.onMessages((msgs) => {
      setMessages(msgs);
      if (!isOpen) {
        const unread = msgs.filter(
          (m) => m.createdAt > lastReadTimestampRef.current && m.osuId !== user?.osuId
        ).length;
        setUnreadCount(unread);
      } else {
        lastReadTimestampRef.current = Date.now();
        setUnreadCount(0);
      }
    });

    const unsubPresence = chatService.onPresence((players) => {
      setOnlinePlayers(players);
    });

    return () => {
      unsubMessages();
      unsubPresence();
    };
  }, [user?.osuId, user?.username, user?.avatarUrl, user?.countryCode, isOpen]);

  useEffect(() => {
    if (isOpen) {
      lastReadTimestampRef.current = Date.now();
      setUnreadCount(0);
      scrollToBottom();
    }
  }, [isOpen, messages.length]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isAuthenticated || !user?.osuId) {
      setErrorMsg('Please log in with your osu! account to chat.');
      return;
    }

    const text = inputText.trim();
    if (!text) return;

    setIsSending(true);
    setErrorMsg(null);

    const res = await chatService.sendMessage({
      osuId: user.osuId,
      username: user.username,
      avatarUrl: user.avatarUrl || undefined,
      countryCode: user.countryCode || undefined,
      text,
      isAdmin: user.username === 'RyoYamada' || user.osuId === 14671577,
    });

    setIsSending(false);
    if (!res.success) {
      setErrorMsg(res.error || 'Failed to send message.');
      sfx.playError();
    } else {
      setInputText('');
      sfx.playClick();
      scrollToBottom();
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    if (!confirm('Admin: Delete this message for all players?')) return;
    await chatService.deleteMessage(msgId);
    sfx.playClick();
  };

  const handleClearAllChat = async () => {
    if (!confirm('Admin: Clear all global chat messages?')) return;
    await chatService.clearAllChat();
    sfx.playClick();
  };

  const handleOpenGiftModal = (player: OnlinePlayer) => {
    setSelectedGiftTarget(player);
    setIsGiftModalOpen(true);
  };

  const handleOpenTradeModal = (player: OnlinePlayer) => {
    setSelectedTradeTarget(player);
    setIsTradeModalOpen(true);
  };

  return (
    <>
      {/* Floating Chat / Presence Trigger Pill */}
      <div className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-40 animate-fade-in">
        <button
          type="button"
          onClick={() => {
            sfx.playClick();
            setIsOpen(!isOpen);
          }}
          className="group relative flex items-center space-x-2.5 px-4 py-2.5 rounded-full bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/40 hover:border-pink-500/60 shadow-2xl shadow-indigo-950/80 text-white font-mono text-xs font-bold transition-all hover:scale-105"
        >
          <div className="relative flex items-center justify-center">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping absolute" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 relative" />
          </div>
          <span>{Math.max(1, onlinePlayers.length)} Online</span>
          <span className="text-slate-600">•</span>
          <MessageSquare className="w-4 h-4 text-pink-400 group-hover:rotate-12 transition-transform" />
          <span>Global Chat</span>

          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1 px-1.5 py-0.5 rounded-full bg-pink-600 text-white text-[10px] font-bold animate-bounce shadow-md">
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Slide-Over Drawer Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md h-full bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col justify-between">
            {/* Top Bar Header */}
            <div className="p-4 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center space-x-2">
                <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
                  <button
                    onClick={() => setActiveTab('chat')}
                    className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all flex items-center space-x-1.5 ${
                      activeTab === 'chat'
                        ? 'bg-pink-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Chat</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('players')}
                    className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all flex items-center space-x-1.5 ${
                      activeTab === 'players'
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Online ({Math.max(1, onlinePlayers.length)})</span>
                  </button>
                </div>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Area */}
            {activeTab === 'chat' ? (
              <div className="flex-1 flex flex-col justify-between overflow-hidden">
                {/* 12h Purge Notice & Admin Clear */}
                <div className="p-2 bg-slate-950/90 border-b border-slate-800/80 text-[10px] font-mono text-slate-400 flex items-center justify-between px-4 flex-shrink-0">
                  <div className="flex items-center space-x-1.5">
                    <Clock className="w-3 h-3 text-cyan-400" />
                    <span>Realtime Chat (Auto-cleared after 12h)</span>
                  </div>
                  {userIsAdmin && (
                    <button
                      onClick={handleClearAllChat}
                      className="px-2 py-0.5 rounded bg-red-950 hover:bg-red-900 border border-red-800/60 text-red-300 text-[9px] font-bold flex items-center space-x-1 transition-colors"
                      title="Admin: Delete all chat messages"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                      <span>Clear All</span>
                    </button>
                  )}
                </div>

                {/* Messages Feed */}
                <div className="flex-1 p-4 overflow-y-auto space-y-3">
                  {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-2">
                      <MessageSquare className="w-8 h-8 text-slate-700" />
                      <p className="text-sm font-bold text-slate-400">No Messages Yet</p>
                      <p className="text-xs font-mono">Be the first to say hello to all online summoners!</p>
                    </div>
                  ) : (
                    messages.map((m) => {
                      const isSelf = m.osuId === user?.osuId;
                      const timeStr = new Date(m.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      });

                      return (
                        <div
                          key={m.id}
                          className={`group flex items-start space-x-2.5 ${isSelf ? 'flex-row-reverse space-x-reverse' : ''}`}
                        >
                          {/* Avatar */}
                          {m.avatarUrl ? (
                            <img
                              src={m.avatarUrl}
                              alt=""
                              className="w-8 h-8 rounded-full border border-slate-700 flex-shrink-0 mt-0.5 object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-0.5">
                              {m.username.slice(0, 2)}
                            </div>
                          )}

                          <div className={`max-w-[78%] space-y-0.5 ${isSelf ? 'items-end text-right' : ''}`}>
                            <div className={`flex items-center space-x-1.5 text-[10px] font-mono ${isSelf ? 'justify-end' : ''}`}>
                              <span className="font-bold text-slate-300 truncate max-w-[120px]">
                                {m.username}
                              </span>
                              {m.isAdmin && (
                                <span className="px-1 py-0.2 rounded bg-amber-950 border border-amber-500/50 text-amber-300 font-bold text-[9px] flex items-center space-x-0.5">
                                  <Shield className="w-2.5 h-2.5" />
                                  <span>ADMIN</span>
                                </span>
                              )}
                              <span className="text-slate-500">{timeStr}</span>

                              {/* Admin Delete Message Button */}
                              {userIsAdmin && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteMessage(m.id)}
                                  title="Admin: Delete message"
                                  className="p-1 rounded opacity-60 hover:opacity-100 hover:bg-red-950 text-red-400 transition-all"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>

                            {/* Message Bubble */}
                            <div
                              className={`p-2.5 rounded-2xl text-xs font-sans break-words ${
                                isSelf
                                  ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-tr-none shadow-md'
                                  : m.isAdmin
                                  ? 'bg-amber-950/40 border border-amber-500/40 text-amber-100 rounded-tl-none'
                                  : 'bg-slate-950 border border-slate-800 text-slate-200 rounded-tl-none'
                              }`}
                            >
                              {m.text}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Error Notice */}
                {errorMsg && (
                  <div className="p-2 mx-3 mb-1 rounded-xl bg-red-950/80 border border-red-800 text-[11px] text-red-300 flex items-center space-x-1.5 font-mono">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Input Bar */}
                <div className="p-3 border-t border-slate-800 bg-slate-950/90 flex-shrink-0">
                  {isAuthenticated ? (
                    <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="Type a message… (Max 250 chars)"
                        maxLength={250}
                        className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500 font-mono"
                      />
                      <button
                        type="submit"
                        disabled={isSending || !inputText.trim()}
                        className="p-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white transition-all shadow-md shadow-pink-600/30"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </form>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-center text-xs font-mono text-slate-400">
                      🔒 Log in with osu! to chat and interact with players
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Online Players List */
              <div className="flex-1 p-4 overflow-y-auto space-y-2.5">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-mono text-slate-400">
                  <span>ACTIVE SUMMONERS ({Math.max(1, onlinePlayers.length)})</span>
                  <span className="text-emerald-400 flex items-center space-x-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Live Presence</span>
                  </span>
                </div>

                {onlinePlayers.length === 0 ? (
                  <div className="text-center p-6 text-slate-500 font-mono text-xs">
                    No other players currently active.
                  </div>
                ) : (
                  onlinePlayers.map((p) => {
                    const isMe = p.osuId === user?.osuId;
                    return (
                      <div
                        key={p.osuId}
                        className="p-3 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-all flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          <div className="relative flex-shrink-0">
                            {p.avatarUrl ? (
                              <img
                                src={p.avatarUrl}
                                alt=""
                                className="w-10 h-10 rounded-full border border-slate-700 object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs text-white">
                                {p.username.slice(0, 2)}
                              </div>
                            )}
                            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-950" />
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center space-x-1.5">
                              <h4 className="text-sm font-bold text-white truncate">{p.username}</h4>
                              {isMe && (
                                <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-800 text-pink-300">
                                  YOU
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] font-mono text-slate-500">
                              {p.totalPulls ? `${p.totalPulls.toLocaleString()} Total Pulls` : 'Summoner'}
                            </p>
                          </div>
                        </div>

                        {!isMe && isAuthenticated && (
                          <div className="flex items-center space-x-1.5 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => handleOpenTradeModal(p)}
                              className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-mono text-xs font-bold transition-all shadow-md flex items-center space-x-1"
                              title="Propose card trade"
                            >
                              <ArrowLeftRight className="w-3.5 h-3.5" />
                              <span>Trade</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenGiftModal(p)}
                              className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-mono text-xs font-bold transition-all shadow-md flex items-center space-x-1"
                              title="Send gift"
                            >
                              <Gift className="w-3.5 h-3.5" />
                              <span>Gift</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Send Gift Modal */}
      {isGiftModalOpen && (
        <GiftModal
          isOpen={isGiftModalOpen}
          onClose={() => setIsGiftModalOpen(false)}
          targetPlayer={selectedGiftTarget}
          allUsers={allUsers}
        />
      )}

      {/* Propose Trade Modal */}
      {isTradeModalOpen && (
        <TradeModal
          isOpen={isTradeModalOpen}
          onClose={() => setIsTradeModalOpen(false)}
          targetPlayer={selectedTradeTarget}
          allUsers={allUsers}
        />
      )}
    </>
  );
};
