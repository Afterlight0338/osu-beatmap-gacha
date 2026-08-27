import { supabase } from '../lib/supabase';
import { Beatmap } from '../types/beatmap';

export interface TradeItem {
  beatmapId: number;
  title: string;
  artist: string;
  version: string;
  rarity: string;
  stars: number;
  coverUrl: string;
}

export interface PlayerTrade {
  id: string;
  senderId: number;
  senderUsername: string;
  senderAvatar?: string;
  recipientId: number;
  recipientUsername: string;
  recipientAvatar?: string;
  offeredCards: TradeItem[];
  requestedCards: TradeItem[];
  offeredStamina?: number;
  message?: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'revoked';
  createdAt: number;
  resolvedAt?: number;
}

class TradingService {
  private trades: PlayerTrade[] = [];
  private listeners: ((trades: PlayerTrade[]) => void)[] = [];

  public async fetchTrades(): Promise<PlayerTrade[]> {
    try {
      const { data, error } = await supabase
        .from('admin_config')
        .select('value')
        .eq('key', 'player_trades')
        .maybeSingle();

      if (error) {
        console.warn('Trades fetch notice:', error.message);
        return [];
      }

      if (data?.value && Array.isArray(data.value)) {
        this.trades = data.value as PlayerTrade[];
        this.notifyListeners();
        return this.trades;
      }
    } catch (err) {
      console.warn('Trades fetch error:', err);
    }
    return [];
  }

  public async fetchUserCollection(osuId: number): Promise<number[]> {
    try {
      const { data } = await supabase
        .from('user_collection')
        .select('beatmap_id')
        .eq('osu_id', osuId);
      return data ? data.map((d) => d.beatmap_id) : [];
    } catch {
      return [];
    }
  }

