import type { VideoStats } from '../types';

// 日本語の一般的なストップワード・接続詞等
const STOPWORDS = new Set([
  'です', 'ます', 'した', 'する', 'ある', 'いる', 'これ', 'それ', 'あれ',
  'この', 'その', 'あの', 'こと', 'もの', 'ため', 'よう', 'など', 'から',
  'まで', 'より', 'だけ', 'ので', 'のに', 'なる', 'なっ', 'れる', 'られ',
  'せる', 'させ', 'てい', 'てる', 'では', 'には', 'での', 'への', 'との',
  'して', 'くる', 'いく', 'いう', 'とき', 'とも', 'ほど', 'という',
  'について', 'における', 'として', 'れた', 'れて', 'てき', 'しまう',
  'って', 'みる', 'ない', 'そう', 'だろ', 'でしょ', 'たち', 'たり',
]);

export interface KeywordStat {
  word: string;
  count: number;
  totalViews: number;
  avgViews: number;
  totalLikes: number;
  avgLikes: number;
  videoIds: string[];
}

/**
 * タイトルから日本語n-gramを抽出（2-4文字）
 * シンプルだが形態素解析ライブラリ不要で動く
 */
function extractNgrams(text: string): string[] {
  const cleaned = text
    .replace(/[【】（）()\[\]「」『』\s!！?？.。,、:：;；#＃@＠/／\\\-ー~〜|｜]+/g, ' ')
    .trim();
  const segments = cleaned.split(/\s+/);
  const ngrams = new Set<string>();

  for (const seg of segments) {
    // 英数字の連続はそのまま1単語として扱う
    if (/^[A-Za-z0-9]+$/.test(seg) && seg.length >= 2) {
      ngrams.add(seg.toLowerCase());
      continue;
    }
    // 日本語部分は n-gram 抽出
    for (let n = 2; n <= 4; n++) {
      for (let i = 0; i + n <= seg.length; i++) {
        const gram = seg.slice(i, i + n);
        // 数字のみ・記号のみは除外
        if (/^[0-9]+$/.test(gram)) continue;
        if (STOPWORDS.has(gram)) continue;
        ngrams.add(gram);
      }
    }
  }
  return Array.from(ngrams);
}

/**
 * 動画タイトル群からキーワード × パフォーマンスを集計
 */
export function analyzeKeywords(videos: VideoStats[], minOccurrence = 2): KeywordStat[] {
  const map = new Map<string, KeywordStat>();

  for (const v of videos) {
    const grams = extractNgrams(v.title);
    for (const g of grams) {
      const cur = map.get(g) ?? {
        word: g,
        count: 0,
        totalViews: 0,
        avgViews: 0,
        totalLikes: 0,
        avgLikes: 0,
        videoIds: [],
      };
      cur.count += 1;
      cur.totalViews += v.viewCount;
      cur.totalLikes += v.likeCount;
      cur.videoIds.push(v.videoId);
      map.set(g, cur);
    }
  }

  // 出現回数でフィルタ・平均計算
  const result: KeywordStat[] = [];
  for (const s of map.values()) {
    if (s.count < minOccurrence) continue;
    // より長いサブストリングに完全に含まれる短いn-gramは重複として除外する処理は後続で
    s.avgViews = s.totalViews / s.count;
    s.avgLikes = s.totalLikes / s.count;
    result.push(s);
  }

  // 短いn-gramが、より長いn-gramとほぼ同じvideoIdセットを持つ場合は除外
  const filtered = deduplicateByContainment(result);

  return filtered.sort((a, b) => b.avgViews - a.avgViews);
}

/**
 * 短いキーワードが、ほぼ同じ動画集合を持つより長いキーワードの一部なら除外
 */
function deduplicateByContainment(keywords: KeywordStat[]): KeywordStat[] {
  const sorted = [...keywords].sort((a, b) => b.word.length - a.word.length);
  const kept: KeywordStat[] = [];

  for (const k of sorted) {
    const redundant = kept.some((larger) => {
      if (!larger.word.includes(k.word)) return false;
      // 動画集合がほぼ同じ（9割以上一致）なら重複扱い
      const smallerSet = new Set(k.videoIds);
      const intersection = larger.videoIds.filter((id) => smallerSet.has(id)).length;
      return intersection / k.videoIds.length >= 0.9;
    });
    if (!redundant) kept.push(k);
  }
  return kept;
}
