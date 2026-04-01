/**
 * ReviewAnalyzer 单元测试
 *
 * 测试走法分类、转折点检测、通俗评论生成等核心逻辑。
 * EngineManager 依赖 WASM Worker，集成测试需要浏览器环境，
 * 这里仅测试纯逻辑方法（static 方法）。
 */

import { describe, it, expect } from 'vitest';
import { ReviewAnalyzer } from '../ReviewAnalyzer';

// ---------------------------------------------------------------------------
// classifyMove — 走法质量分类
// ---------------------------------------------------------------------------

describe('ReviewAnalyzer.classifyMove', () => {
  it('走的就是最佳走法时返回 good', () => {
    const result = ReviewAnalyzer.classifyMove(
      0,    // loss
      100,  // evalBeforeMover
      0,    // evalDelta
      'Nf3',
      'Nf3',
    );
    expect(result).toBe('good');
  });

  it('损失 <= 20cp 返回 good', () => {
    const result = ReviewAnalyzer.classifyMove(
      15,   // loss = 15cp
      200,  // evalBeforeMover
      -15,  // evalDelta
      'e4',
      'Nf3',
    );
    expect(result).toBe('good');
  });

  it('损失 >= 50cp 且 < 100cp 返回 inaccuracy', () => {
    const result = ReviewAnalyzer.classifyMove(
      60,   // loss
      200,  // evalBeforeMover
      -60,  // evalDelta
      'a3',
      'Nf3',
    );
    expect(result).toBe('inaccuracy');
  });

  it('损失 >= 100cp 且 < 200cp 返回 mistake', () => {
    const result = ReviewAnalyzer.classifyMove(
      150,  // loss
      200,  // evalBeforeMover
      -150, // evalDelta
      'h4',
      'Nf3',
    );
    expect(result).toBe('mistake');
  });

  it('损失 >= 200cp 返回 blunder', () => {
    const result = ReviewAnalyzer.classifyMove(
      300,  // loss
      200,  // evalBeforeMover
      -300, // evalDelta
      'Qh5',
      'Nf3',
    );
    expect(result).toBe('blunder');
  });

  it('在劣势局面大幅改善时返回 brilliant', () => {
    // 走子前己方劣势 -150cp，走完后改善 +100cp
    const result = ReviewAnalyzer.classifyMove(
      -100, // loss 为负 = 局面改善
      -150, // evalBeforeMover: 己方明显劣势
      100,  // evalDelta: 大幅改善
      'Bxf7',
      'Nf3',
    );
    expect(result).toBe('brilliant');
  });

  it('在优势局面即使改善也不算 brilliant', () => {
    // 走子前己方优势 +200cp，改善后更好
    const result = ReviewAnalyzer.classifyMove(
      -100, // loss 为负
      200,  // evalBeforeMover: 己方优势
      100,  // evalDelta
      'Bxf7',
      'Nf3',
    );
    // 不满足 brilliant 条件（不在劣势），loss 为负所以是 good
    expect(result).toBe('good');
  });

  it('损失在 20-50cp 之间也返回 good', () => {
    const result = ReviewAnalyzer.classifyMove(
      35,   // loss = 35cp，介于 GOOD 和 INACCURACY 之间
      100,
      -35,
      'd4',
      'Nf3',
    );
    expect(result).toBe('good');
  });
});

// ---------------------------------------------------------------------------
// isTurningPoint — 转折点检测
// ---------------------------------------------------------------------------