  public async proposeTrade(params: {
    senderId: number;
    senderUsername: string;
    senderAvatar?: string;
    recipientId: number;
    recipientUsername: string;
    recipientAvatar?: string;
    offeredCards: Beatmap[];
    requestedCards: Beatmap[];
    offeredStamina?: number;
    message?: string;
  }): Promise<{ success: boolean; error?: string; trade?: PlayerTrade }> {
    if (params.senderId === params.recipientId) {
      return { success: false, error: 'You cannot trade with yourself!' };
    }

    if (params.offeredCards.length === 0 && (!params.offeredStamina || params.offeredStamina <= 0)) {
      return { success: false, error: 'Please select at least one card or stamina to offer.' };
    }

    if (params.requestedCards.length === 0) {
      return { success: false, error: 'Please select at least one card you want in return.' };
    }

    const formatCard = (m: Beatmap): TradeItem => ({
      beatmapId: m.id,
      title: m.title,
      artist: m.artist,
      version: m.version,
      rarity: m.rarity,
      stars: m.stars,
      coverUrl: m.covers?.cover || `https://assets.ppy.sh/beatmaps/${m.beatmapsetId}/covers/cover.jpg`,
    });

    const newTrade: PlayerTrade = {
      id: `trade_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      senderId: params.senderId,
      senderUsername: params.senderUsername,
      senderAvatar: params.senderAvatar,
      recipientId: params.recipientId,
      recipientUsername: params.recipientUsername,
      recipientAvatar: params.recipientAvatar,
      offeredCards: params.offeredCards.map(formatCard),
      requestedCards: params.requestedCards.map(formatCard),
      offeredStamina: params.offeredStamina,
      message: params.message?.trim(),
      status: 'pending',
      createdAt: Date.now(),
    };

    await this.fetchTrades();
    this.trades = [newTrade, ...this.trades].slice(0, 500);
    this.notifyListeners();

    await supabase.from('admin_config').upsert({
      key: 'player_trades',
      value: this.trades,
      updated_at: new Date().toISOString(),
    });

    // Broadcast realtime event
    try {
      const channel = supabase.channel('global_chat_channel');
      channel.send({
        type: 'broadcast',
        event: 'trade_received',
        payload: newTrade,
      });
    } catch {}

    return { success: true, trade: newTrade };
  }

  public async acceptTrade(tradeId: string, recipientId: number): Promise<{ success: boolean; error?: string }> {
    await this.fetchTrades();
    const trade = this.trades.find((t) => t.id === tradeId && t.recipientId === recipientId);
    if (!trade) return { success: false, error: 'Trade offer not found.' };
    if (trade.status !== 'pending') return { success: false, error: `Trade is already ${trade.status}.` };

    // 1. Check sender still has offered cards
    for (const card of trade.offeredCards) {
      const { data } = await supabase
        .from('user_collection')
        .select('copies')
        .eq('osu_id', trade.senderId)
        .eq('beatmap_id', card.beatmapId)
        .maybeSingle();

      if (!data || data.copies <= 0) {
        trade.status = 'cancelled';
        trade.resolvedAt = Date.now();
        await this.saveTrades();
        return { success: false, error: `Sender no longer owns "${card.title}". Trade cancelled.` };
      }
    }

    // 2. Check recipient still has requested cards
    for (const card of trade.requestedCards) {
      const { data } = await supabase
        .from('user_collection')
        .select('copies')
        .eq('osu_id', trade.recipientId)
        .eq('beatmap_id', card.beatmapId)
        .maybeSingle();

      if (!data || data.copies <= 0) {
        return { success: false, error: `You no longer own "${card.title}".` };
      }
    }

    // 3. Atomically perform the card swap:
    // A. Transfer offered cards: sender -> recipient
    for (const card of trade.offeredCards) {
      // Deduct from sender
      const { data: sData } = await supabase
        .from('user_collection')
        .select('copies')
        .eq('osu_id', trade.senderId)
        .eq('beatmap_id', card.beatmapId)
        .single();
      if (sData && sData.copies > 1) {
        await supabase.from('user_collection').update({ copies: sData.copies - 1 }).eq('osu_id', trade.senderId).eq('beatmap_id', card.beatmapId);
      } else {
        await supabase.from('user_collection').delete().eq('osu_id', trade.senderId).eq('beatmap_id', card.beatmapId);
      }

      // Add to recipient (preserve original first_pulled_at and favorite status if already owned)
      const { data: rData } = await supabase
        .from('user_collection')
        .select('copies, first_pulled_at, is_favorite')
        .eq('osu_id', trade.recipientId)
        .eq('beatmap_id', card.beatmapId)
        .maybeSingle();
      await supabase.from('user_collection').upsert({
        osu_id: trade.recipientId,
        beatmap_id: card.beatmapId,
        copies: (rData?.copies || 0) + 1,
        first_pulled_at: rData?.first_pulled_at || Date.now(),
        last_pulled_at: Date.now(),
        is_favorite: Boolean(rData?.is_favorite),
      });
    }

    // B. Transfer requested cards: recipient -> sender
    for (const card of trade.requestedCards) {
      // Deduct from recipient
      const { data: rData } = await supabase
        .from('user_collection')
        .select('copies')
        .eq('osu_id', trade.recipientId)
        .eq('beatmap_id', card.beatmapId)
        .single();
      if (rData && rData.copies > 1) {
        await supabase.from('user_collection').update({ copies: rData.copies - 1 }).eq('osu_id', trade.recipientId).eq('beatmap_id', card.beatmapId);
      } else {
        await supabase.from('user_collection').delete().eq('osu_id', trade.recipientId).eq('beatmap_id', card.beatmapId);
      }

      // Add to sender (preserve original first_pulled_at and favorite status if already owned)
      const { data: sData } = await supabase
        .from('user_collection')
        .select('copies, first_pulled_at, is_favorite')
        .eq('osu_id', trade.senderId)
        .eq('beatmap_id', card.beatmapId)
        .maybeSingle();
      await supabase.from('user_collection').upsert({
        osu_id: trade.senderId,
        beatmap_id: card.beatmapId,
        copies: (sData?.copies || 0) + 1,
        first_pulled_at: sData?.first_pulled_at || Date.now(),
        last_pulled_at: Date.now(),
        is_favorite: Boolean(sData?.is_favorite),
      });
    }

    // C. If offered stamina, credit to recipient
    if (trade.offeredStamina && trade.offeredStamina > 0) {
      await supabase.from('user_energy_overrides').upsert({
        osu_id: trade.recipientId,
        energy_amount: trade.offeredStamina,
      });
    }

    trade.status = 'accepted';
    trade.resolvedAt = Date.now();
    await this.saveTrades();

    // Broadcast realtime event
    try {
      const channel = supabase.channel('global_chat_channel');
      channel.send({
        type: 'broadcast',
        event: 'trade_accepted',
        payload: trade,
      });
    } catch {}

    return { success: true };
  }

  public async declineTrade(tradeId: string, recipientId: number): Promise<{ success: boolean; error?: string }> {
    await this.fetchTrades();
    const trade = this.trades.find((t) => t.id === tradeId && t.recipientId === recipientId);
    if (!trade) return { success: false, error: 'Trade offer not found.' };

    trade.status = 'declined';
    trade.resolvedAt = Date.now();
    await this.saveTrades();
    return { success: true };
  }

  public async cancelTrade(tradeId: string, senderId: number): Promise<{ success: boolean; error?: string }> {
    await this.fetchTrades();
    const trade = this.trades.find((t) => t.id === tradeId && t.senderId === senderId);
    if (!trade) return { success: false, error: 'Trade offer not found.' };

    trade.status = 'cancelled';
    trade.resolvedAt = Date.now();
    await this.saveTrades();
    return { success: true };
  }

  public async revokeTrade(tradeId: string): Promise<{ success: boolean; error?: string }> {
    await this.fetchTrades();
    const trade = this.trades.find((t) => t.id === tradeId);
    if (!trade) return { success: false, error: 'Trade offer not found.' };
    if (trade.status !== 'accepted') return { success: false, error: 'Only accepted trades can be revoked.' };

    // Reverse the swap:
    // Return offered cards to sender, return requested cards to recipient
    for (const card of trade.offeredCards) {
      // Deduct from recipient
      const { data: rData } = await supabase.from('user_collection').select('copies').eq('osu_id', trade.recipientId).eq('beatmap_id', card.beatmapId).maybeSingle();
      if (rData && rData.copies > 1) {
        await supabase.from('user_collection').update({ copies: rData.copies - 1 }).eq('osu_id', trade.recipientId).eq('beatmap_id', card.beatmapId);
      } else {
        await supabase.from('user_collection').delete().eq('osu_id', trade.recipientId).eq('beatmap_id', card.beatmapId);
      }
      // Add to sender
      const { data: sData } = await supabase.from('user_collection').select('copies').eq('osu_id', trade.senderId).eq('beatmap_id', card.beatmapId).maybeSingle();
      await supabase.from('user_collection').upsert({
        osu_id: trade.senderId,
        beatmap_id: card.beatmapId,
        copies: (sData?.copies || 0) + 1,
        first_pulled_at: Date.now(),
        last_pulled_at: Date.now(),
        is_favorite: false,
      });
    }

    for (const card of trade.requestedCards) {
      // Deduct from sender
      const { data: sData } = await supabase.from('user_collection').select('copies').eq('osu_id', trade.senderId).eq('beatmap_id', card.beatmapId).maybeSingle();
      if (sData && sData.copies > 1) {
        await supabase.from('user_collection').update({ copies: sData.copies - 1 }).eq('osu_id', trade.senderId).eq('beatmap_id', card.beatmapId);
      } else {
        await supabase.from('user_collection').delete().eq('osu_id', trade.senderId).eq('beatmap_id', card.beatmapId);
      }
      // Add to recipient
      const { data: rData } = await supabase.from('user_collection').select('copies').eq('osu_id', trade.recipientId).eq('beatmap_id', card.beatmapId).maybeSingle();
      await supabase.from('user_collection').upsert({
        osu_id: trade.recipientId,
        beatmap_id: card.beatmapId,
        copies: (rData?.copies || 0) + 1,
        first_pulled_at: Date.now(),
        last_pulled_at: Date.now(),
        is_favorite: false,
      });
    }

    trade.status = 'revoked';
    trade.resolvedAt = Date.now();
    await this.saveTrades();

    return { success: true };
  }

  private async saveTrades() {
    this.notifyListeners();
    await supabase.from('admin_config').upsert({
      key: 'player_trades',
      value: this.trades,
      updated_at: new Date().toISOString(),
    });
  }

  public subscribe(listener: (trades: PlayerTrade[]) => void) {
    this.listeners.push(listener);
    listener(this.trades);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((fn) => fn([...this.trades]));
  }
}

export const tradingService = new TradingService();
