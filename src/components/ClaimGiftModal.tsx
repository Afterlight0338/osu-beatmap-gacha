import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGacha } from '../context/GachaContext';
import { giftingService, PlayerTransaction } from '../services/giftingService';
import { RARITY_CONFIGS } from '../gacha/rarity';
import { Gift, X, Sparkles, Zap, CheckCircle2, AlertCircle } from 'lucide-react';
import { sfx } from '../audio/sfx';

interface ClaimGiftModalProps {
  gift: PlayerTransaction | null;
  onClose: () => void;
}

export const ClaimGiftModal: React.FC<ClaimGiftModalProps> = ({ gift, onClose }) => {
  const { user } = useAuth();
  const { adminRefillEnergy, addCardToCollection } = useGacha();
  const [isClaiming, setIsClaiming] = useState<boolean>(false);
  const [claimed, setClaimed] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!gift || gift.status !== 'pending') return null;

  const handleClaim = async () => {
    if (!user?.osuId) return;
    setIsClaiming(true);
    setErrorMsg(null);

    try {
      const res = await giftingService.claimGift(gift.id, user.osuId);
      if (!res.success) {
        setErrorMsg(res.error || 'Failed to claim gift.');
        sfx.playError();
      } else {
        sfx.playClaim();
        setClaimed(true);

        if (gift.type === 'card' && gift.cardData) {
          await addCardToCollection(gift.cardData as any, 1);
        } else if (gift.type === 'stamina' && gift.staminaAmount) {
          await adminRefillEnergy(gift.staminaAmount);
        }

        setTimeout(() => {
          onClose();
        }, 2200);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error claiming gift.');
    } finally {
      setIsClaiming(false);
    }
  };

  const rarityColor = gift.cardData ? (RARITY_CONFIGS as any)[gift.cardData.rarity]?.color || '#fff' : '#fff';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md rounded-3xl bg-gradient-to-b from-slate-900 via-slate-900/95 to-slate-950 border border-pink-500/50 shadow-2xl shadow-pink-500/20 p-6 sm:p-8 space-y-6 text-center">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Animated Gift Icon Header */}
        <div className="relative mx-auto w-20 h-20 rounded-3xl bg-gradient-to-tr from-pink-600 via-purple-600 to-amber-500 p-0.5 shadow-xl shadow-pink-500/30 animate-bounce">
          <div className="w-full h-full rounded-[22px] bg-slate-950 flex items-center justify-center">
            <Gift className="w-10 h-10 text-pink-400 animate-pulse" />
          </div>
        </div>

        <div className="space-y-1">
          <span className="text-[10px] font-mono font-bold tracking-widest px-2.5 py-0.5 rounded-full bg-pink-950 border border-pink-500/50 text-pink-300 uppercase">
            🎁 You Received a Gift!
          </span>
          <h3 className="text-xl font-black text-white font-display mt-1">
            Gift from {gift.senderUsername}
          </h3>
          {gift.message && (
            <p className="text-xs text-slate-300 font-sans italic p-2 rounded-xl bg-slate-950/60 border border-slate-800">
              "{gift.message}"
            </p>
          )}
        </div>

        {/* Gift Payload Details */}
        {gift.type === 'card' && gift.cardData && (
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="relative w-full h-28 rounded-xl overflow-hidden bg-slate-900 border border-slate-800">
              <img src={gift.cardData.coverUrl} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-2.5">
                <div className="text-left min-w-0">
                  <h4 className="text-sm font-black text-white truncate">{gift.cardData.title}</h4>
                  <p className="text-xs text-slate-300 truncate">{gift.cardData.artist}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">Rarity:</span>
              <span className="font-bold px-2 py-0.5 rounded border" style={{ color: rarityColor, borderColor: rarityColor }}>
                {gift.cardData.rarity}
              </span>
            </div>
          </div>
        )}

        {gift.type === 'stamina' && (
          <div className="p-6 rounded-2xl bg-amber-950/30 border border-amber-500/50 space-y-2">
            <div className="flex items-center justify-center space-x-2 text-2xl font-black text-amber-300 font-mono">
              <Zap className="w-6 h-6 text-amber-400 animate-pulse" />
              <span>+{gift.staminaAmount || 25} Bonus Stamina</span>
            </div>
            <p className="text-xs text-amber-200/80 font-mono">Uncapped bonus rolls added directly to your account balance!</p>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-950/60 border border-red-800 text-xs text-red-300 flex items-center justify-center space-x-2 font-mono">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {claimed ? (
          <div className="p-3.5 rounded-2xl bg-emerald-950/80 border border-emerald-500 text-xs text-emerald-300 font-bold flex items-center justify-center space-x-2 font-mono animate-fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span>Successfully Claimed! Enjoy your gift 🎉</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleClaim}
            disabled={isClaiming}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white font-black text-sm shadow-xl shadow-pink-600/30 transition-all flex items-center justify-center space-x-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isClaiming ? 'Claiming Gift…' : 'Claim Gift Now 🎁'}</span>
          </button>
        )}
      </div>
    </div>
  );
};
