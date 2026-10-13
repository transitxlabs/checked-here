"""Inspect the locally generated print samples using an existing PDF reader."""
import json
import math
from pathlib import Path
from pypdf import PdfReader

root = Path(__file__).resolve().parent.parent
notice = 'Checked means staff checked this action on site. It is not a safety rating.'
invitation = 'Tell us how safe you feel: [rider form link or code goes here]'
results = []
for name, size, minimum, multi in [
    ('board-letter-print', (612, 792), 13, False),
    ('board-tabloid-print', (1224, 792), 18, False),
    ('board-letter-multipage', (612, 792), 13, True),
    ('board-tabloid-multipage', (1224, 792), 18, True),
]:
    path = root / 'evidence' / f'v1.1-{name}.pdf'
    reader = PdfReader(path)
    assert len(reader.pages) > 1 if multi else len(reader.pages) == 1
    pages = []
    for number, page in enumerate(reader.pages, 1):
        assert (float(page.mediabox.width), float(page.mediabox.height)) == size
        text = ' '.join(page.extract_text().split())
        assert text.count('Demonstration: synthetic data') == 1, (name, number, 'banner')
        assert text.count('Safety actions at this station') == 1, (name, number, 'heading')
        assert notice in text, (name, number, 'notice')
        assert invitation in text, (name, number, 'invitation')
        assert 'UTC' not in text
        sizes = []
        def visit(value, matrix, text_matrix, font, font_size):
            if value.strip():
                sizes.append(font_size * math.hypot(matrix[0], matrix[1]))
        page.extract_text(visitor_text=visit)
        effective_minimum = min(sizes)
        assert effective_minimum >= minimum - 0.02, (name, number, effective_minimum)
        pages.append({'page': number, 'banner_count': 1, 'heading_count': 1,
                      'notice': True, 'invitation': True,
                      'minimum_text_pt': round(effective_minimum, 2)})
    results.append({'file': str(path.relative_to(root)), 'page_size_pt': size, 'pages': pages})
card = PdfReader(root / 'evidence' / 'v1.1-card-print.pdf')
assert len(card.pages) == 1
assert 'Demonstration: synthetic data' in card.pages[0].extract_text()
receipt = {'passed': True, 'card_pages': 1, 'boards': results}
(root / 'evidence' / 'v1.1-print-results.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(f'PASS: {sum(len(r["pages"]) for r in results)} board pages retain one banner, a heading, both footer lines and the required type size. Rider card: 1 page.')
