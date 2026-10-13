"""Inspect locally generated v1.2.0 print samples using the existing PDF reader."""
import json
import math
import os
import subprocess
from pathlib import Path
from pypdf import PdfReader

root = Path(__file__).resolve().parent.parent
notice = 'Checked means staff verified this action on site. It is not a safety rating.'
legend_terms = ('Checked on site:', 'Planned:', 'Not done:')
results = []
source_commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
requested_source = os.environ.get('ROOT_SOURCE_COMMIT', '').strip()
if requested_source and requested_source != source_commit:
    raise SystemExit(f'ROOT_SOURCE_COMMIT {requested_source} does not match HEAD {source_commit}')

def text_and_sizes(page):
    chunks = []
    sizes = []
    def visit(value, matrix, text_matrix, font, font_size):
        if value.strip():
            size = font_size * math.hypot(matrix[0], matrix[1])
            chunks.append((value, size))
            sizes.append(size)
    page.extract_text(visitor_text=visit)
    return ' '.join(page.extract_text().split()), chunks, sizes

def merged_chunks(chunks):
    """Join PDF text fragments that share a font size for semantic font checks."""
    merged = []
    for value, size in chunks:
        if merged and abs(merged[-1][1] - size) < 0.02:
            merged[-1] = (merged[-1][0] + value, merged[-1][1])
        else:
            merged.append((value, size))
    return [(' '.join(value.split()), size) for value, size in merged]

def includes(value, phrase):
    return ''.join(value.split()).lower().find(''.join(phrase.split()).lower()) >= 0

def assert_page(path, expected_size, minimum, require_multipage=False):
    reader = PdfReader(path)
    assert len(reader.pages) > 1 if require_multipage else len(reader.pages) >= 1, (path.name, 'page count')
    pages = []
    for number, page in enumerate(reader.pages, 1):
        size = (float(page.mediabox.width), float(page.mediabox.height))
        assert size == expected_size, (path.name, number, size)
        text, chunks, sizes = text_and_sizes(page)
        banner_count = text.count('Demonstration: synthetic data')
        heading_count = text.count('Safety actions at this station')
        notice_count = text.count(notice)
        assert banner_count == 1, (path.name, number, 'banner', banner_count)
        assert heading_count == 1, (path.name, number, 'heading', heading_count)
        assert notice_count >= 2, (path.name, number, 'notice repeated', notice_count)
        assert 'Tell us how safe you feel' in text, (path.name, number, 'footer invitation')
        assert all(term in text for term in legend_terms), (path.name, number, 'legend')
        assert 'UTC' not in text, (path.name, number, 'zone')
        effective_minimum = min(sizes)
        assert effective_minimum >= minimum - 0.02, (path.name, number, effective_minimum, minimum)
        runs = merged_chunks(chunks)
        notice_sizes = [s for value, s in runs if includes(value, notice)]
        legend_sizes = [s for value, s in runs if any(includes(value, term) for term in legend_terms)]
        if minimum >= 18:
            assert notice_sizes and max(notice_sizes) >= 24 - 0.02, (path.name, number, 'notice size', notice_sizes)
            assert legend_sizes and min(legend_sizes) >= 24 - 0.02, (path.name, number, 'legend size', legend_sizes)
        pages.append({'page': number, 'banner_count': banner_count, 'heading_count': heading_count,
                      'notice_count': notice_count, 'legend': True,
                      'minimum_text_pt': round(effective_minimum, 2),
                      'notice_text_pt': round(max(notice_sizes), 2) if notice_sizes else None,
                      'legend_text_pt': round(min(legend_sizes), 2) if legend_sizes else None})
    return {'file': str(path.relative_to(root)), 'page_size_pt': expected_size, 'pages': pages}

for name, size, minimum, multi in [
    ('board-letter-print', (612, 792), 13, False),
    ('board-tabloid-print', (1224, 792), 18, False),
]:
    results.append(assert_page(root / 'evidence' / f'v1.2.0-{name}.pdf', size, minimum, multi))

# Multipage stress files are optional when the final seeded board fits on one page,
# but if the browser harness generated them, each page must retain the table header
# and footer semantics and the same size guarantees.
for name, size, minimum in [
    ('board-letter-multipage', (612, 792), 13),
    ('board-tabloid-multipage', (1224, 792), 18),
]:
    path = root / 'evidence' / f'v1.2.0-{name}.pdf'
    if path.exists():
        results.append(assert_page(path, size, minimum, True))

card_path = root / 'evidence' / 'v1.2.0-card-print.pdf'
card = PdfReader(card_path)
assert 1 <= len(card.pages) <= 2, ('card page count', len(card.pages))
card_pages = []
card_text = []
for number, page in enumerate(card.pages, 1):
    text, chunks, sizes = text_and_sizes(page)
    card_text.append(text)
    assert min(sizes) >= 12 - 0.02, ('card effective text size', number, min(sizes))
    card_pages.append({'page': number, 'minimum_text_pt': round(min(sizes), 2)})
card_all_text = ' '.join(card_text)
assert 'How safe do you feel at this station?' in card_all_text
assert all(f'{q}.' in card_all_text for q in range(1, 7)), 'card questions'

receipt = {'passed': True, 'source_commit': source_commit, 'final_run': bool(requested_source), 'card_pages': card_pages, 'boards': results}
(root / 'evidence' / 'v1.2.0-print-results.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(f'PASS: {sum(len(r["pages"]) for r in results)} board pages retain the exact notice, legend, footer and required type sizes. Rider card: {len(card.pages)} page(s).')
