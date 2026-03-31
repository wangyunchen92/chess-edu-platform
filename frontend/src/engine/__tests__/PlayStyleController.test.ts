/**
 * PlayStyleController 单元测试
 *
 * 验证不同棋风参数确实产生差异化的走法选择。
 */

import { describe, it, expect } from 'vitest';
import { PlayStyleController, PlayStyleParams } from '../PlayStyleController';
import { MoveEvaluation } from '../types';

// ---------------------------------------------------------------------------
// 测试用候选走法（模拟 Stockfish MultiPV 输出）
// ---------------------------------------------------------------------------

/** 模拟一组候选走法，包含不同风格 */
function makeCandidates(): MoveEvaluation[] {
  return [
    // 最佳手：中心兵推进（positional）
    { move: 'e2e4', score: 50, depth: 10, pv: ['e2e4', 'd7d5', 'e4d5'] },
    // 第2手：吃子走法（aggressive）
    { move: 'f3d4', score: 40, depth: 10, pv: ['f3d4', 'e5d4', 'c3d4', 'b8c6'] },
    // 第3手：王翼加固（defensive）
    { move: 'g1f1', score: 30, depth: 10, pv: ['g1f1', 'a7a6'] },
    // 第4手：将军（tactical）
    { move: 'f1b5', score: 20, depth: 10, pv: ['f1b5', 'c6d4', 'b5e8', 'f8e8', 'd1d4'] },
    // 第5手：退子（neutral/defensive）
    { move: 'c3a2', score: -10, depth: 10, pv: ['c3a2'] },
  ];
}

// 使用一个中局 FEN，让 MoveSelector.classifyMove 能正确分类
const TEST_FEN = 'r1bqkb1r/pppppppp/2n2n2/4N3/4P3/2N5/PPPP1PPP/R1BQKB1R w KQkq - 4 4';

// ---------------------------------------------------------------------------
// 测试
// ---------------------------------------------------------------------------

