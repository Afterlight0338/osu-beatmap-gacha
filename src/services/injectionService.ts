import { supabase } from '../lib/supabase';

export interface PullInjection {
  injectionId: string;
  osuId: number;
  beatmapId: number;
  injectedBy: string;
  createdAt: number;
  consumed: boolean;
  consumedAt?: number;
}

export type InjectionsMap = Record<string, PullInjection>; // keyed by osuId

class InjectionService {
  public async getInjections(): Promise<InjectionsMap> {
    try {
      const { data, error } = await supabase
        .from('admin_config')
        .select('value')
        .eq('key', 'pull_injections')
        .maybeSingle();

      if (error) {
        console.warn('Injections fetch notice:', error.message);
        return {};
      }

      if (data?.value && typeof data.value === 'object') {
        return data.value as InjectionsMap;
      }
    } catch (err) {
      console.warn('Injections load error:', err);
    }
    return {};
  }

  public async setInjection(params: {
    osuId: number;
    beatmapId: number;
    injectedBy: string;
  }): Promise<{ success: boolean; error?: string }> {
    const current = await this.getInjections();
    const newEntry: PullInjection = {
      injectionId: `inj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      osuId: params.osuId,
      beatmapId: params.beatmapId,
      injectedBy: params.injectedBy,
      createdAt: Date.now(),
      consumed: false,
    };

    current[String(params.osuId)] = newEntry;

    const { error } = await supabase.from('admin_config').upsert({
      key: 'pull_injections',
      value: current,
      updated_at: new Date().toISOString(),
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
  }

  public async removeInjection(osuId: number): Promise<{ success: boolean; error?: string }> {
    const current = await this.getInjections();
    delete current[String(osuId)];

    const { error } = await supabase.from('admin_config').upsert({
      key: 'pull_injections',
      value: current,
      updated_at: new Date().toISOString(),
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
  }

  public async consumeInjection(osuId: number): Promise<PullInjection | null> {
    try {
      const current = await this.getInjections();
      const injection = current[String(osuId)];
      if (!injection || injection.consumed) return null;

      // Mark as consumed immediately
      injection.consumed = true;
      injection.consumedAt = Date.now();
      delete current[String(osuId)]; // remove from active injections

      await supabase.from('admin_config').upsert({
        key: 'pull_injections',
        value: current,
        updated_at: new Date().toISOString(),
      });

      return injection;
    } catch (err) {
      console.warn('Consume injection notice:', err);
      return null;
    }
  }
}

export const injectionService = new InjectionService();
