import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
const blocks=[['light',css.match(/:root\s*\{([^}]+)\}/)[1]],['dark',css.match(/@media \(prefers-color-scheme:dark\)\s*\{\s*:root\s*\{([^}]+)\}/)[1]]];
const luminance=hex=>{if(hex.length===4)hex='#'+hex.slice(1).split('').map(s=>s+s).join('');const channels=hex.slice(1).match(/../g).map(s=>parseInt(s,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*channels[0]+.7152*channels[1]+.0722*channels[2];};
const ratio=(a,b)=>{const values=[luminance(a),luminance(b)].sort((x,y)=>y-x);return (values[0]+.05)/(values[1]+.05);};
const pairs=[['ink','surface',4.5],['ink','paper',4.5],['ink','soft',4.5],['muted','surface',4.5],['muted','paper',4.5],['muted','soft',4.5],['accent','surface',4.5],['on-accent','accent',4.5],['error','surface',4.5],['error','paper',4.5],['on-accent','error',4.5],['paper','ink',4.5],['line','surface',3],['line','paper',3]];
const results=[];
for(const [scheme,block] of blocks){const colours=Object.fromEntries([...block.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{3,6})/gi)].map(m=>[m[1],m[2]]));for(const [foreground,background,minimum] of pairs){assert.ok(colours[foreground]&&colours[background],`${scheme}: missing colour variable ${foreground} or ${background}`);const measured=ratio(colours[foreground],colours[background]);results.push({scheme,foreground,background,minimum,foregroundColour:colours[foreground],backgroundColour:colours[background],ratio:Number(measured.toFixed(3)),passes:measured>=minimum});assert.ok(measured>=minimum,`${scheme} ${foreground}/${background}: ${measured} (required ${minimum})`);}}
writeFileSync(new URL('../evidence/v1.2.0-contrast-results.json',import.meta.url),JSON.stringify(results,null,2)+'\n');
const textResults=results.filter(r=>r.minimum===4.5),borderResults=results.filter(r=>r.minimum===3);
process.stdout.write(`${textResults.length} text colour pairs pass 4.5:1 and ${borderResults.length} control border pairs pass 3:1 in light and dark schemes. Minimum text: ${Math.min(...textResults.map(r=>r.ratio))}:1; minimum border: ${Math.min(...borderResults.map(r=>r.ratio))}:1.\n`);
