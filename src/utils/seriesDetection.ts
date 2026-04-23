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

const HONORIFICS = '先生|さん|氏|社長|院長|代表|講師|教授|博士|理事長|センター長|主任|先輩';
const PERFORMER_RE = new RegExp(
  `([一-龥ぁ-んァ-ヶA-Za-z]{2,8})(${HONORIFICS})`,
  'g'
);

/**
 * テキスト（タイトル or 概要欄）から出演者名を抽出
 */
function extractPerformers(text: string): string[] {
  const results = new Set<string>();
  PERFORMER_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PERFORMER_RE.exec(text)) !== null) {
    results.add(m[1] + m[2]);
  }
  return Array.from(results);
}

/**
 * 概要欄の「出演者：〇〇、△△」のような構造化行から名前を抽出
 */
function extractFromDescription(description: string): string[] {
  const results = new Set<string>();

  // パターン1: "出演者：〇〇" / "ゲスト：〇〇" / "講師：〇〇" / "キャスト：〇〇" 等のラベル行
  const labelRe = /(?:出演者?|ゲスト|講師|キャスト|登場人物|先生方|出演|登壇者?|パネリスト)[：:]\s*([^\n]{2,60})/g;
  let m: RegExpExecArray | null;
  while ((m = labelRe.exec(description)) !== null) {
    // 名前はカンマ・読点・スラッシュ・スペースで区切られていることが多い
    const names = m[1].split(/[,、・／/\s]+/);
    for (const raw of names) {
      const name = raw.trim();
      if (name.length >= 2 && name.length <= 12) results.add(name);
    }
  }

  // パターン2: 概要欄中の "〇〇先生" / "〇〇さん" 等の敬称付き表現
  for (const p of extractPerformers(description)) {
    results.add(p);
  }

  // パターン3: "▶ 〇〇（役職）" 形式
  const arrowRe = /[▶►▷→]\s*([一-龥ぁ-んァ-ヶ]{2,8})[　\s]*[（(][^）)]{1,20}[）)]/g;
  while ((m = arrowRe.exec(description)) !== null) {
    const name = m[1].trim();
    if (name.length >= 2) results.add(name);
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

  // Brackets & Performers（タイトル + 概要欄の両方を使う）
  for (const v of videos) {
    for (const b of extractBrackets(v.title)) {
      addToGroup(`bracket:${b}`, b, 'bracket', v);
    }
    // タイトルから出演者検出
    const titlePerformers = extractPerformers(v.title);
    // 概要欄から出演者検出
    const descPerformers = v.description ? extractFromDescription(v.description) : [];
    // 重複を除いてマージ
    const allPerformers = Array.from(new Set([...titlePerformers, ...descPerformers]));
    for (const p of allPerformers) {
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
