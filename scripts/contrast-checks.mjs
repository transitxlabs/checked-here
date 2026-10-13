import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
const blocks=[['light',css.match(/:root\s*\{([^}]+)\}/)[1]],['dark',css.match(/@media \(prefers-color-scheme:dark\)\s*\{\s*:root\s*\{([^}]+)\}/)[1]]];
const luminance=hex=>{if(hex.length===4)hex='#'+hex.slice(1).split('').map(s=>s+s).join('');const channels=hex.slice(1).match(/../g).map(s=>parseInt(s,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*channels[0]+.7152*channels[1]+.0722*channels[2];};
const ratio=(a,b)=>{const values=[luminance(a),luminance(b)].sort((x,y)=>y-x);return (values[0]+.05)/(values[1]+.05);};
const pairs=[['ink','surface'],['ink','paper'],['ink','soft'],['muted','surface'],['muted','paper'],['muted','soft'],['accent','surface'],['on-accent','accent'],['error','surface'],['error','paper'],['on-accent','error'],['paper','ink']];
const results=[];
for(const [scheme,block] of blocks){const colours=Object.fromEntries([...block.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{3,6})/gi)].map(m=>[m[1],m[2]]));for(const [foreground,background] of pairs){const measured=ratio(colours[foreground],colours[background]);results.push({scheme,foreground,background,foregroundColour:colours[foreground],backgroundColour:colours[background],ratio:Number(measured.toFixed(3)),passes:measured>=4.5});assert.ok(measured>=4.5,`${scheme} ${foreground}/${background}: ${measured}`);}}
writeFileSync(new URL('../evidence/v1.1-contrast-results.json',import.meta.url),JSON.stringify(results,null,2)+'\n');
process.stdout.write(`${results.length} text colour pairs pass 4.5:1 in light and dark schemes. Minimum: ${Math.min(...results.map(r=>r.ratio))}:1.\n`);
