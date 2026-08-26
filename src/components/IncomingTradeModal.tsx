import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGacha } from '../context/GachaContext';
import { tradingService, PlayerTrade } from '../services/tradingService';
import { RARITY_CONFIGS } from '../gacha/rarity';
import { ArrowLeftRight, X, Sparkles, Zap, Check, Ban, CheckCircle2, AlertCircle } from 'lucide-react';
import { sfx } from '../audio/sfx';

interface IncomingTradeModalProps {
  trade: PlayerTrade | null;
  onClose: () => void;
}

export const IncomingTradeModal: React.FC<IncomingTradeModalProps> = ({ trade, onClose }) => {
  const { user } = useAuth();
  const { adminRefillEnergy, removeCardFromCollection, addCardToCollection } = useGacha();
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!trade || trade.status !== 'pending') return null;

  const handleAccept = async () => {
    if (!user?.osuId) return;
    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const res = await tradingService.acceptTrade(trade.id, user.osuId);
      if (!res.success) {
        setErrorMsg(res.error || 'Failed to accept trade.');
        sfx.playError();
      } else {
        sfx.playClaim();
        setSuccessMsg('🎉 Trade Accepted! Your collection has been updated.');

        // 1. Remove given cards from recipient's local collection
        if (trade.requestedCards && trade.requestedCards.length > 0) {
          for (const card of trade.requestedCards) {
            await removeCardFromCollection(card.beatmapId, 1);
          }
        }

        // 2. Add received cards to recipient's local collection
        if (trade.offeredCards && trade.offeredCards.length > 0) {
          for (const card of trade.offeredCards) {
            await addCardToCollection({ id: card.beatmapId, ...card } as any, 1);
          }
        }

        if (trade.offeredStamina && trade.offeredStamina > 0) {
          await adminRefillEnergy(trade.offeredStamina);
        }
        setTimeout(() => {
          onClose();
        }, 2200);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error executing trade.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDecline = async () => {
    if (!user?.osuId) return;
    setIsProcessing(true);
    try {
      await tradingService.declineTrade(trade.id, user.osuId);
      sfx.playClick();
      onClose();
    } catch {
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-xl rounded-3xl bg-slate-900 border border-indigo-500/60 shadow-2xl p-6 sm:p-8 space-y-6">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-950 border border-indigo-500/50 flex items-center justify-center text-indigo-400 shadow-lg shadow-indigo-950/60 animate-bounce">
            <ArrowLeftRight className="w-8 h-8" />
          </div>
          <span className="text-[10px] font-mono font-bold tracking-widest px-2.5 py-0.5 rounded-full bg-indigo-950 border border-indigo-500/50 text-indigo-300 uppercase">
            🤝 Trade Offer Received
          </span>
          <h3 className="text-xl font-black text-white font-display">
            {trade.senderUsername} wants to trade with you!
          </h3>
          {trade.message && (
            <p className="text-xs text-slate-300 font-sans italic p-2.5 rounded-xl bg-slate-950 border border-slate-800">
              "{trade.message}"
            </p>
          )}
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

        {/* Trade Comparison Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* They Give You */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-emerald-500/40 space-y-2.5">
            <div className="flex items-center space-x-1.5 text-xs font-mono font-bold text-emerald-400">
              <Sparkles className="w-3.5 h-3.5" />
              <span>THEY OFFER (You Receive)</span>
            </div>

            <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
              {trade.offeredCards.map((c) => {
                const rarityColor = (RARITY_CONFIGS as any)[c.rarity]?.color || '#fff';
                return (
                  <div key={c.beatmapId} className="p-2 rounded-xl bg-slate-900 border border-slate-800 flex items-center space-x-2.5">
                    <img src={c.coverUrl} alt="" className="w-10 h-10 rounded-lg object-cover border border-slate-800 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{c.title}</p>
                      <span className="text-[9px] font-mono font-bold" style={{ color: rarityColor }}>
                        {c.rarity}
                      </span>
                    </div>
                  </div>
                );
              })}

              {trade.offeredStamina && trade.offeredStamina > 0 && (
                <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/50 flex items-center space-x-2 text-xs text-amber-300 font-mono font-bold">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span>+{trade.offeredStamina} Bonus Stamina</span>
                </div>
              )}
            </div>
          </div>

          {/* You Give Them */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-pink-500/40 space-y-2.5">
            <div className="flex items-center space-x-1.5 text-xs font-mono font-bold text-pink-400">
              <Sparkles className="w-3.5 h-3.5" />
              <span>THEY REQUEST (You Give)</span>
            </div>

            <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
              {trade.requestedCards.map((c) => {
                const rarityColor = (RARITY_CONFIGS as any)[c.rarity]?.color || '#fff';
                return (
                  <div key={c.beatmapId} className="p-2 rounded-xl bg-slate-900 border border-slate-800 flex items-center space-x-2.5">
                    <img src={c.coverUrl} alt="" className="w-10 h-10 rounded-lg object-cover border border-slate-800 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{c.title}</p>
                      <span className="text-[9px] font-mono font-bold" style={{ color: rarityColor }}>
                        {c.rarity}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        {!successMsg && (
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={handleDecline}
              disabled={isProcessing}
              className="py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-mono text-xs font-bold transition-all flex items-center justify-center space-x-1.5"
            >
              <Ban className="w-4 h-4 text-red-400" />
              <span>Decline Trade</span>
            </button>

            <button
              type="button"
              onClick={handleAccept}
              disabled={isProcessing}
              className="py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-mono text-xs font-bold shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center space-x-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{isProcessing ? 'Processing Swap…' : 'Accept & Swap Cards'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
