import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGacha } from '../context/GachaContext';
import { tradingService } from '../services/tradingService';
import { OnlinePlayer } from '../services/chatService';
import { Beatmap } from '../types/beatmap';
import { RARITY_CONFIGS } from '../gacha/rarity';
import { ArrowLeftRight, X, Send, Sparkles, CheckCircle2, AlertCircle, Search } from 'lucide-react';
import { sfx } from '../audio/sfx';

interface TradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetPlayer?: OnlinePlayer | null;
  allUsers?: { osu_id: number; username: string; avatar_url?: string; country_code?: string }[];
}

export const TradeModal: React.FC<TradeModalProps> = ({ isOpen, onClose, targetPlayer, allUsers = [] }) => {
  const { user } = useAuth();
  const { collectionRecords, poolMap, pool } = useGacha();

  const [selectedRecipientId, setSelectedRecipientId] = useState<number>(0);
  const [offeredCardIds, setOfferedCardIds] = useState<number[]>([]);
  const [requestedCardIds, setRequestedCardIds] = useState<number[]>([]);
  const [offeredStamina, setOfferedStamina] = useState<number>(0);
  const [tradeMessage, setTradeMessage] = useState<string>('');

  const [myCardSearch, setMyCardSearch] = useState<string>('');
  const [recipientCardSearch, setRecipientCardSearch] = useState<string>('');
  const [recipientOwnedIds, setRecipientOwnedIds] = useState<number[]>([]);
  const [loadingRecipientCards, setLoadingRecipientCards] = useState<boolean>(false);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (targetPlayer?.osuId) {
      setSelectedRecipientId(targetPlayer.osuId);
    } else if (allUsers.length > 0 && !selectedRecipientId) {
      const otherUser = allUsers.find((u) => u.osu_id !== user?.osuId);
      if (otherUser) setSelectedRecipientId(otherUser.osu_id);
    }
  }, [targetPlayer, allUsers, user?.osuId]);

  // Load recipient's collection when recipient changes
  useEffect(() => {
    if (selectedRecipientId) {
      setLoadingRecipientCards(true);
      tradingService.fetchUserCollection(selectedRecipientId).then((ids) => {
        setRecipientOwnedIds(ids);
        setLoadingRecipientCards(false);
      });
    }
  }, [selectedRecipientId]);

  const selectedRecipient = React.useMemo(() => {
    if (targetPlayer?.osuId === selectedRecipientId) return targetPlayer;
    return allUsers.find((u) => u.osu_id === selectedRecipientId);
  }, [selectedRecipientId, targetPlayer, allUsers]);

  // My owned cards
  const myCards = React.useMemo(() => {
    return collectionRecords
      .map((rec) => {
        const map = poolMap.get(rec.beatmapId);
        if (!map) return null;
        return { map, copies: rec.copies };
      })
      .filter(Boolean) as { map: Beatmap; copies: number }[];
  }, [collectionRecords, poolMap]);

  const filteredMyCards = React.useMemo(() => {
    if (!myCardSearch.trim()) return myCards.slice(0, 20);
    const q = myCardSearch.toLowerCase().trim();
    return myCards
      .filter((c) => c.map.title.toLowerCase().includes(q) || c.map.artist.toLowerCase().includes(q))
      .slice(0, 20);
  }, [myCards, myCardSearch]);

  // Recipient cards
  const recipientCards = React.useMemo(() => {
    if (recipientOwnedIds.length === 0) {
      // If collection empty or loading, show popular pool options
      return pool.slice(0, 50);
    }
    return recipientOwnedIds
      .map((id) => poolMap.get(id))
      .filter(Boolean) as Beatmap[];
  }, [recipientOwnedIds, poolMap, pool]);

  const filteredRecipientCards = React.useMemo(() => {
    if (!recipientCardSearch.trim()) return recipientCards.slice(0, 20);
    const q = recipientCardSearch.toLowerCase().trim();
    return recipientCards
      .filter((m) => m.title.toLowerCase().includes(q) || m.artist.toLowerCase().includes(q))
      .slice(0, 20);
  }, [recipientCards, recipientCardSearch]);

  if (!isOpen) return null;

  const toggleOfferedCard = (id: number) => {
    setOfferedCardIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleRequestedCard = (id: number) => {
    setRequestedCardIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSendTrade = async () => {
    if (!user?.osuId) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    if (offeredCardIds.length === 0 && offeredStamina <= 0) {
      setErrorMsg('Please select at least one card or stamina to offer.');
      return;
    }

    if (requestedCardIds.length === 0) {
      setErrorMsg('Please select at least one card you want in return.');
      return;
    }

    setIsSubmitting(true);
    try {
      const offeredMaps = offeredCardIds.map((id) => poolMap.get(id)).filter(Boolean) as Beatmap[];
      const requestedMaps = requestedCardIds.map((id) => poolMap.get(id)).filter(Boolean) as Beatmap[];

      const res = await tradingService.proposeTrade({
        senderId: user.osuId,
        senderUsername: user.username,
        senderAvatar: user.avatarUrl || undefined,
        recipientId: selectedRecipientId,
        recipientUsername: selectedRecipient?.username || 'Player',
        recipientAvatar: (selectedRecipient as any)?.avatar_url || (selectedRecipient as any)?.avatarUrl,
        offeredCards: offeredMaps,
        requestedCards: requestedMaps,
        offeredStamina: offeredStamina > 0 ? offeredStamina : undefined,
        message: tradeMessage,
      });

      if (!res.success) {
        setErrorMsg(res.error || 'Failed to send trade proposal.');
        sfx.playError();
      } else {
        sfx.playClaim();
        setSuccessMsg(`🤝 Trade proposal sent to ${selectedRecipient?.username || 'player'}!`);
        setTimeout(() => {
          onClose();
          setSuccessMsg(null);
        }, 2200);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/40">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white font-display">Propose Player Card Trade</h3>
              <p className="text-xs text-slate-400 font-mono">Atomic card exchange with live confirmation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-950/60 border border-red-800 text-xs text-red-300 flex items-center space-x-2 font-mono">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-300 flex items-center space-x-2 font-mono">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Recipient Selection */}
        <div className="space-y-1">
          <label className="text-xs font-mono text-slate-300 font-bold">Trade Partner</label>
          <select
            value={selectedRecipientId}
            onChange={(e) => setSelectedRecipientId(Number(e.target.value))}
            className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
          >
            {allUsers
              .filter((u) => u.osu_id !== user?.osuId)
              .map((u) => (
                <option key={u.osu_id} value={u.osu_id}>
                  {u.username} (osu! ID: #{u.osu_id})
                </option>
              ))}
          </select>
        </div>

        {/* 2-Column Trade Exchange Setup */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Column 1: YOUR OFFER */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-pink-400 flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>YOUR OFFER ({offeredCardIds.length} Selected)</span>
              </span>
              <span className="text-[10px] font-mono text-slate-500">{myCards.length} Owned</span>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={myCardSearch}
                onChange={(e) => setMyCardSearch(e.target.value)}
                placeholder="Search your collection..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500 font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {filteredMyCards.map(({ map, copies }) => {
                const isSelected = offeredCardIds.includes(map.id);
                const rarityColor = (RARITY_CONFIGS as any)[map.rarity]?.color || '#fff';
                const cover = map.covers?.cover || `https://assets.ppy.sh/beatmaps/${map.beatmapsetId}/covers/cover.jpg`;

                return (
                  <button
                    key={map.id}
                    type="button"
                    onClick={() => toggleOfferedCard(map.id)}
                    className={`p-2 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                      isSelected
                        ? 'border-pink-500 bg-pink-950/40 shadow-md ring-1 ring-pink-500'
                        : 'border-slate-800 bg-slate-900 hover:border-slate-700'
                    }`}
                  >
                    <div className="w-full h-10 rounded-lg bg-slate-950 overflow-hidden mb-1 relative">
                      <img src={cover} alt="" className="w-full h-full object-cover" />
                      <span
                        className="absolute bottom-0.5 right-0.5 text-[8px] font-mono font-bold px-1 rounded bg-black/80"
                        style={{ color: rarityColor }}
                      >
                        {map.rarity}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-white truncate">{map.title}</p>
                      <p className="text-[8px] font-mono text-slate-400">x{copies}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Optional Bonus Stamina Sweetener */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-[10px] font-mono text-slate-400">Add Bonus Stamina:</span>
              <div className="flex space-x-1">
                {[0, 15, 25, 50].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setOfferedStamina(amt)}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold transition-all border ${
                      offeredStamina === amt
                        ? 'bg-amber-600 text-white border-amber-400'
                        : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}
                  >
                    {amt === 0 ? 'None' : `+${amt}⚡`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Column 2: WHAT YOU WANT */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-cyan-400 flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>YOU RECEIVE ({requestedCardIds.length} Selected)</span>
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                {loadingRecipientCards ? 'Loading...' : `${recipientCards.length} Cards`}
              </span>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={recipientCardSearch}
                onChange={(e) => setRecipientCardSearch(e.target.value)}
                placeholder="Search partner's cards..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {filteredRecipientCards.map((map) => {
                const isSelected = requestedCardIds.includes(map.id);
                const rarityColor = (RARITY_CONFIGS as any)[map.rarity]?.color || '#fff';
                const cover = map.covers?.cover || `https://assets.ppy.sh/beatmaps/${map.beatmapsetId}/covers/cover.jpg`;

                return (
                  <button
                    key={map.id}
                    type="button"
                    onClick={() => toggleRequestedCard(map.id)}
                    className={`p-2 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                      isSelected
                        ? 'border-cyan-500 bg-cyan-950/40 shadow-md ring-1 ring-cyan-500'
                        : 'border-slate-800 bg-slate-900 hover:border-slate-700'
                    }`}
                  >
                    <div className="w-full h-10 rounded-lg bg-slate-950 overflow-hidden mb-1 relative">
                      <img src={cover} alt="" className="w-full h-full object-cover" />
                      <span
                        className="absolute bottom-0.5 right-0.5 text-[8px] font-mono font-bold px-1 rounded bg-black/80"
                        style={{ color: rarityColor }}
                      >
                        {map.rarity}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-white truncate">{map.title}</p>
                      <p className="text-[8px] font-mono text-slate-400 truncate">{map.artist}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Message Input */}
        <div className="space-y-1">
          <label className="text-xs font-mono text-slate-300 font-bold">Trade Note (Optional)</label>
          <input
            type="text"
            value={tradeMessage}
            onChange={(e) => setTradeMessage(e.target.value)}
            placeholder="e.g. Willing to swap my duplicate GOAT/Mythic card!"
            maxLength={120}
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Submit Button */}
        <button
          type="button"
          onClick={handleSendTrade}
          disabled={isSubmitting || (offeredCardIds.length === 0 && offeredStamina <= 0) || requestedCardIds.length === 0}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 disabled:opacity-50 text-white font-black text-sm shadow-xl shadow-indigo-600/30 transition-all flex items-center justify-center space-x-2"
        >
          <Send className="w-4 h-4" />
          <span>{isSubmitting ? 'Sending Proposal…' : 'Send Trade Proposal 🤝'}</span>
        </button>
      </div>
    </div>
  );
};
