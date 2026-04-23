import type { VideoStats } from '../types';

export interface SeriesGroup {
  pattern: string;
  label: string;
  type: 'bracket' | 'prefix' | 'performer';
  videos: VideoStats[];
  count: number;
  avgViews: number;
  avgLikes: number;
  totalViews: number;
}

/**
 * タイトルから出演者名（"〇〇先生"、"〇〇さん" 等）を抽出
 */
function extractPerformers(title: string): string[] {
  const results = new Set<string>();
  // 〇〇先生 / 〇〇さん / 〇〇氏 / 〇〇社長
  const patterns = [
    /([一-龥ぁ-んァ-ヶA-Za-z]{2,6})(先生|さん|氏|社長|院長|代表|講師|教授|博士)/g,
  ];
  for (const p of patterns) {
    let m: RegExpExecArray | null;
    while ((m = p.exec(title)) !== null) {
      results.add(m[1] + m[2]);
    }
  }
  return Array.from(results);
}

/**
 * タイトルから【】【[]（）()で囲まれたラベルを抽出
 */
function extractBrackets(title: string): string[] {
  const results = new Set<string>();
  const patterns = [
    /【([^】]{1,15})】/g,
    /\[([^\]]{1,15})\]/g,
    /《([^》]{1,15})》/g,
  ];
  for (const p of patterns) {
    let m: RegExpExecArray | null;
    while ((m = p.exec(title)) !== null) {
      const label = m[1].trim();
      if (label.length >= 2) results.add(label);
    }
  }
  return Array.from(results);
}

/**
 * シリーズ（共通プレフィックス）を検出
 */
function extractCommonPrefixes(titles: string[]): Map<string, number> {
  const prefixCounts = new Map<string, number>();
  for (let i = 0; i < titles.length; i++) {
    for (let j = i + 1; j < titles.length; j++) {
      const a = titles[i];
      const b = titles[j];
      let common = 0;
      while (common < Math.min(a.length, b.length) && a[common] === b[common]) {
        common++;
      }
      // 3文字以上共通なら記録
      if (common >= 3) {
        const prefix = a.slice(0, common).trim();
        // 記号で終わっていれば除去
        const cleaned = prefix.replace(/[\s|｜・、。!！?？.]+$/, '');
        if (cleaned.length >= 3) {
          prefixCounts.set(cleaned, (prefixCounts.get(cleaned) ?? 0) + 1);
        }
      }
    }
  }
  return prefixCounts;
}

export function detectSeries(videos: VideoStats[], minCount = 2): SeriesGroup[] {
  const groups = new Map<string, SeriesGroup>();

  const addToGroup = (key: string, label: string, type: SeriesGroup['type'], v: VideoStats) => {
    const cur = groups.get(key) ?? {
      pattern: key,
      label,
      type,
      videos: [],
      count: 0,
      avgViews: 0,
      avgLikes: 0,
      totalViews: 0,
    };
    cur.videos.push(v);
    cur.count += 1;
    cur.totalViews += v.viewCount;
    groups.set(key, cur);
  };

  // Brackets & Performers
  for (const v of videos) {
    for (const b of extractBrackets(v.title)) {
      addToGroup(`bracket:${b}`, b, 'bracket', v);
    }
    for (const p of extractPerformers(v.title)) {
      addToGroup(`performer:${p}`, p, 'performer', v);
    }
  }

  // Common prefixes
  const prefixes = extractCommonPrefixes(videos.map((v) => v.title));
  for (const [prefix, pairCount] of prefixes.entries()) {
    // 共通プレフィックスを持つ動画が3本以上
    if (pairCount < 2) continue;
    const matching = videos.filter((v) => v.title.startsWith(prefix));
    if (matching.length < 3) continue;
    const key = `prefix:${prefix}`;
    if (groups.has(key)) continue;
    groups.set(key, {
      pattern: key,
      label: prefix,
      type: 'prefix',
      videos: matching,
      count: matching.length,
      avgViews: 0,
      avgLikes: 0,
      totalViews: matching.reduce((s, v) => s + v.viewCount, 0),
    });
  }

  // 平均計算 & フィルタ
  const result: SeriesGroup[] = [];
  for (const g of groups.values()) {
    if (g.count < minCount) continue;
    g.avgViews = g.totalViews / g.count;
    g.avgLikes = g.videos.reduce((s, v) => s + v.likeCount, 0) / g.count;
    result.push(g);
  }

  return result.sort((a, b) => b.avgViews - a.avgViews);
}
