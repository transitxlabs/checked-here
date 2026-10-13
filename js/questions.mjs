import en from './locales/en.mjs';
import {REASONS,ANSWERS,CHECKED} from './core.mjs';
export function questionSource(locale=en) {
  const labels=values=>values.map(value=>({value,label:locale[String(value).replaceAll('-','_')]??String(value)}));
  return [
    {key:'safety',number:1,prompt:locale.safety,type:'scale',choices:labels([1,2,3,4,5,6,7,8,9,10]),hint:locale.safetyScale},
    {key:'reasons',number:2,prompt:locale.reasons,type:'multiple',choices:labels(REASONS)},
    {key:'knows_help',number:3,prompt:locale.knows_help,type:'choice',choices:labels(ANSWERS)},
    {key:'noticed_board',number:4,prompt:locale.noticed_board,type:'choice',choices:labels(ANSWERS)},
    {key:'trust',number:5,prompt:locale.trust,type:'choice',choices:labels([1,2,3,4,5,'no-opinion']),hint:locale.trustScale,conditional:true},
    {key:'checked_meaning',number:6,prompt:locale.checked_meaning,type:'choice',choices:labels(CHECKED),conditional:true}
  ];
}
