import { supabase } from '../lib/supabase';
import { Beatmap } from '../types/beatmap';

export const GIFT_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 Hours

export interface PlayerTransaction {
  id: string;
  senderId: number;
  senderUsername: string;
  senderAvatar?: string;
  recipientId: number;
  recipientUsername: string;
  recipientAvatar?: string;
  type: 'card' | 'stamina';
  cardData?: {
    id: number;
    beatmapsetId: number;
    title: string;
    artist: string;
    version: string;
    rarity: string;
    stars: number;
    coverUrl: string;
  };
  staminaAmount?: number;
  message?: string;
  status: 'pending' | 'claimed' | 'revoked';
  createdAt: number;
  claimedAt?: number;
  revokedAt?: number;
}

class GiftingService {
  private transactions: PlayerTransaction[] = [];
  private listeners: ((txs: PlayerTransaction[]) => void)[] = [];

  public async fetchTransactions(): Promise<PlayerTransaction[]> {
    try {
      const { data, error } = await supabase
        .from('admin_config')
        .select('value')
        .eq('key', 'player_transactions')
        .maybeSingle();

      if (error) {
        console.warn('Transaction fetch notice:', error.message);
        return [];
      }

      if (data?.value && Array.isArray(data.value)) {
        this.transactions = data.value as PlayerTransaction[];
        this.notifyListeners();
        return this.transactions;
      }
    } catch (err) {
      console.warn('Transaction fetch error:', err);
    }
    return [];
  }

  public getCooldownRemaining(senderId: number): number {
    const userGifts = this.transactions
      .filter((t) => t.senderId === senderId && t.status !== 'revoked')
      .sort((a, b) => b.createdAt - a.createdAt);

    if (userGifts.length === 0) return 0;

    const lastGift = userGifts[0];
    const elapsed = Date.now() - lastGift.createdAt;
    if (elapsed >= GIFT_COOLDOWN_MS) return 0;
    return GIFT_COOLDOWN_MS - elapsed;
  }

  public async sendGift(params: {
    senderId: number;
    senderUsername: string;
    senderAvatar?: string;
    recipientId: number;
    recipientUsername: string;
    recipientAvatar?: string;
    type: 'card' | 'stamina';
    card?: Beatmap;
    staminaAmount?: number;
    message?: string;
  }): Promise<{ success: boolean; error?: string; transaction?: PlayerTransaction }> {
    if (params.senderId === params.recipientId) {
      return { success: false, error: 'You cannot send a gift to yourself!' };
    }

    // Check 6-hour rate limit
    await this.fetchTransactions();
    const remainingCooldown = this.getCooldownRemaining(params.senderId);
    if (remainingCooldown > 0) {
      const hours = Math.floor(remainingCooldown / (1000 * 60 * 60));
      const mins = Math.ceil((remainingCooldown % (1000 * 60 * 60)) / (1000 * 60));
      return {
        success: false,
        error: `Gifting cooldown active! You can send another gift in ${hours > 0 ? `${hours}h ` : ''}${mins}m (Limited to once per 6 hours).`,
      };
    }

    const newTx: PlayerTransaction = {
      id: `gift_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      senderId: params.senderId,
      senderUsername: params.senderUsername,
      senderAvatar: params.senderAvatar,
      recipientId: params.recipientId,
      recipientUsername: params.recipientUsername,
      recipientAvatar: params.recipientAvatar,
      type: params.type,
      cardData: params.card
        ? {
            id: params.card.id,
            beatmapsetId: params.card.beatmapsetId,
            title: params.card.title,
            artist: params.card.artist,
            version: params.card.version,
            rarity: params.card.rarity,
            stars: params.card.stars,
            coverUrl: params.card.covers?.cover || `https://assets.ppy.sh/beatmaps/${params.card.beatmapsetId}/covers/cover.jpg`,
          }
        : undefined,
      staminaAmount: params.type === 'stamina' ? params.staminaAmount || 25 : undefined,
      message: params.message?.trim() || undefined,
      status: 'pending',
      createdAt: Date.now(),
    };

    this.transactions = [newTx, ...this.transactions].slice(0, 500);
    this.notifyListeners();

    // Persist to Supabase
    await supabase.from('admin_config').upsert({
      key: 'player_transactions',
      value: this.transactions,
      updated_at: new Date().toISOString(),
    });

    // Notify recipient via realtime channel
    try {
      const channel = supabase.channel('global_chat_channel');
      channel.send({
        type: 'broadcast',
        event: 'gift_received',
        payload: newTx,
      });
    } catch {}

