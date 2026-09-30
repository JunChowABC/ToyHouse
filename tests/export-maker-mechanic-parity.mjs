import { writeFile } from 'node:fs/promises';
import CONFIG from '../src/level-config.js';
import M from '../src/mechanics.js';
const normalize = b => ({ randomState: b.randomState, entities: [...b.toys, ...b.entities].map(t => ({ id: t.id, state: t.state,
  x: t.x, y: t.y, direction: t.direction || null, cells: t.cells.map(c => [c.x, c.y]),
  sleeping: !!t.sleeping, sleepRemaining: t.sleepRemaining || 0, hugLocked: !!t.hugLocked, pairId: t.pairId || null,
  ice: t.ice || 0, hp: t.hp ?? null, exitCounted: !!t.exitCounted })) });
const cases=[];
for(const config of CONFIG.levels.filter(l=>l.imported_v22)) {
 const b=M.fromConfig(config), steps=[];
 for(let i=0;i<18;i++) {
  const choices=b.toys.filter(M.manual).filter(t=>{const p=M.scan(b,t);return p.emptySteps||p.exitsBoard||p.blockerId});
  if(!choices.length)break;
  const id=choices[(i*7)%choices.length].id;M.click(b,id);steps.push({id,expected:normalize(b)});
 }
 cases.push({config,initial:normalize(M.fromConfig(config)),steps});
}
await writeFile('output/maker-current-release/parity.json',JSON.stringify(cases));
console.log('Exported 197 Web/Lua comparisons and sampled state transitions');
