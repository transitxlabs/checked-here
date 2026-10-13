// Faults are planted only in disposable local copies, never in the delivered source.
export default [
 ['V01','js/core.mjs',"if (!STATIONS.includes(r.station))","if (false)"],
 ['V02','js/core.mjs','r.safety > 10','r.safety > 11'],
 ['V03','js/core.mjs','r.reasons.length > 3','r.reasons.length > 4'],
 ['V04','js/core.mjs','s <= now','true'],
 ['V05','js/core.mjs',"if (staff && existing.some(x => cardKey(x) === cardKey(r)))","if (false)"],
 ['V06','js/core.mjs',"if (!staff && (r.round !== null || r.staff_code !== null || r.card_number !== null))","if (false)"],
 ['V07','js/core.mjs','if (r.refusals > r.asks)','if (false)'],
 ['Q01','js/core.mjs',"r.source === 'staff' && r.station === station && r.round === round","r.station === station && r.round === round"],
 ['Q02','js/core.mjs',"r.source === 'rider-link' && r.station === station","r.station === station"],
 ['E01','js/core.mjs','Number(r.reasons.includes(c.slice(7)))','0'],
 ['E02','js/core.mjs',"s.replaceAll('\"','\"\"')","s"],
 ['E03','js/core.mjs','schema_version:1,checkins,shifts','schema_version:2,checkins,shifts'],
 ['D01','js/core.mjs',"['checkins',COLUMNS]","['checkins',COLUMNS.slice(1)]"],
 ['I01','js/core.mjs','result.duplicates++; continue;','continue;'],
 ['I02','js/core.mjs',"throw Error('conflict');","continue;"],
 ['I03','js/core.mjs','bundle.schema_version !== 1','false'],
 ['S01','js/core.mjs','card_number<=75','card_number<=74'],
 ['L01','js/locales/second.mjs','"title": "translation pending",',''],
 ['O01','sw.js',"'./js/storage.mjs',",'']
];
