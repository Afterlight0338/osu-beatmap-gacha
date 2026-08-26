import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGacha } from '../context/GachaContext';
import { giftingService, GIFT_COOLDOWN_MS } from '../services/giftingService';
import { OnlinePlayer } from '../services/chatService';
import { Beatmap } from '../types/beatmap';
import { RARITY_CONFIGS } from '../gacha/rarity';
import { Gift, X, Send, Sparkles, Zap, Clock, CheckCircle2, AlertCircle, Search } from 'lucide-react';
import { sfx } from '../audio/sfx';

interface GiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetPlayer?: OnlinePlayer | null;
  allUsers?: { osu_id: number; username: string; avatar_url?: string; country_code?: string }[];
}

export const GiftModal: React.FC<GiftModalProps> = ({ isOpen, onClose, targetPlayer, allUsers = [] }) => {
  const { user } = useAuth();
  const { collectionRecords, poolMap, refreshCollection } = useGacha();

  const [selectedRecipientId, setSelectedRecipientId] = useState<number>(0);
  const [giftType, setGiftType] = useState<'card' | 'stamina'>('card');
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [cardSearch, setCardSearch] = useState<string>('');
  const [staminaAmount, setStaminaAmount] = useState<number>(25);
  const [giftMessage, setGiftMessage] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);

  useEffect(() => {
    if (targetPlayer?.osuId) {
      setSelectedRecipientId(targetPlayer.osuId);
    } else if (allUsers.length > 0 && !selectedRecipientId) {
      const otherUser = allUsers.find((u) => u.osu_id !== user?.osuId);
      if (otherUser) setSelectedRecipientId(otherUser.osu_id);
    }
  }, [targetPlayer, allUsers, user?.osuId]);

  useEffect(() => {
    if (isOpen && user?.osuId) {
      const rem = giftingService.getCooldownRemaining(user.osuId);
      setCooldownRemaining(rem);
    }
  }, [isOpen, user?.osuId]);

  // Owned cards available for gifting
  const giftableCards = React.useMemo(() => {
    return collectionRecords
      .map((rec) => {
        const map = poolMap.get(rec.beatmapId);
        if (!map) return null;
        return { map, copies: rec.copies };
      })
      .filter(Boolean) as { map: Beatmap; copies: number }[];
  }, [collectionRecords, poolMap]);

  const filteredCards = React.useMemo(() => {
    if (!cardSearch.trim()) return giftableCards.slice(0, 30);
    const q = cardSearch.toLowerCase().trim();
    return giftableCards
      .filter(
        (c) =>
          c.map.title.toLowerCase().includes(q) ||
          c.map.artist.toLowerCase().includes(q) ||
          c.map.creator.toLowerCase().includes(q)
      )
      .slice(0, 30);
  }, [giftableCards, cardSearch]);

  const selectedRecipient = React.useMemo(() => {
    if (targetPlayer?.osuId === selectedRecipientId) return targetPlayer;
    return allUsers.find((u) => u.osu_id === selectedRecipientId);
  }, [selectedRecipientId, targetPlayer, allUsers]);

  if (!isOpen) return null;

  const handleSend = async () => {
    if (!user?.osuId) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!selectedRecipientId) {
      setErrorMsg('Please select a recipient.');
      return;
    }

    if (giftType === 'card' && !selectedCardId) {
      setErrorMsg('Please select a card to gift from your collection.');
      return;
    }

    const selectedCard = selectedCardId ? poolMap.get(selectedCardId) : undefined;

    setIsSending(true);
    try {
      const res = await giftingService.sendGift({
        senderId: user.osuId,
        senderUsername: user.username,
        senderAvatar: user.avatarUrl || undefined,
        recipientId: selectedRecipientId,
        recipientUsername: selectedRecipient?.username || 'Player',
        recipientAvatar: (selectedRecipient as any)?.avatar_url || (selectedRecipient as any)?.avatarUrl,
        type: giftType,
        card: selectedCard,
        staminaAmount: giftType === 'stamina' ? staminaAmount : undefined,
        message: giftMessage,
      });

      if (!res.success) {
        setErrorMsg(res.error || 'Failed to send gift.');
        sfx.playError();
      } else {
        sfx.playClaim();
        setSuccessMsg(`🎁 Gift successfully sent to ${selectedRecipient?.username || 'player'}!`);
        setCooldownRemaining(GIFT_COOLDOWN_MS);
        if (giftType === 'card') {
          await refreshCollection();
        }
        setTimeout(() => {
          onClose();
          setSuccessMsg(null);
        }, 2200);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSending(false);
    }
  };

  const cooldownHours = Math.floor(cooldownRemaining / (1000 * 60 * 60));
  const cooldownMins = Math.ceil((cooldownRemaining % (1000 * 60 * 60)) / (1000 * 60));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-pink-500/20 text-pink-400 border border-pink-500/40">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white font-display">Send Player Gift</h3>
              <p className="text-xs text-slate-400 font-mono">Send duplicate cards or summon stamina (Once per 6 hrs)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cooldown Notice */}
        {cooldownRemaining > 0 && (
          <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-500/50 flex items-start space-x-2.5 text-xs text-amber-200 font-mono">
            <Clock className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5 animate-spin" />
            <div>
              <p className="font-bold">Gifting Cooldown Active</p>
              <p className="text-[11px] text-amber-300/80">
                You can send another gift in {cooldownHours > 0 ? `${cooldownHours}h ` : ''}{cooldownMins}m.
              </p>
            </div>
          </div>
        )}

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
        <div className="space-y-1.5">
          <label className="text-xs font-mono text-slate-300 font-bold">Recipient Player</label>
          {targetPlayer ? (
            <div className="flex items-center space-x-3 p-3 rounded-xl bg-slate-950 border border-slate-800">
              {targetPlayer.avatarUrl ? (
                <img src={targetPlayer.avatarUrl} alt="" className="w-8 h-8 rounded-full border border-slate-700" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs text-white">
                  {targetPlayer.username.slice(0, 2)}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-bold text-white truncate">{targetPlayer.username}</p>
                <p className="text-[10px] font-mono text-emerald-400">● Online Now</p>
              </div>
            </div>
          ) : (
            <select
              value={selectedRecipientId}
              onChange={(e) => setSelectedRecipientId(Number(e.target.value))}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white font-mono focus:outline-none focus:border-pink-500"
            >
              {allUsers
                .filter((u) => u.osu_id !== user?.osuId)
                .map((u) => (
                  <option key={u.osu_id} value={u.osu_id}>
                    {u.username} (ID: #{u.osu_id})
                  </option>
                ))}
            </select>
          )}
        </div>

        {/* Gift Type Selector */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setGiftType('card')}
            className={`py-2.5 px-3 rounded-xl font-mono text-xs font-bold transition-all flex items-center justify-center space-x-2 border ${
              giftType === 'card'
                ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white border-pink-500 shadow-md'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Gift a Card</span>
          </button>
          <button
            type="button"
            onClick={() => setGiftType('stamina')}
            className={`py-2.5 px-3 rounded-xl font-mono text-xs font-bold transition-all flex items-center justify-center space-x-2 border ${
              giftType === 'stamina'
                ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white border-amber-500 shadow-md'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Gift Stamina (+Pulls)</span>
          </button>
        </div>

        {/* Gift Card Picker */}
        {giftType === 'card' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-slate-300">
              <span>Select Card ({giftableCards.length} Owned)</span>
              <span className="text-slate-500">Pick any card</span>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={cardSearch}
                onChange={(e) => setCardSearch(e.target.value)}
                placeholder="Search owned songs..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500 font-mono"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
              {filteredCards.map(({ map, copies }) => {
                const isSelected = selectedCardId === map.id;
                const rarityColor = RARITY_CONFIGS[map.rarity]?.color || '#fff';
                const cover = map.covers?.cover || `https://assets.ppy.sh/beatmaps/${map.beatmapsetId}/covers/cover.jpg`;

                return (
                  <button
                    key={map.id}
                    type="button"
                    onClick={() => setSelectedCardId(map.id)}
                    className={`p-2 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                      isSelected
                        ? 'border-pink-500 bg-pink-950/40 shadow-md'
                        : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                    }`}
                  >
                    <div className="w-full h-12 rounded-lg bg-slate-900 overflow-hidden mb-1.5 relative border border-slate-800">
                      <img src={cover} alt="" className="w-full h-full object-cover" />
                      <span
                        className="absolute bottom-0.5 right-0.5 text-[9px] font-mono font-bold px-1 rounded bg-black/80"
                        style={{ color: rarityColor }}
                      >
                        {map.rarity}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-white truncate">{map.title}</p>
                      <p className="text-[9px] text-slate-400 truncate">{map.artist}</p>
                      <span className="text-[9px] font-mono text-slate-500 block">
                        x{copies} {copies > 1 ? '(Duplicate)' : ''}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Gift Stamina Picker */}
        {giftType === 'stamina' && (
          <div className="space-y-2 p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
            <label className="text-xs font-mono text-slate-300 font-bold block">Select Stamina Gift Amount</label>
            <div className="grid grid-cols-4 gap-2">
              {[15, 25, 50, 100].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setStaminaAmount(amt)}
                  className={`py-2 rounded-xl text-xs font-mono font-bold transition-all border ${
                    staminaAmount === amt
                      ? 'bg-amber-600 text-white border-amber-400 shadow-md scale-105'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  +{amt} ⚡
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 font-mono mt-1">
              Recipient will instantly receive <strong className="text-amber-300 font-bold">+{staminaAmount} Bonus Summon Pulls</strong>!
            </p>
          </div>
        )}

        {/* Optional Message */}
        <div className="space-y-1">
          <label className="text-xs font-mono text-slate-300 font-bold">Gift Message (Optional)</label>
          <input
            type="text"
            value={giftMessage}
            onChange={(e) => setGiftMessage(e.target.value)}
            placeholder="e.g. Good luck on your next summon!"
            maxLength={100}
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-pink-500"
          />
        </div>

        {/* Send Button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={isSending || cooldownRemaining > 0}
          className="w-full py-3 rounded-2xl bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 disabled:opacity-50 text-white font-black text-sm shadow-xl shadow-pink-600/20 transition-all flex items-center justify-center space-x-2"
        >
          <Send className="w-4 h-4" />
          <span>{isSending ? 'Sending Gift…' : 'Send Gift Now 🎁'}</span>
        </button>
      </div>
    </div>
  );
};
