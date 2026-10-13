import en from './locales/en.mjs';
import {REASONS,ANSWERS,CHECKED} from './core.mjs';
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export function questionsHTML(staff,locale=en) {
  const error=k=>`<p class="error" id="error-${k}" hidden></p>`;
  const question=(k,content)=>`<fieldset><legend>${escape(locale[k])}</legend>${content}${error(k)}</fieldset>`;
  const select=(k,values)=>question(k,`<select name="${k}" id="${k}" aria-label="${escape(locale[k])}" aria-describedby="error-${k}"><option value="">${escape(locale.choose)}</option>${values.map(v=>`<option value="${v}">${escape(locale[String(v).replaceAll('-','_')]??v)}</option>`).join('')}</select>`);
  const help=staff?'':`<p>${escape(locale.riderHelp)}</p><p>${escape(locale.riderUrgent)}</p>`;
  return `${help}${question('safety',`<input name="safety" id="safety" type="number" min="1" max="10" step="1" aria-label="${escape(locale.safety)}" aria-describedby="error-safety">`)}${question('reasons',REASONS.map(r=>`<label class="check"><input type="checkbox" name="reasons" value="${r}" aria-describedby="error-reasons">${escape(locale[r])}</label>`).join(''))}${select('knows_help',ANSWERS)}${select('noticed_board',ANSWERS)}<div id="conditional-questions" hidden><p>${escape(locale.conditionalHint)}</p>${select('trust',[1,2,3,4,5,'no-opinion'])}${select('checked_meaning',CHECKED)}</div>`;
}
export function updateConditionalQuestions(form) {
  const asked=form.elements.noticed_board.value==='yes';
  form.querySelector('#conditional-questions').hidden=!asked;
  for(const k of ['trust','checked_meaning']) {
    const control=form.elements[k];
    control.disabled=!asked; control.required=asked;
    if(!asked) {
      control.value=''; control.removeAttribute('aria-invalid');
      const error=form.querySelector(`#error-${k}`);error.hidden=true;error.textContent='';
    }
  }
}
export function conditionalAnswers(noticed_board,trust,checked_meaning) {
  return {trust:noticed_board==='yes'?trust:null,checked_meaning:noticed_board==='yes'?checked_meaning:null};
}
