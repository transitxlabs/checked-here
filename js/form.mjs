import en from './locales/en.mjs';
import {questionSource} from './questions.mjs';
import {escape} from './board.mjs';
export function questionsHTML(staff,locale=en) {
  const error=k=>`<p class="error" id="error-${k}" hidden></p>`;
  const question=q=>{
    const k=q.key,description=`error-${k}${q.hint?` hint-${k}`:''}`;
    const controls=q.type==='scale'?`<input name="${k}" id="${k}" type="number" min="1" max="10" step="1" aria-label="${escape(q.prompt)}" aria-describedby="${description}">`:q.type==='multiple'?q.choices.map(c=>`<label class="check"><input id="reason-${c.value}" type="checkbox" name="${k}" value="${c.value}" aria-describedby="${description}">${escape(c.label)}</label>`).join(''):`<select name="${k}" id="${k}" aria-label="${escape(q.prompt)}" aria-describedby="${description}"><option value="">${escape(locale.choose)}</option>${q.choices.map(c=>`<option value="${c.value}">${escape(c.label)}</option>`).join('')}</select>`;
    return `<fieldset><legend>${q.number}. ${escape(q.prompt)}</legend>${q.hint?`<p class="hint" id="hint-${k}">${escape(q.hint)}</p>`:''}${controls}${error(k)}</fieldset>`;
  };
  const help=staff?'':`<div class="form-help"><strong>${escape(locale.needHelp)}</strong><p>${escape(locale.emergency)}</p><p>${escape(locale.riderHelp)}</p><p>${escape(locale.riderUrgent)}</p></div>`;
  const questions=questionSource(locale);
  return `${help}${questions.filter(q=>!q.conditional).map(question).join('')}<div id="conditional-questions" hidden><p>${escape(locale.conditionalHint)}</p>${questions.filter(q=>q.conditional).map(question).join('')}</div>`;
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
