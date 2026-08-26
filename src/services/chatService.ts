import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface ChatMessage {
  id: string;
  osuId: number;
  username: string;
  avatarUrl?: string;
  countryCode?: string;
  text: string;
  createdAt: number; // epoch ms
  isAdmin?: boolean;
  cardBadge?: {
    title: string;
    rarity: string;
    stars: number;
    coverUrl?: string;
  };
}

export interface OnlinePlayer {
  osuId: number;
  username: string;
  avatarUrl?: string;
  countryCode?: string;
  onlineAt: number;
  totalPulls?: number;
  rarestCard?: string;
}

// 12-Hour Storage Limit in Milliseconds
export const CHAT_RETENTION_MS = 12 * 60 * 60 * 1000;

// Bad Words / Profanity Filter Dictionary
const PROFANITY_PATTERNS: RegExp[] = [
  /\b(nigg[ae]r?|fag(got)?|kike|chink|spic|retard|cunt)\b/gi,
  /\b(fuck(ing|er|ed)?|shit(ty|head)?|bitch|asshole|whore|slut)\b/gi,
  /\b(kys|kill\s*your\s*self)\b/gi,
];

export function filterProfanity(text: string): string {
  let filtered = text;
  for (const pattern of PROFANITY_PATTERNS) {
    filtered = filtered.replace(pattern, (match) => '*'.repeat(match.length));
  }
  return filtered;
}

class ChatService {
  private channel: RealtimeChannel | null = null;
  private presenceChannel: RealtimeChannel | null = null;
  private messageListeners: ((messages: ChatMessage[]) => void)[] = [];
  private presenceListeners: ((players: OnlinePlayer[]) => void)[] = [];
  private cachedMessages: ChatMessage[] = [];
  private onlinePlayersMap: Map<string, OnlinePlayer> = new Map();
  private lastMessageTime = 0;
  private lastMessageText = '';

