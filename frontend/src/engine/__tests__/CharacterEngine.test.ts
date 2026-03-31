/**
 * CharacterEngine 单元测试
 *
 * 测试 buildCharacterConfigFromAPI / buildCharacterConfigFromJSON 工具函数，
 * 以及 CharacterConfig 构建的正确性。
 *
 * 注意：CharacterEngine.getMove() 依赖 Stockfish WASM Worker，
 * 在单元测试中无法直接测试，需要集成测试或 mock。
 */

import { describe, it, expect } from 'vitest';
import {
  buildCharacterConfigFromAPI,
  buildCharacterConfigFromJSON,
} from '../CharacterEngine';

describe('buildCharacterConfigFromJSON', () => {
  it('应该正确映射豆丁配置', () => {
    const config = buildCharacterConfigFromJSON({
      id: 'douding',
      name: '豆丁',
      rating: 500,
      engine_params: {
        depth_min: 3,
        depth_max: 5,
        error_rate: 0.3,
        prefer_simple_moves: true,
        avoid_long_sequences: true,
      },
    });

    expect(config.id).toBe('douding');
    expect(config.name).toBe('豆丁');
    expect(config.rating).toBe(500);
    expect(config.depthMin).toBe(3);
    expect(config.depthMax).toBe(5);
    expect(config.errorRate).toBe(0.3);
    expect(config.playStyleParams?.prefer_simple_moves).toBe(true);
    expect(config.playStyleParams?.avoid_long_sequences).toBe(true);
  });

  it('应该正确映射狸花花配置（陷阱型）', () => {
    const config = buildCharacterConfigFromJSON({
      id: 'lihuahua',
      name: '狸花花',
      rating: 1000,
      engine_params: {
        depth_min: 7,
        depth_max: 9,
        error_rate: 0.2,
        prefer_traps: true,
        prefer_tactical: true,
        trap_frequency: 0.2,
      },
    });

    expect(config.depthMin).toBe(7);
    expect(config.depthMax).toBe(9);
    expect(config.errorRate).toBe(0.2);
    expect(config.playStyleParams?.prefer_traps).toBe(true);
    expect(config.playStyleParams?.trap_frequency).toBe(0.2);
    // styleWeights 应偏向 tactics
    expect(config.styleWeights.tactics).toBeGreaterThan(config.styleWeights.defense);
  });

  it('应该正确映射铁墩墩配置（防守型）', () => {
    const config = buildCharacterConfigFromJSON({
      id: 'tiedundun',
      name: '铁墩墩',
      rating: 1100,
      engine_params: {
        depth_min: 8,
        depth_max: 10,
        error_rate: 0.15,
        defensive_bias: 0.8,
        prefer_solid_structure: true,
        prefer_closed_positions: true,
      },
    });

    expect(config.playStyleParams?.defensive_bias).toBe(0.8);
    expect(config.playStyleParams?.prefer_solid_structure).toBe(true);
    // styleWeights 应偏向 defense
    expect(config.styleWeights.defense).toBeGreaterThan(config.styleWeights.attack);
  });

  it('应该正确映射银鬃配置（进攻型）', () => {
    const config = buildCharacterConfigFromJSON({
      id: 'yinzong',
      name: '银鬃',
      rating: 1300,
      engine_params: {
        depth_min: 10,
        depth_max: 12,
        error_rate: 0.1,
        aggressive_bias: 0.7,
        prefer_open_positions: true,
        kingside_attack_weight: 0.6,
      },
    });

    expect(config.playStyleParams?.aggressive_bias).toBe(0.7);
    expect(config.playStyleParams?.kingside_attack_weight).toBe(0.6);
    // styleWeights 应偏向 attack
    expect(config.styleWeights.attack).toBeGreaterThan(config.styleWeights.defense);
  });

  it('应该正确映射咕噜配置（陷阱+位置型）', () => {
    const config = buildCharacterConfigFromJSON({
      id: 'gulu',
      name: '咕噜',
      rating: 1450,
      engine_params: {
        depth_min: 11,
        depth_max: 13,
        error_rate: 0.08,
        prefer_traps: true,
        positional_play: true,
        trap_frequency: 0.3,
        sacrifice_willingness: 0.4,
        poison_pawn_tendency: 0.25,
      },
    });

    expect(config.playStyleParams?.prefer_traps).toBe(true);
    expect(config.playStyleParams?.positional_play).toBe(true);
    expect(config.playStyleParams?.trap_frequency).toBe(0.3);
    expect(config.playStyleParams?.sacrifice_willingness).toBe(0.4);
    expect(config.playStyleParams?.poison_pawn_tendency).toBe(0.25);
  });

  it('应该正确映射云朵师父配置（自适应型）', () => {
    const config = buildCharacterConfigFromJSON({
      id: 'yunduoshifu',
      name: '云朵师父',
      rating: 1550,
      engine_params: {
        depth_min: 12,
        depth_max: 14,
        error_rate: 0.05,
        positional_bias: 0.8,
        balanced_play: true,
        adaptive_style: true,
        endgame_strength: 0.9,
      },
    });

    expect(config.playStyleParams?.positional_bias).toBe(0.8);
    expect(config.playStyleParams?.adaptive_style).toBe(true);
    expect(config.playStyleParams?.endgame_strength).toBe(0.9);
    // styleWeights 应偏向 positional
    expect(config.styleWeights.positional).toBeGreaterThan(config.styleWeights.attack);
  });

  it('思考时间应与 Rating 成正比', () => {
    const weak = buildCharacterConfigFromJSON({
      id: 'a', name: 'a', rating: 500,
      engine_params: { depth_min: 3, depth_max: 5, error_rate: 0.3 },
    });
    const strong = buildCharacterConfigFromJSON({
      id: 'b', name: 'b', rating: 1500,
      engine_params: { depth_min: 12, depth_max: 14, error_rate: 0.05 },
    });

    expect(strong.thinkTimeMinMs).toBeGreaterThan(weak.thinkTimeMinMs);
    expect(strong.thinkTimeMaxMs).toBeGreaterThan(weak.thinkTimeMaxMs);
  });
});