describe('ReviewAnalyzer.isTurningPoint', () => {
  it('优势方翻转且幅度足够大时返回 true', () => {
    expect(ReviewAnalyzer.isTurningPoint(80, -80)).toBe(true);
  });

  it('幅度不够大时返回 false', () => {
    expect(ReviewAnalyzer.isTurningPoint(20, -20)).toBe(false);
  });

  it('优势方没有翻转时返回 false', () => {
    expect(ReviewAnalyzer.isTurningPoint(100, 200)).toBe(false);
  });

  it('从均势到一方优势（符号翻转且幅度大）返回 true', () => {
    expect(ReviewAnalyzer.isTurningPoint(10, -200)).toBe(true);
  });

  it('两个都是 0 返回 false', () => {
    expect(ReviewAnalyzer.isTurningPoint(0, 0)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// describeEval — 局面通俗描述
// ---------------------------------------------------------------------------

describe('ReviewAnalyzer.describeEval', () => {
  it('势均力敌（|eval| <= 30）', () => {
    const desc = ReviewAnalyzer.describeEval(15);
    expect(desc).toContain('势均力敌');
  });

  it('白棋稍微领先（eval 30-80）', () => {
    const desc = ReviewAnalyzer.describeEval(50);
    expect(desc).toContain('白棋');
    expect(desc).toContain('稍微领先');
  });

  it('黑棋稍微领先（eval -30 to -80）', () => {
    const desc = ReviewAnalyzer.describeEval(-50);
    expect(desc).toContain('黑棋');
    expect(desc).toContain('稍微领先');
  });

  it('白棋占有优势（eval 80-200）', () => {
    const desc = ReviewAnalyzer.describeEval(150);
    expect(desc).toContain('白棋');
    expect(desc).toContain('优势');
  });

  it('黑棋优势很大（eval -200 to -500）', () => {
    const desc = ReviewAnalyzer.describeEval(-350);
    expect(desc).toContain('黑棋');
    expect(desc).toContain('优势很大');
  });

  it('白棋即将将杀（eval >= 10000）', () => {
    const desc = ReviewAnalyzer.describeEval(99999);
    expect(desc).toContain('白棋');
    expect(desc).toContain('将杀');
  });

  it('黑棋即将将杀（eval <= -10000）', () => {
    const desc = ReviewAnalyzer.describeEval(-99999);
    expect(desc).toContain('黑棋');
    expect(desc).toContain('将杀');
  });
});

// ---------------------------------------------------------------------------
// generateComment — 中文评论生成
// ---------------------------------------------------------------------------

describe('ReviewAnalyzer.generateComment', () => {
  it('brilliant 走法生成鼓励性评论', () => {
    const comment = ReviewAnalyzer.generateComment(
      'brilliant', 'Bxf7+', 'Bxf7+', 100, 'white', false,
    );
    expect(comment).toContain('妙招');
    expect(comment).toContain('太厉害了');
  });

  it('good 走法不生成评论（保持简洁）', () => {
    const comment = ReviewAnalyzer.generateComment(
      'good', 'Nf3', 'Nf3', 50, 'white', false,
    );
    expect(comment).toBe('');
  });

  it('inaccuracy 走法指出更好选择', () => {
    const comment = ReviewAnalyzer.generateComment(
      'inaccuracy', 'a3', 'Nf3', 30, 'white', false,
    );
    expect(comment).toContain('a3');
    expect(comment).toContain('Nf3');
    expect(comment).toContain('小瑕疵');
  });

  it('mistake 走法提示正确走法', () => {
    const comment = ReviewAnalyzer.generateComment(
      'mistake', 'h4', 'Nf3', -50, 'white', false,
    );
    expect(comment).toContain('走错');
    expect(comment).toContain('Nf3');
  });

  it('blunder 走法给予鼓励', () => {
    const comment = ReviewAnalyzer.generateComment(
      'blunder', 'Qh5', 'Nf3', -200, 'white', false,
    );
    expect(comment).toContain('失误');
    expect(comment).toContain('别灰心');
  });

  it('转折点时附加转折提示', () => {
    const comment = ReviewAnalyzer.generateComment(
      'mistake', 'e5', 'Nf3', -100, 'black', true,
    );
    expect(comment).toContain('大逆转');
  });

  it('非 good 走法时附加局面描述', () => {
    const comment = ReviewAnalyzer.generateComment(
      'mistake', 'h4', 'Nf3', 300, 'white', false,
    );
    // evalAfterWhite = 300, side = white => 用户领先
    expect(comment).toContain('领先') ;
  });
});