    return { success: true, transaction: newTx };
  }

  public async claimGift(transactionId: string, recipientId: number): Promise<{ success: boolean; error?: string; tx?: PlayerTransaction }> {
    await this.fetchTransactions();
    const tx = this.transactions.find((t) => t.id === transactionId && t.recipientId === recipientId);
    if (!tx) {
      return { success: false, error: 'Gift not found or not addressed to you.' };
    }
    if (tx.status === 'claimed') {
      return { success: false, error: 'This gift has already been claimed!' };
    }
    if (tx.status === 'revoked') {
      return { success: false, error: 'This gift was revoked by an administrator.' };
    }

    tx.status = 'claimed';
    tx.claimedAt = Date.now();
    this.notifyListeners();

    // Save updated transactions
    await supabase.from('admin_config').upsert({
      key: 'player_transactions',
      value: this.transactions,
      updated_at: new Date().toISOString(),
    });

    // 1. If card gift: Upsert card into recipient's Supabase user_collection
    if (tx.type === 'card' && tx.cardData) {
      const { data: existing } = await supabase
        .from('user_collection')
        .select('copies')
        .eq('osu_id', tx.recipientId)
        .eq('beatmap_id', tx.cardData.id)
        .maybeSingle();

      const newCopies = (existing?.copies || 0) + 1;
      await supabase.from('user_collection').upsert({
        osu_id: tx.recipientId,
        beatmap_id: tx.cardData.id,
        copies: newCopies,
        first_pulled_at: Date.now(),
        last_pulled_at: Date.now(),
        is_favorite: false,
      });

      // Deduct from sender
      const { data: senderCard } = await supabase
        .from('user_collection')
        .select('copies')
        .eq('osu_id', tx.senderId)
        .eq('beatmap_id', tx.cardData.id)
        .maybeSingle();

      if (senderCard) {
        if (senderCard.copies > 1) {
          await supabase.from('user_collection').update({ copies: senderCard.copies - 1 }).eq('osu_id', tx.senderId).eq('beatmap_id', tx.cardData.id);
        } else {
          await supabase.from('user_collection').delete().eq('osu_id', tx.senderId).eq('beatmap_id', tx.cardData.id);
        }
      }
    }

    // 2. If stamina gift: Queue energy override for recipient
    if (tx.type === 'stamina' && tx.staminaAmount) {
      await supabase.from('user_energy_overrides').upsert({
        osu_id: tx.recipientId,
        energy_amount: tx.staminaAmount,
      });
    }

    return { success: true, tx };
  }

  public async revokeTransaction(transactionId: string): Promise<{ success: boolean; error?: string }> {
    await this.fetchTransactions();
    const tx = this.transactions.find((t) => t.id === transactionId);
    if (!tx) return { success: false, error: 'Transaction not found.' };

    if (tx.status === 'revoked') {
      return { success: false, error: 'Transaction has already been revoked.' };
    }

    const wasClaimed = tx.status === 'claimed';
    tx.status = 'revoked';
    tx.revokedAt = Date.now();
    this.notifyListeners();

    await supabase.from('admin_config').upsert({
      key: 'player_transactions',
      value: this.transactions,
      updated_at: new Date().toISOString(),
    });

    // If it was already claimed: Deduct from recipient
    if (wasClaimed) {
      if (tx.type === 'card' && tx.cardData) {
        const { data: recCard } = await supabase
          .from('user_collection')
          .select('copies')
          .eq('osu_id', tx.recipientId)
          .eq('beatmap_id', tx.cardData.id)
          .maybeSingle();

        if (recCard) {
          if (recCard.copies > 1) {
            await supabase.from('user_collection').update({ copies: recCard.copies - 1 }).eq('osu_id', tx.recipientId).eq('beatmap_id', tx.cardData.id);
          } else {
            await supabase.from('user_collection').delete().eq('osu_id', tx.recipientId).eq('beatmap_id', tx.cardData.id);
          }
        }
      }
    }

    // Always restore the card to the sender (since it was deducted from the sender at send time)
    if (tx.type === 'card' && tx.cardData) {
      const { data: senderCard } = await supabase
        .from('user_collection')
        .select('copies')
        .eq('osu_id', tx.senderId)
        .eq('beatmap_id', tx.cardData.id)
        .maybeSingle();

      await supabase.from('user_collection').upsert({
        osu_id: tx.senderId,
        beatmap_id: tx.cardData.id,
        copies: (senderCard?.copies || 0) + 1,
        first_pulled_at: Date.now(),
        last_pulled_at: Date.now(),
        is_favorite: false,
      });
    }

    return { success: true };
  }

  public subscribe(listener: (txs: PlayerTransaction[]) => void) {
    this.listeners.push(listener);
    listener(this.transactions);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((fn) => fn([...this.transactions]));
  }
}

export const giftingService = new GiftingService();
