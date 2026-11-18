// Forge progression: atomic purchases, capped tiers, and explicit unlock reasons.
export const RECIPES={
  blade:{name:'Tempered blade',desc:'+14 strike damage per tier',max:3,cost:{stone:6,iron:2,essence:3}},
  tools:{name:'Harvest tools',desc:'+1 resource per node per tier',max:2,cost:{wood:6,stone:5,iron:1}},
  masonry:{name:'Reinforced defenses',desc:'+50% structure health per tier',max:2,cost:{stone:10,iron:2,essence:4}},
  tonic:{name:'Healing tonic',desc:'Restore 45 health immediately',max:Infinity,cost:{essence:3,fiber:1}},
  ward:{name:'Dusk ward',desc:'Permanent +12% player damage',max:2,cost:{iron:3,essence:5,fiber:2}},
};
export function createCrafting(G,player,buildings) {
  const levels={blade:0,tools:0,masonry:0,ward:0};
  function offer(id) {
    const r=RECIPES[id];if(!r)return null;
    const level=levels[id]||0,cost=Object.fromEntries(Object.entries(r.cost).map(([k,v])=>[k,v*(id==='tonic'?1:level+1)]));
    const reason=level>=r.max?'Mastered':id==='tonic'&&player.state.hp>=100?'Health full':id!=='tonic'&&level>G.night?'Unlocks after night '+level:'';
    return {...r,level,cost,reason,affordable:Object.entries(cost).every(([k,v])=>(G.resources[k]||0)>=v)};
  }
  function buy(id) {
    const o=offer(id);if(!o)return {ok:false,message:'Unknown recipe'};
    if(o.reason)return {ok:false,message:o.reason};
    if(!o.affordable)return {ok:false,message:'Gather more materials'};
    for(const [k,v] of Object.entries(o.cost))G.resources[k]=(G.resources[k]||0)-v;
    if(id==='tonic')player.heal(45);
    else { levels[id]++; if(id==='masonry') for(const s of buildings.structures)if(s.alive){const bonus=s.def.hp*.5;s.maxHp+=bonus;s.hp+=bonus;} }
    return {ok:true,message:o.name+(id==='tonic'?' used':' crafted · Tier '+levels[id])};
  }
  return {levels,offer,buy};
}
