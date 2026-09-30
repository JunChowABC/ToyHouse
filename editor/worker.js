import M from '../src/mechanics.js';
import G from '../src/mechanic-generator.js';
self.onmessage = ({ data }) => {
  try {
    if (data.type === 'analyze') self.postMessage({ result: M.analyze(data.board, { shift: true, maxNodes: data.maxNodes }) });
    else {
      const candidates = [];
      for (let attempt = 0; attempt < (data.type === 'optimize' ? 5 : 3); attempt++) {
        try {
          const config = G.generate(data.config, { levelNo: Math.max(21, data.config.level_no), seed: data.seed + attempt * 7919, pool: data.pool, maxNodes: Math.min(1500, data.maxNodes) });
          const report = M.analyze(M.fromConfig(config), { shift: false, maxNodes: data.maxNodes });
          const targetExit = { EASY: 10, NORMAL: 8, HARD: 5 }[data.difficulty];
          const targetCascade = { LOW: 2, MEDIUM: 5, HIGH: 9 }[data.cascade];
          candidates.push({ config, report, score: Math.abs(report.initialExitCount - targetExit) + Math.abs(report.maxCascade - targetCascade) });
        } catch { /* Invalid embedding is rejected, never published as a fallback. */ }
      }
      candidates.sort((a, b) => a.score - b.score);
      if (!candidates.length) throw new Error('没有找到满足硬约束的候选，请更换种子或减少机制。');
      const winner = candidates[0];
      // Targets are recorded separately: a closest candidate is never labeled a match.
      winner.config.generation_targets = { difficulty: data.difficulty, cascade: data.cascade, score: winner.score, exactMatch: winner.score === 0 };
      self.postMessage({ result: winner });
    }
  } catch (error) { self.postMessage({ error: error.message }); }
};
