import en from './locales/en.mjs';
import * as core from './core.mjs';

const reasons = core.REASONS ?? [];
const answers = core.ANSWERS ?? ['yes', 'no', 'not-sure'];
const boardAnswers = core.BOARD_ANSWERS ?? ['yes', 'yes-unread', 'no', 'not-sure'];
const checked = core.CHECKED ?? ['on-site', 'rated-safe', 'not-sure'];

function labels(values, locale, overrides = {}) {
  return values.map(value => ({value, label: overrides[value] ?? locale[String(value).replaceAll('-', '_')] ?? String(value)}));
}

export function questionSource(locale = en) {
  return [
    {key: 'safety', number: 1, prompt: locale.safety, type: 'scale', choices: labels([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], locale), hint: locale.safetyScale, optional: true},
    {key: 'reasons', number: 2, prompt: locale.reasons, type: 'multiple', choices: labels(reasons, locale), hint: locale.reasonsHint ?? locale.optionalHint, optional: true},
    {key: 'knows_help', number: 3, prompt: locale.knows_help, type: 'choice', choices: labels(answers, locale, {yes: locale.yes_simple}), optional: true},
    {key: 'noticed_board', number: 4, prompt: locale.noticed_board, type: 'choice', choices: labels(boardAnswers, locale), optional: true},
    {key: 'trust', number: 5, prompt: locale.trust, type: 'scale', choices: labels([1, 2, 3, 4, 5], locale), hint: locale.trustScale, conditional: true, optional: true},
    {key: 'checked_meaning', number: 6, prompt: locale.checked_meaning, type: 'choice', choices: labels(['rated-safe', ...checked.filter(value => value !== 'rated-safe')], locale), conditional: true, optional: true}
  ];
}
