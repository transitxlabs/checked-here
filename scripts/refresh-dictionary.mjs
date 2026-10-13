import {writeFileSync} from 'node:fs';
import {dictionaryCSV,dictionaryMarkdown} from '../js/core.mjs';
writeFileSync(new URL('../data-dictionary.csv',import.meta.url),dictionaryCSV());
writeFileSync(new URL('../DATA_DICTIONARY.md',import.meta.url),dictionaryMarkdown());
