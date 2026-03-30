/**
 * Translate puzzle theme tags (from backend) to Chinese display text.
 */

const THEME_MAP: Record<string, string> = {
  'mate_in_1': '一步杀！找到将杀的走法',
  'mate_in_2': '两步杀！找到将杀的走法',
  'mate_in_3': '三步杀！找到将杀的走法',
  'fork': '捉双！一步攻击两个目标',
  'pin': '牵制！钉住对方的棋子',
  'skewer': '串击！攻击一条线上的两个目标',
  'discovery': '闪击！移开一个棋子露出攻击',
  'double_check': '双将！两个棋子同时将军',
  'back_rank_mate': '底线杀！利用底线弱点将杀',
  'smothered_mate': '闷杀！用马将杀被自己棋子围住的王',
  'sacrifice': '弃子！牺牲棋子换取优势',
  'deflection': '引离！把保护者引开',
  'decoy': '引入！把对方棋子引到不利位置',
  'trapped_piece': '困子！让对方棋子无处可逃',
  'endgame': '残局技巧',
  'opening': '开局陷阱',
  'advantage': '找到最佳走法，获得优势',
  'defense': '防守！找到最好的防御方法',
  'crushing': '找到致命一击！',
}

export function translateTheme(theme: string): string {
  if (!theme) return '找到最佳走法'
  const lower = theme.toLowerCase().replace(/\s+/g, '_')
  if (THEME_MAP[lower]) return THEME_MAP[lower]
  for (const [key, val] of Object.entries(THEME_MAP)) {
    if (lower.includes(key) || key.includes(lower)) return val
  }
  if (/[\u4e00-\u9fa5]/.test(theme)) return theme
  return '找到最佳走法'
}
