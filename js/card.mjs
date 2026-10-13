import en from './locales/en.mjs';
import {questionSource} from './questions.mjs';
import {escape} from './board.mjs';

const scaleKeys = new Set(['safety', 'trust']);

function paperChoice(question, choice) {
  const number = scaleKeys.has(question.key) && typeof choice.value === 'number';
  return `<span class="paper-option">${number ? `<span class="paper-number" aria-hidden="true">${escape(choice.label)}</span>` : `<span class="paper-tick" aria-hidden="true"></span>${escape(choice.label)}`}</span>`;
}

function paperQuestion(question, locale) {
  const choices = question.choices.map(choice => paperChoice(question, choice)).join('');
  return `<section class="card-question" data-question="${question.number}"><h3>${question.number}. ${escape(question.prompt)}</h3><div class="paper-options ${question.key === 'reasons' ? 'paper-reasons' : ''} ${scaleKeys.has(question.key) ? 'paper-scale' : ''}">${choices}</div>${question.hint ? `<p class="card-scale-hint">${escape(question.hint)}</p>` : ''}</section>`;
}

function staffOnly(locale) {
  const fields = ['station', 'round', 'date', 'time_band', 'staff_code', 'card_number'];
  return `<section class="paper-staff" aria-label="${escape(locale.staffOnly)}" aria-describedby="staff-distribution-hint"><h3>${escape(locale.staffOnly)}</h3><p id="staff-distribution-hint">${escape(locale.staffDistributionHint)}</p><div class="paper-staff-fields">${fields.map(key => `<span>${escape(locale[key === 'card_number' ? 'cardNumberPrint' : key])}<span class="blank-line" aria-hidden="true"></span></span>`).join('')}</div></section>`;
}

export function printableCardHTML(locale = en) {
  const questions = questionSource(locale);
  const firstSide = questions.filter(question => question.number <= 3).map(question => paperQuestion(question, locale)).join('');
  const secondQuestions = questions.filter(question => question.number > 3);
  const secondSide = secondQuestions.map(question => `${question.number === 5 ? `<p class="card-condition">${escape(locale.conditionalHint ?? '')}</p>` : ''}${paperQuestion(question, locale)}`).join('');
  return `<article class="rider-card print-surface" aria-label="${escape(locale.cardAria)}"><div class="card-side card-side-front"><p class="eyebrow">${escape(locale.cardSynthetic)}</p><p class="card-audience">${escape(locale.adultRiders)}</p><h2>${escape(locale.cardTitle)}</h2><p class="card-sub">${escape(locale.cardHeader)} ${escape(locale.cardInstructions)}</p><div class="card-help"><h3>${escape(locale.needHelp)}</h3><p>${escape(locale.cardUrgent)}</p><p>${escape(locale.riderHelp)}</p></div><p class="card-collection">${escape(locale.notice)}</p><p class="card-optional">${escape(locale.skipAnyQuestion ?? locale.optionalHint)}</p>${firstSide}<p class="card-turn">${escape(locale.turnOver)}</p></div><div class="card-side card-side-back">${secondSide}${staffOnly(locale)}</div></article><footer class="card-admin" aria-hidden="true">${escape(locale.cardFooter)}</footer>`;
}