  public async init(user?: { osuId: number; username: string; avatarUrl?: string; countryCode?: string; totalPulls?: number; rarestCard?: string } | null) {
    // 1. Fetch initial chat history from Supabase (pruning anything older than 12 hours)
    await this.fetchAndCleanHistory();

    // 2. Setup Realtime Broadcast channel for instant zero-latency messages
    if (!this.channel) {
      this.channel = supabase.channel('global_chat_channel', {
        config: { broadcast: { self: true } },
      });

      this.channel.on('broadcast', { event: 'new_message' }, (payload: { payload: ChatMessage }) => {
        if (payload?.payload) {
          this.handleIncomingMessage(payload.payload);
        }
      });

      this.channel.subscribe();
    }

    // 3. Setup Presence Channel for Online Players
    if (!this.presenceChannel) {
      const presenceKey = user?.osuId ? String(user.osuId) : `guest_${Math.random().toString(36).substring(2, 9)}`;
      this.presenceChannel = supabase.channel('global_presence_channel', {
        config: { presence: { key: presenceKey } },
      });

      this.presenceChannel.on('presence', { event: 'sync' }, () => {
        const state = this.presenceChannel?.presenceState() || {};
        this.updatePresenceFromState(state);
      });

      this.presenceChannel.on('presence', { event: 'join' }, () => {
        const state = this.presenceChannel?.presenceState() || {};
        this.updatePresenceFromState(state);
      });

      this.presenceChannel.on('presence', { event: 'leave' }, () => {
        const state = this.presenceChannel?.presenceState() || {};
        this.updatePresenceFromState(state);
      });

      this.presenceChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          if (user?.osuId) {
            await this.presenceChannel?.track({
              osuId: user.osuId,
              username: user.username,
              avatarUrl: user.avatarUrl,
              countryCode: user.countryCode,
              onlineAt: Date.now(),
              totalPulls: user.totalPulls || 0,
              rarestCard: user.rarestCard,
            });
          }
        }
      });
    } else if (user?.osuId) {
      this.presenceChannel.track({
        osuId: user.osuId,
        username: user.username,
        avatarUrl: user.avatarUrl,
        countryCode: user.countryCode,
        onlineAt: Date.now(),
        totalPulls: user.totalPulls || 0,
        rarestCard: user.rarestCard,
      }).catch(() => {});
    }
  }

  public async updatePresence(user: { osuId: number; username: string; avatarUrl?: string; countryCode?: string; totalPulls?: number; rarestCard?: string }) {
    if (this.presenceChannel && user?.osuId) {
      try {
        await this.presenceChannel.track({
          osuId: user.osuId,
          username: user.username,
          avatarUrl: user.avatarUrl,
          countryCode: user.countryCode,
          onlineAt: Date.now(),
          totalPulls: user.totalPulls || 0,
          rarestCard: user.rarestCard,
        });
      } catch (err) {
        console.warn('Presence update error:', err);
      }
    }
  }

  private updatePresenceFromState(state: Record<string, any[]>) {
    const map = new Map<string, OnlinePlayer>();
    for (const [, presences] of Object.entries(state)) {
      if (Array.isArray(presences) && presences.length > 0) {
        const p = presences[0];
        if (p?.osuId) {
          map.set(String(p.osuId), {
            osuId: p.osuId,
            username: p.username || 'Summoner',
            avatarUrl: p.avatarUrl,
            countryCode: p.countryCode,
            onlineAt: p.onlineAt || Date.now(),
            totalPulls: p.totalPulls,
            rarestCard: p.rarestCard,
          });
        }
      }
    }
    this.onlinePlayersMap = map;
    const players = Array.from(map.values()).sort((a, b) => b.onlineAt - a.onlineAt);
    this.presenceListeners.forEach((fn) => fn(players));
  }

  public async fetchAndCleanHistory(): Promise<ChatMessage[]> {
    try {
      const { data, error } = await supabase
        .from('admin_config')
        .select('value')
        .eq('key', 'global_chat_messages')
        .maybeSingle();

      if (error) {
        console.warn('Chat history fetch notice:', error.message);
        return [];
      }

      if (data?.value && Array.isArray(data.value)) {
        const cutoff = Date.now() - CHAT_RETENTION_MS;
        // Purge messages older than 12 hours
        const activeMessages = (data.value as ChatMessage[]).filter((m) => m.createdAt >= cutoff);
        this.cachedMessages = activeMessages;
        this.notifyMessageListeners();
        return activeMessages;
      }
    } catch (err) {
      console.warn('Chat history load error:', err);
    }
    return [];
  }

  public async sendMessage(params: {
    osuId: number;
    username: string;
    avatarUrl?: string;
    countryCode?: string;
    text: string;
    isAdmin?: boolean;
    cardBadge?: ChatMessage['cardBadge'];
  }): Promise<{ success: boolean; error?: string }> {
    const rawText = params.text.trim();
    if (!rawText) return { success: false, error: 'Message cannot be empty.' };

    if (rawText.length > 250) {
      return { success: false, error: 'Message cannot exceed 250 characters.' };
    }

    const now = Date.now();
    // 2-second rate limit
    if (now - this.lastMessageTime < 2000) {
      return { success: false, error: 'Slow down! Please wait 2 seconds between messages.' };
    }

    // Anti-duplicate spam within 10 seconds
    if (rawText.toLowerCase() === this.lastMessageText.toLowerCase() && now - this.lastMessageTime < 10000) {
      return { success: false, error: 'Duplicate message detected. Please do not spam.' };
    }

    this.lastMessageTime = now;
    this.lastMessageText = rawText;

    const filteredText = filterProfanity(rawText);

    const newMsg: ChatMessage = {
      id: `${now}-${Math.random().toString(36).substring(2, 7)}`,
      osuId: params.osuId,
      username: params.username,
      avatarUrl: params.avatarUrl,
      countryCode: params.countryCode,
      text: filteredText,
      createdAt: now,
      isAdmin: params.isAdmin,
      cardBadge: params.cardBadge,
    };

    // 1. Broadcast immediately to all active clients
    if (this.channel) {
      this.channel.send({
        type: 'broadcast',
        event: 'new_message',
        payload: newMsg,
      }).catch((err) => console.warn('Broadcast send notice:', err));
    }

    // 2. Update local state
    this.handleIncomingMessage(newMsg);

    // 3. Persist to Supabase with 12-hour pruning in background
    this.persistMessagesToCloud().catch((err) => console.warn('Persist chat error:', err));

    return { success: true };
  }

  private handleIncomingMessage(msg: ChatMessage) {
    const cutoff = Date.now() - CHAT_RETENTION_MS;
    if (msg.createdAt < cutoff) return;

    if (!this.cachedMessages.some((m) => m.id === msg.id)) {
      this.cachedMessages = [...this.cachedMessages.filter((m) => m.createdAt >= cutoff), msg];
      this.notifyMessageListeners();
    }
  }

  private async persistMessagesToCloud() {
    const cutoff = Date.now() - CHAT_RETENTION_MS;
    const cleanList = this.cachedMessages.filter((m) => m.createdAt >= cutoff);
    // Keep max 200 messages in cloud buffer
    const capped = cleanList.slice(-200);

    await supabase.from('admin_config').upsert({
      key: 'global_chat_messages',
      value: capped,
      updated_at: new Date().toISOString(),
    });
  }

  public onMessages(listener: (messages: ChatMessage[]) => void) {
    this.messageListeners.push(listener);
    listener(this.cachedMessages);
    return () => {
      this.messageListeners = this.messageListeners.filter((l) => l !== listener);
    };
  }

  public onPresence(listener: (players: OnlinePlayer[]) => void) {
    this.presenceListeners.push(listener);
    const players = Array.from(this.onlinePlayersMap.values()).sort((a, b) => b.onlineAt - a.onlineAt);
    listener(players);
    return () => {
      this.presenceListeners = this.presenceListeners.filter((l) => l !== listener);
    };
  }

  private notifyMessageListeners() {
    this.messageListeners.forEach((fn) => fn([...this.cachedMessages]));
  }
}

export const chatService = new ChatService();