describe('buildCharacterConfigFromAPI', () => {
  it('应该正确映射后端 CharacterDetail 格式', () => {
    const config = buildCharacterConfigFromAPI({
      id: 'char_123',
      slug: 'lihuahua',
      name: '狸花花',
      base_rating: 1000,
      engine_depth_min: 7,
      engine_depth_max: 9,
      mistake_rate: 0.2,
      play_style_params: {
        prefer_traps: true,
        trap_frequency: 0.2,
        prefer_tactical: true,
      },
    });

    expect(config.id).toBe('char_123');
    expect(config.name).toBe('狸花花');
    expect(config.rating).toBe(1000);
    expect(config.depthMin).toBe(7);
    expect(config.depthMax).toBe(9);
    expect(config.errorRate).toBe(0.2);
    expect(config.playStyleParams?.prefer_traps).toBe(true);
    expect(config.playStyleParams?.trap_frequency).toBe(0.2);
  });

  it('没有 play_style_params 时应使用均衡权重', () => {
    const config = buildCharacterConfigFromAPI({
      name: '测试角色',
      base_rating: 800,
      engine_depth_min: 5,
      engine_depth_max: 7,
      mistake_rate: 0.3,
    });

    expect(config.playStyleParams).toBeUndefined();
    expect(config.styleWeights.attack).toBe(0.25);
    expect(config.styleWeights.defense).toBe(0.25);
    expect(config.styleWeights.tactics).toBe(0.25);
    expect(config.styleWeights.positional).toBe(0.25);
  });

  it('styleWeights 应该归一化', () => {
    const config = buildCharacterConfigFromAPI({
      name: '测试',
      base_rating: 1300,
      engine_depth_min: 10,
      engine_depth_max: 12,
      mistake_rate: 0.1,
      play_style_params: {
        aggressive_bias: 0.7,
        defensive_bias: 0.3,
      },
    });

    const total =
      config.styleWeights.attack +
      config.styleWeights.defense +
      config.styleWeights.tactics +
      config.styleWeights.positional;

    expect(total).toBeCloseTo(1.0, 5);
  });
});

