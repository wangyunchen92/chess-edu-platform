/**
 * AdaptiveDifficulty 单元测试
 */

import { describe, it, expect } from 'vitest';
import { AdaptiveDifficulty, AdaptiveDifficultyConfig } from '../AdaptiveDifficulty';

describe('AdaptiveDifficulty', () => {
  describe('getRecentWinRate', () => {
    it('无对局记录时返回 0.5', () => {
      const ad = new AdaptiveDifficulty();
      expect(ad.getRecentWinRate()).toBe(0.5);
    });

    it('全赢返回 1.0', () => {
      const ad = new AdaptiveDifficulty();
      for (let i = 0; i < 5; i++) {
        ad.addGameRecord({ result: 'win', characterId: 'douding', timestamp: Date.now() });
      }
      expect(ad.getRecentWinRate()).toBe(1.0);
    });

    it('全输返回 0.0', () => {
      const ad = new AdaptiveDifficulty();
      for (let i = 0; i < 5; i++) {
        ad.addGameRecord({ result: 'loss', characterId: 'douding', timestamp: Date.now() });
      }
      expect(ad.getRecentWinRate()).toBe(0.0);
    });

    it('和棋算半赢', () => {
      const ad = new AdaptiveDifficulty();
      for (let i = 0; i < 4; i++) {
        ad.addGameRecord({ result: 'draw', characterId: 'douding', timestamp: Date.now() });
      }
      expect(ad.getRecentWinRate()).toBe(0.5);
    });

    it('可按角色 ID 过滤', () => {
      const ad = new AdaptiveDifficulty();
      ad.addGameRecord({ result: 'win', characterId: 'douding', timestamp: Date.now() });
      ad.addGameRecord({ result: 'loss', characterId: 'guigui', timestamp: Date.now() });
      ad.addGameRecord({ result: 'win', characterId: 'douding', timestamp: Date.now() });

      expect(ad.getRecentWinRate('douding')).toBe(1.0);
      expect(ad.getRecentWinRate('guigui')).toBe(0.0);
    });
  });

  describe('calculateAdjustedParams (本地计算)', () => {
    it('胜率在目标区间内不调整', () => {
      const ad = new AdaptiveDifficulty();
      // 添加均衡的对局
      ad.addGameRecord({ result: 'win', characterId: 'douding', timestamp: Date.now() });
      ad.addGameRecord({ result: 'loss', characterId: 'douding', timestamp: Date.now() });
      ad.addGameRecord({ result: 'win', characterId: 'douding', timestamp: Date.now() });
      ad.addGameRecord({ result: 'loss', characterId: 'douding', timestamp: Date.now() });
      ad.addGameRecord({ result: 'draw', characterId: 'douding', timestamp: Date.now() });

      const params = ad.calculateAdjustedParams(5, 7, 0.25, 'douding');
      expect(params.depthMin).toBe(5);
      expect(params.depthMax).toBe(7);
      expect(params.errorRate).toBe(0.25);
      expect(params.difficultyMode).toBe('normal');
    });

    it('连胜时提高难度', () => {
      const ad = new AdaptiveDifficulty();
      for (let i = 0; i < 5; i++) {
        ad.addGameRecord({ result: 'win', characterId: 'douding', timestamp: Date.now() });
      }

      const params = ad.calculateAdjustedParams(5, 7, 0.25, 'douding');
      expect(params.depthMin).toBeGreaterThanOrEqual(5);
      expect(params.depthMax).toBeGreaterThanOrEqual(7);
      expect(params.errorRate).toBeLessThan(0.25);
      expect(params.difficultyMode).toBe('hard');
      expect(params.ratingOffset).toBeGreaterThan(0);
    });

    it('连败时降低难度', () => {
      const ad = new AdaptiveDifficulty();
      for (let i = 0; i < 5; i++) {
        ad.addGameRecord({ result: 'loss', characterId: 'douding', timestamp: Date.now() });
      }

      const params = ad.calculateAdjustedParams(5, 7, 0.25, 'douding');
      expect(params.depthMin).toBeLessThanOrEqual(5);
      expect(params.errorRate).toBeGreaterThan(0.25);
      expect(params.difficultyMode).toBe('easy');
      expect(params.ratingOffset).toBeLessThan(0);
    });

    it('深度不会降到 1 以下', () => {
      const ad = new AdaptiveDifficulty();
      for (let i = 0; i < 5; i++) {
        ad.addGameRecord({ result: 'loss', characterId: 'douding', timestamp: Date.now() });
      }

      const params = ad.calculateAdjustedParams(2, 3, 0.5, 'douding');
      expect(params.depthMin).toBeGreaterThanOrEqual(1);
      expect(params.depthMax).toBeGreaterThan(params.depthMin);
    });

    it('失误率不会超过 1 或低于 0', () => {
      const ad = new AdaptiveDifficulty();
      for (let i = 0; i < 5; i++) {
        ad.addGameRecord({ result: 'loss', characterId: 'douding', timestamp: Date.now() });
      }

      const params = ad.calculateAdjustedParams(5, 7, 0.95, 'douding');
      expect(params.errorRate).toBeLessThanOrEqual(1);
      expect(params.errorRate).toBeGreaterThanOrEqual(0);
    });
  });

  describe('calculateAdjustedParams (后端配置)', () => {
    it('优先使用后端配置', () => {
      const ad = new AdaptiveDifficulty();
      const serverConfig: AdaptiveDifficultyConfig = {
        rating_offset: 100,
        depth_adjustment: 2,
        mistake_rate_adjustment: -0.1,
        recent_win_rate: 0.8,
        recent_games_count: 5,
      };

      ad.setServerConfig(serverConfig);

      const params = ad.calculateAdjustedParams(5, 7, 0.25);
      expect(params.depthMin).toBe(7);
      expect(params.depthMax).toBe(9);
      expect(params.errorRate).toBeCloseTo(0.15);
      expect(params.ratingOffset).toBe(100);
      expect(params.difficultyMode).toBe('hard');
    });

    it('后端配置的 easy 模式', () => {
      const ad = new AdaptiveDifficulty();
      ad.setServerConfig({
        rating_offset: -100,
        depth_adjustment: -2,
        mistake_rate_adjustment: 0.1,
        recent_win_rate: 0.2,
        recent_games_count: 5,
      });

      const params = ad.calculateAdjustedParams(5, 7, 0.25);
      expect(params.depthMin).toBe(3);
      expect(params.errorRate).toBeCloseTo(0.35);
      expect(params.difficultyMode).toBe('easy');
    });
  });

  describe('getRecentGamesCount', () => {
    it('返回记录的对局数', () => {
      const ad = new AdaptiveDifficulty();
      expect(ad.getRecentGamesCount()).toBe(0);

      ad.addGameRecord({ result: 'win', characterId: 'douding', timestamp: Date.now() });
      ad.addGameRecord({ result: 'loss', characterId: 'douding', timestamp: Date.now() });
      expect(ad.getRecentGamesCount()).toBe(2);
    });

    it('最大返回窗口大小', () => {
      const ad = new AdaptiveDifficulty();
      for (let i = 0; i < 20; i++) {
        ad.addGameRecord({ result: 'win', characterId: 'douding', timestamp: Date.now() });
      }
      expect(ad.getRecentGamesCount()).toBe(5); // RECENT_GAMES_WINDOW = 5
    });
  });
});
