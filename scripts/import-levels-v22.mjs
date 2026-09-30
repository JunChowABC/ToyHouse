import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import M from '../src/mechanics.js';

export async function importLevelsV22({ applyOverrides = true } = {}) {
  const source = '晚安玩具屋_4-200关关卡配置_V2.2_弹簧滑行版.json';
  const raw = await readFile(new URL(`../${source}`, import.meta.url), 'utf8');
  const authored = JSON.parse(raw);
  if (authored.generated_config_version !== '2.2' || authored.levels.length !== 197) throw new Error('Expected V2.2 levels 4–200');
  const vectors = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] };
  const levels = authored.levels.map((l, index) => {
    if (l.level_id !== index + 4) throw new Error('Non-contiguous authored levels');
    const toy_list = l.toys.map(t => {
      const [dx, dy] = vectors[t.direction] || [0, 0];
      const x = t.grid_position.x + Math.min(0, dx * (t.length - 1));
      const y = t.grid_position.y + Math.min(0, dy * (t.length - 1));
      const entry = { toy_id: t.id, archetype_id: t.archetype, skin_id: t.skin_id,
        direction: t.archetype === 'AUTO_EXIT' ? null : t.direction, footprint: dx ? [t.length, 1] : [1, t.length], grid_position: [x, y] };
      for (const m of t.modifiers) {
        if (m.type === 'HUG_LEADER') entry.pair_id = m.pair_id;
        else {
          if (entry.modifier) throw new Error(`${t.id}: unsupported stacked modifiers`);
          entry.modifier = m.type;
          if (m.type === 'SLEEPING') entry.wake_after_exits = m.remaining_exit_count;
          else if (m.type === 'FROZEN') entry.ice_layers = m.remaining_hits;
          else if (m.type === 'KEY_CARRIER') entry.key_id = m.key_id;
          else if (m.type === 'HUG_LOCKED') {
            entry.pair_id = m.pair_id;
            entry.hug_source = l.relations.find(r => r.id === m.pair_id && r.locked_toy_id === t.id)?.leader_toy_id;
            if (!entry.hug_source) throw new Error(`${t.id}: missing hug leader`);
          } else throw new Error(`${t.id}: unknown modifier ${m.type}`);
        }
      }
      return entry;
    });
    const board_entities = l.board_entities.map(e => ({ entity_id: e.id,
      kind: e.type === 'SPRING_TOY' ? 'SPRING' : e.type,
      grid_position: [e.grid_position.x, e.grid_position.y],
      footprint: [e.footprint?.width || 1, e.footprint?.height || 1],
      direction: e.direction, pair_id: e.pair_id, key_id: e.key_id,
      ...(e.type === 'SPRING_TOY' ? { own_direction: true, counts_toward_level_clear: true } : {}),
      ...(e.type === 'BOX' ? { hp: e.rule.required_exit_count, max_hp: 4 } : {}) }));
    const level = { schema_version: '1.4', level_id: `L${String(l.level_id).padStart(3, '0')}`,
      level_no: l.level_id, chapter_id: l.night_id, level_name: l.level_name,
      board_width: l.board.width, board_height: l.board.height, difficulty: l.difficulty,
      cascade_strength: l.recipe_targets.cascade_level, archetype_skin_map: l.archetype_skin_map,
      toy_list, board_entities, mechanic_pool: l.mechanic_types, relations: l.relations,
      clearance_policy: l.clearance_policy, portal_randomization: 'UNIFORM_VALID_SIDE_THEN_TRACK',
      validation: l.validation, generator: { source, version: '2.2', seed: l.level_id },
      imported_v22: true };
    const errors = M.validate(M.fromConfig(level));
    if (errors.length) throw new Error(`${level.level_id}: ${errors.join(', ')}`);
    return level;
  });
  if (applyOverrides) {
    const overrides = JSON.parse(await readFile(new URL('../config/initial-duck-blocks-v22.json', import.meta.url), 'utf8'));
    for (const fix of overrides.fixes) {
      const level = levels.find(l => l.level_no === fix.level_no);
      for (const change of fix.changes) {
        const toy = level.toy_list.find(t => t.toy_id === change.toy_id);
        if (!toy || JSON.stringify(toy.grid_position) !== JSON.stringify(change.from)) throw new Error(`Stale duck layout override: ${change.toy_id}`);
        toy.grid_position = [...change.to];
      }
      level.layout_overrides = fix.changes;
    }
    for (const level of levels) {
      const board = M.fromConfig(level), errors = M.validate(board);
      if (errors.length || board.toys.some(t => t.archetypeId === 'AUTO_EXIT' && M.duckPath(board, t))) throw new Error(`${level.level_id}: invalid initial duck blockage: ${errors}`);
      level.validation = { ...level.validation, initial_auto_duck_ready: 0, runtime_initial_duck_path_check: 'PASS',
        runtime_initial_manual_exit_actual: board.toys.filter(t => M.manual(t) && M.scan(board, t).exitsBoard).length };
    }
  }
  return { levels, provenance: { source, sha256: createHash('sha256').update(raw).digest('hex'), version: '2.2', solver_status: 'NOT_CHECKED', box_override: 'USER_CONFIRMED_COLLISION_DAMAGE; threshold mapped to hit count', layout_overrides: applyOverrides ? 'config/initial-duck-blocks-v22.json' : null } };
}