describe('9 角色棋风差异验证', () => {
  const characters = [
    {
      id: 'douding', name: '豆丁', rating: 500,
      engine_params: { depth_min: 3, depth_max: 5, error_rate: 0.3, prefer_simple_moves: true },
    },
    {
      id: 'mianhuatang', name: '棉花糖', rating: 650,
      engine_params: { depth_min: 4, depth_max: 6, error_rate: 0.28, prefer_aggressive: true },
    },
    {
      id: 'guigui', name: '龟龟', rating: 750,
      engine_params: { depth_min: 5, depth_max: 7, error_rate: 0.25, prefer_defensive: true, endgame_strength: 0.85 },
    },
    {
      id: 'dongdong', name: '冬冬', rating: 850,
      engine_params: { depth_min: 6, depth_max: 8, error_rate: 0.25, balanced_play: true },
    },
    {
      id: 'lihuahua', name: '狸花花', rating: 1000,
      engine_params: { depth_min: 7, depth_max: 9, error_rate: 0.2, prefer_traps: true, trap_frequency: 0.2 },
    },
    {
      id: 'tiedundun', name: '铁墩墩', rating: 1100,
      engine_params: { depth_min: 8, depth_max: 10, error_rate: 0.15, defensive_bias: 0.8 },
    },
    {
      id: 'yinzong', name: '银鬃', rating: 1300,
      engine_params: { depth_min: 10, depth_max: 12, error_rate: 0.1, aggressive_bias: 0.7 },
    },
    {
      id: 'gulu', name: '咕噜', rating: 1450,
      engine_params: { depth_min: 11, depth_max: 13, error_rate: 0.08, prefer_traps: true, trap_frequency: 0.3, positional_play: true },
    },
    {
      id: 'yunduoshifu', name: '云朵师父', rating: 1550,
      engine_params: { depth_min: 12, depth_max: 14, error_rate: 0.05, positional_bias: 0.8, adaptive_style: true },
    },
  ];

  it('所有 9 个角色都应能成功构建配置', () => {
    for (const char of characters) {
      const config = buildCharacterConfigFromJSON(char);
      expect(config.id).toBe(char.id);
      expect(config.rating).toBe(char.rating);
      expect(config.depthMin).toBeGreaterThanOrEqual(1);
      expect(config.depthMax).toBeGreaterThan(config.depthMin);
      expect(config.errorRate).toBeGreaterThanOrEqual(0);
      expect(config.errorRate).toBeLessThanOrEqual(1);
      expect(config.playStyleParams).toBeDefined();
    }
  });

  it('Rating 递增：每个后续角色 Rating 应更高', () => {
    const configs = characters.map((c) => buildCharacterConfigFromJSON(c));
    for (let i = 1; i < configs.length; i++) {
      expect(configs[i].rating).toBeGreaterThan(configs[i - 1].rating);
    }
  });

  it('深度递增：高级角色搜索深度更大', () => {
    const configs = characters.map((c) => buildCharacterConfigFromJSON(c));
    for (let i = 1; i < configs.length; i++) {
      expect(configs[i].depthMin).toBeGreaterThanOrEqual(configs[i - 1].depthMin);
    }
  });

  it('失误率递减：高级角色失误更少', () => {
    const configs = characters.map((c) => buildCharacterConfigFromJSON(c));
    for (let i = 1; i < configs.length; i++) {
      expect(configs[i].errorRate).toBeLessThanOrEqual(configs[i - 1].errorRate);
    }
  });

  it('棋风各不相同：styleWeights 不应完全相同', () => {
    const configs = characters.map((c) => buildCharacterConfigFromJSON(c));
    // 将 styleWeights 转为字符串比较
    const weightStrings = configs.map(
      (c) =>
        `${c.styleWeights.attack.toFixed(2)}-${c.styleWeights.defense.toFixed(2)}-${c.styleWeights.tactics.toFixed(2)}-${c.styleWeights.positional.toFixed(2)}`,
    );

    // 至少应有 5 种不同的棋风分布
    const unique = new Set(weightStrings);
    expect(unique.size).toBeGreaterThanOrEqual(5);
  });
});
