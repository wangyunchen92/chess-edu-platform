/**
 * Translate rank title codes (from backend) to Chinese display names.
 */

const RANK_TITLE_MAP: Record<string, string> = {
  apprentice_1: '学徒 I', apprentice_2: '学徒 II', apprentice_3: '学徒 III',
  player_1: '棋手 I', player_2: '棋手 II', player_3: '棋手 III',
  warrior_1: '战士 I', warrior_2: '战士 II', warrior_3: '战士 III',
  knight_1: '骑士 I', knight_2: '骑士 II', knight_3: '骑士 III',
  master_1: '大师 I', master_2: '大师 II', master_3: '大师 III',
  grandmaster_1: '宗师 I', grandmaster_2: '宗师 II', grandmaster_3: '宗师 III',
  legend: '传奇',
}

export function translateRankTitle(raw: string): string {
  if (!raw) return ''
  if (RANK_TITLE_MAP[raw]) return RANK_TITLE_MAP[raw]
  if (/[\u4e00-\u9fa5]/.test(raw)) return raw
  return raw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