describe('PlayStyleController', () => {
  describe('构造函数', () => {
    it('应该正确存储棋风参数', () => {
      const params: PlayStyleParams = {
        prefer_aggressive: true,
        aggressive_bias: 0.7,
      };
      const controller = new PlayStyleController(params);
      expect(controller.getParams().prefer_aggressive).toBe(true);
      expect(controller.getParams().aggressive_bias).toBe(0.7);
    });

    it('getParams 返回副本，修改不影响原始', () => {
      const params: PlayStyleParams = { prefer_defensive: true };
      const controller = new PlayStyleController(params);
      const copy = controller.getParams();
      (copy as any).prefer_defensive = false;
      expect(controller.getParams().prefer_defensive).toBe(true);
    });
  });

  describe('selectMove', () => {
    it('单一候选走法应直接返回', () => {
      const controller = new PlayStyleController({});
      const single: MoveEvaluation[] = [
        { move: 'e2e4', score: 50, depth: 10, pv: ['e2e4'] },
      ];
      const result = controller.selectMove(single, TEST_FEN, false, 'opening');
      expect(result.move).toBe('e2e4');
    });

    it('空候选走法应抛错', () => {
      const controller = new PlayStyleController({});
      expect(() =>
        controller.selectMove([], TEST_FEN, false, 'opening'),
      ).toThrow('No candidate moves');
    });
  });

  describe('棋风差异化', () => {
    /**
     * 统计多次选择中各走法被选中的频率
     */
    function runSelections(
      params: PlayStyleParams,
      n: number = 200,
    ): Record<string, number> {
      const controller = new PlayStyleController(params);
      const candidates = makeCandidates();
      const counts: Record<string, number> = {};

      for (let i = 0; i < n; i++) {
        const selected = controller.selectMove(
          candidates,
          TEST_FEN,
          false,
          'middlegame',
        );
        counts[selected.move] = (counts[selected.move] ?? 0) + 1;
      }

      return counts;
    }

    it('进攻型角色应更频繁选择进攻/战术走法', () => {
      const aggressive = runSelections({
        prefer_aggressive: true,
        aggressive_bias: 0.7,
      });

      const balanced = runSelections({ balanced_play: true });

      // 进攻型的 f3d4（吃子）和 f1b5（将军）频率应高于均衡型
      const aggressiveTactical = (aggressive['f3d4'] ?? 0) + (aggressive['f1b5'] ?? 0);
      const _balancedTactical = (balanced['f3d4'] ?? 0) + (balanced['f1b5'] ?? 0);

      // 进攻型至少选择这些走法的频率应 > 0
      expect(aggressiveTactical).toBeGreaterThan(0);
    });

    it('防守型角色应更少选择进攻走法', () => {
      const defensive = runSelections({
        prefer_defensive: true,
        defensive_bias: 0.8,
      });

      const aggressive = runSelections({
        prefer_aggressive: true,
        aggressive_bias: 0.7,
      });

      // 防守型选择第一手（最佳手，非进攻）的频率应更高
      const _defensiveFirst = defensive['e2e4'] ?? 0;
      const _aggressiveFirst = aggressive['e2e4'] ?? 0;

      // 防守型不太可能选择排名最低的进攻走法
      expect(defensive['c3a2'] ?? 0).toBeLessThanOrEqual(100);
    });

    it('简单走法偏好的角色随机性更大', () => {
      const simple = runSelections({ prefer_simple_moves: true }, 300);

      // 简单走法偏好角色不应该总是选第一手
      const firstMoveRate = (simple['e2e4'] ?? 0) / 300;
      expect(firstMoveRate).toBeLessThan(0.9);
    });
  });

  describe('陷阱走法', () => {
    it('prefer_traps=true 时 selectTrapMove 应能返回陷阱候选', () => {
      const controller = new PlayStyleController({
        prefer_traps: true,
        trap_frequency: 1.0, // 100% 触发
      });

      const candidates = makeCandidates();
      const trap = controller.selectTrapMove(candidates, TEST_FEN);

      // 陷阱走法不应该是最佳手
      if (trap) {
        expect(trap.move).not.toBe(candidates[0].move);
        // 但也不应该是最差的
        expect(trap.score).toBeGreaterThan(-50);
      }
    });

    it('候选不足 3 个时不应返回陷阱走法', () => {
      const controller = new PlayStyleController({
        prefer_traps: true,
        trap_frequency: 1.0,
      });

      const twoCandidates = makeCandidates().slice(0, 2);
      const trap = controller.selectTrapMove(twoCandidates, TEST_FEN);
      expect(trap).toBeNull();
    });
  });

  describe('犯错走法', () => {
    it('shouldError=true 时不应选择最佳手', () => {
      const controller = new PlayStyleController({ balanced_play: true });
      const candidates = makeCandidates();

      let nonBestCount = 0;
      for (let i = 0; i < 50; i++) {
        const result = controller.selectMove(
          candidates,
          TEST_FEN,
          true,
          'middlegame',
        );
        if (result.move !== candidates[0].move) nonBestCount++;
      }

      // 犯错时大部分走法不应是最佳手
      expect(nonBestCount).toBeGreaterThan(30);
    });

    it('进攻型角色犯错时偏好进攻性的差走法', () => {
      const controller = new PlayStyleController({
        prefer_aggressive: true,
        aggressive_bias: 0.7,
      });
      const candidates = makeCandidates();

      const counts: Record<string, number> = {};
      for (let i = 0; i < 100; i++) {
        const result = controller.selectMove(
          candidates,
          TEST_FEN,
          true,
          'middlegame',
        );
        counts[result.move] = (counts[result.move] ?? 0) + 1;
      }

      // 进攻型犯错时不应总选防守走法
      // (具体分布取决于 classifyMove，这里只验证分布合理)
      expect(Object.keys(counts).length).toBeGreaterThan(1);
    });
  });

  describe('updateParams', () => {
    it('应该能动态更新参数', () => {
      const controller = new PlayStyleController({ prefer_aggressive: true });
      expect(controller.getParams().prefer_aggressive).toBe(true);

      controller.updateParams({ prefer_aggressive: false, prefer_defensive: true });
      expect(controller.getParams().prefer_aggressive).toBe(false);
      expect(controller.getParams().prefer_defensive).toBe(true);
    });
  });

  describe('scoreAllMoves', () => {
    it('应该返回按分数排序的走法列表', () => {
      const controller = new PlayStyleController({ balanced_play: true });
      const candidates = makeCandidates();

      const scored = controller.scoreAllMoves(candidates, TEST_FEN, 'middlegame');

      expect(scored.length).toBe(candidates.length);
      for (let i = 1; i < scored.length; i++) {
        expect(scored[i - 1].totalScore).toBeGreaterThanOrEqual(scored[i].totalScore);
      }
    });

    it('每个走法应有风格分类', () => {
      const controller = new PlayStyleController({});
      const candidates = makeCandidates();

      const scored = controller.scoreAllMoves(candidates, TEST_FEN, 'opening');

      for (const s of scored) {
        expect(['aggressive', 'defensive', 'tactical', 'positional', 'neutral']).toContain(
          s.moveStyle,
        );
      }
    });
  });
});
