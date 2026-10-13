import en from './locales/en.mjs';
import {questionSource} from './questions.mjs';
import {escape} from './board.mjs';

function errorHTML(key) {
  return `<p class="error" id="error-${escape(key)}" hidden></p>`;
}

function radioScale(question, description) {
  return `<div class="scale-options" role="radiogroup" aria-labelledby="question-${escape(question.key)}">${question.choices.map(choice => `<label class="scale-choice" for="${escape(question.key)}-${escape(choice.value)}"><input id="${escape(question.key)}-${escape(choice.value)}" name="${escape(question.key)}" type="radio" value="${escape(choice.value)}" aria-describedby="${description}"><span>${escape(choice.label)}</span></label>`).join('')}</div>`;
}

function choiceControl(question, locale, description) {
  const key = question.key;
  if (question.type === 'scale') {
    if (key === 'safety' && question.staff) return `<input name="${escape(key)}" id="${escape(key)}" type="number" min="1" max="10" step="1" inputmode="numeric" aria-labelledby="question-${escape(key)}" aria-describedby="${description}">`;
    return radioScale(question, description);
  }
  if (question.type === 'multiple') {
    return question.choices.map(choice => `<label class="check" for="${escape(key)}-${escape(choice.value)}"><input id="${escape(key)}-${escape(choice.value)}" type="checkbox" name="${escape(key)}" value="${escape(choice.value)}" aria-describedby="${description}"><span>${escape(choice.label)}</span></label>`).join('');
  }
  return `<select name="${escape(key)}" id="${escape(key)}" aria-describedby="${description}"><option value="">${escape(locale.choose)}</option>${question.choices.map(choice => `<option value="${escape(choice.value)}">${escape(choice.label)}</option>`).join('')}</select>`;
}

export function questionsHTML(staff, locale = en) {
  const question = source => {
    const description = `error-${source.key}${source.hint ? ` hint-${source.key}` : ''}`;
    const hint = source.hint ? `<p class="hint" id="hint-${escape(source.key)}">${escape(source.hint)}</p>` : '';
    const optional = `<p class="hint optional-hint">${escape(locale.optionalHint)}</p>`;
    if (source.type === 'choice') return `<div class="question question-choice${source.conditional ? ' conditional-question' : ''}" data-question="${source.number}"><label for="${escape(source.key)}" id="question-${escape(source.key)}">${source.number}. ${escape(source.prompt)}</label>${hint}${optional}${choiceControl({...source, staff}, locale, description)}${errorHTML(source.key)}</div>`;
    return `<fieldset data-question="${source.number}"${source.conditional ? ' class="conditional-question"' : ''}><legend id="question-${escape(source.key)}">${source.number}. ${escape(source.prompt)}</legend>${hint}${optional}${choiceControl({...source, staff}, locale, description)}${errorHTML(source.key)}</fieldset>`;
  };
  const help = staff ? '' : `<div class="form-help"><h3>${escape(locale.needHelp)}</h3><p>${escape(locale.cardUrgent)}</p><p>${escape(locale.riderHelp)}</p></div>`;
  const questions = questionSource(locale);
  const normal = questions.filter(source => !source.conditional).map(question).join('');
  const conditional = questions.filter(source => source.conditional).map(question).join('');
  return `${help}<p class="collection-notice">${escape(locale.notice)}</p>${normal}<div id="conditional-questions" hidden><p>${escape(locale.conditionalHint)}</p>${conditional}</div>`;
}

function controlValue(control) {
  if (!control) return '';
  return typeof control.value === 'string' ? control.value : '';
}

function clearControl(control) {
  if (!control) return;
  if (typeof control.length === 'number' && !('disabled' in control)) {
    for (const item of control) { item.checked = false; item.disabled = true; item.required = false; item.removeAttribute?.('aria-invalid'); }
  } else {
    control.value = '';
    control.disabled = true;
    control.required = false;
    control.removeAttribute?.('aria-invalid');
  }
}

function enableControl(control) {
  if (!control) return;
  if (typeof control.length === 'number' && !('disabled' in control)) {
    for (const item of control) { item.disabled = false; item.required = false; }
  } else {
    control.disabled = false;
    control.required = false;
  }
}

export function updateConditionalQuestions(form) {
  if (!form) return;
  const noticed = controlValue(form.elements?.noticed_board);
  const asked = noticed === 'yes';
  const section = form.querySelector('#conditional-questions');
  if (section) section.hidden = !asked;
  for (const key of ['trust', 'checked_meaning']) {
    const control = form.elements?.[key];
    if (asked) enableControl(control); else clearControl(control);
    const error = form.querySelector(`#error-${key}`);
    if (!asked && error) { error.hidden = true; error.textContent = ''; }
  }
}

export function conditionalAnswers(noticedBoard, trust, checkedMeaning) {
  if (noticedBoard !== 'yes') return {trust: null, checked_meaning: null};
  return {trust: trust === '' || trust === undefined || trust === null ? null : trust, checked_meaning: checkedMeaning || null};
}
