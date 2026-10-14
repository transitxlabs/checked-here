"""Check final 1.2.1 board and rider-card PDFs using local pypdf only."""
import json
import math
import os
import re
import subprocess
import sys
from pathlib import Path
from pypdf import PdfReader

root = Path(__file__).resolve().parent.parent
work_root = Path(os.environ.get("TRANSITX_WORK_ROOT", str(root / ".work")))
evidence = Path(os.environ.get("EVIDENCE_DIR", str(work_root / "evidence")))
log_dir = Path(os.environ.get("LOG_DIR", str(work_root / "logs")))
discarded = evidence / "intermediate"
evidence.mkdir(parents=True, exist_ok=True)
log_dir.mkdir(parents=True, exist_ok=True)
discarded.mkdir(parents=True, exist_ok=True)
notice = "Checked means staff verified this action on site. It is not a safety rating."


def disk_guard(label):
    output = subprocess.check_output(["df", "-g", "/"], text=True)
    row = output.strip().splitlines()[-1].split()
    free = float(row[3])
    if free < 49:
        raise SystemExit(f"{label}: df -g / reports {free:g} GB free; stopping below 49 GB")
    return free


free_gb = disk_guard("print PDF check")
(log_dir / "print-checks-v1.2.1.log").open("a", encoding="utf-8").write(
    f"{__import__('datetime').datetime.now().isoformat()} command=python3 scripts/print-checks.py free_gb={free_gb:g}\n"
)


def source_commit():
    value = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root, text=True).strip()
    dirty = subprocess.check_output(["git", "status", "--porcelain=v1"], cwd=root, text=True).splitlines()
    requested = os.environ.get("ROOT_SOURCE_COMMIT", "").strip()
    if requested and requested != value:
        raise SystemExit(f"ROOT_SOURCE_COMMIT {requested} does not match HEAD {value}")
    return value, bool(requested or "--final" in sys.argv), dirty


commit, final_run, dirty_fields = source_commit()


def artifact(name, value):
    target = evidence / name
    if target.exists():
        index = 0
        backup = discarded / f"{target.stat().st_mtime_ns}-{os.getpid()}-{index}-{name}"
        while backup.exists():
            index += 1
            backup = discarded / f"{target.stat().st_mtime_ns}-{os.getpid()}-{index}-{name}"
        target.rename(backup)
    target.write_text(value, encoding="utf-8")


def page_content(page):
    chunks = []

    def visit(value, matrix, text_matrix, _font, font_size):
        value = value or ""
        if value.strip():
            scale = math.hypot(matrix[0], matrix[1]) or 1
            chunks.append({"value": value, "size": font_size * scale,
                           "x": matrix[0]*text_matrix[4]+matrix[2]*text_matrix[5]+matrix[4],
                           "y": float(page.mediabox.height)-(matrix[1]*text_matrix[4]+matrix[3]*text_matrix[5]+matrix[5])})

    page.extract_text(visitor_text=visit)
    text = " ".join(page.extract_text().split())
    return text, chunks


def norm(value):
    return re.sub(r"\s+", "", value).lower()


def lines(chunks):
    grouped = []
    for chunk in chunks:
        found = next((line for line in grouped if abs(line["y"] - chunk["y"]) <= 1.5), None)
        if found:
            found["chunks"].append(chunk)
        else:
            grouped.append({"y": chunk["y"], "chunks": [chunk]})
    return [{"y": line["y"], "text": "".join(chunk["value"] for chunk in sorted(line["chunks"], key=lambda item:item["x"])),
             "size": max(chunk["size"] for chunk in line["chunks"])} for line in sorted(grouped, key=lambda item: item["y"])]


def page_size(page):
    return round(float(page.mediabox.width)), round(float(page.mediabox.height))


def matching_sizes(chunks, phrases):
    wanted = [norm(phrase) for phrase in phrases]
    return [chunk["size"] for chunk in chunks if any(item in norm(chunk["value"]) for item in wanted)]


def board_pdf(path, expected_size, minimum, require_stress=False):
    reader = PdfReader(path)
    assert len(reader.pages) >= (2 if require_stress else 1), (path.name, "page count")
    page_results = []
    revisions = []
    for number, page in enumerate(reader.pages, 1):
        assert page_size(page) == expected_size, (path.name, number, page_size(page), expected_size)
        text, chunks = page_content(page)
        compact = norm(text)
        assert compact.count(norm(notice)) == 1, (path.name, number, "notice count", compact.count(norm(notice)))
        sheet_labels = re.findall(r"Sheet\s+\d+\s+of\s+\d+", text, flags=re.I)
        assert len(sheet_labels) == 1, (path.name, number, "sheet label", sheet_labels)
        revision_matches = re.findall(r"printrevision:?(20\d{2}-\d{2}-\d{2})-([a-f0-9]{8})", compact)
        assert len(revision_matches) == 1, (path.name, number, "revision", revision_matches)
        revision = f"{revision_matches[0][0]}-{revision_matches[0][1]}"
        revisions.append(revision)
        assert compact.count(norm("Action status legend")) == 1, (path.name, number, "legend")
        assert "wholeboard" in compact, (path.name, number, "whole-board count label")
        assert compact.count(norm("checked")) >= 1 and compact.count(norm("planned")) >= 1 and compact.count(norm("not done")) >= 1
        sizes = [chunk["size"] for chunk in chunks if chunk["size"] > 0]
        assert sizes and min(sizes) >= minimum - 0.03, (path.name, number, "minimum text", min(sizes), minimum)
        page_lines = lines(chunks)
        action_lines = [line for line in page_lines if norm(line["text"]) in {"checkedonsite", "planned", "notdone"}]
        assert action_lines, (path.name, number, "action status line")
        assert min(line["size"] for line in action_lines) >= minimum - 0.03, (path.name, number, "status size")
        title_lines = []
        for action_line in action_lines:
            following = next((line for line in page_lines if line["y"] > action_line["y"]), None)
            assert following, (path.name, number, "action title line")
            title_lines.append(following)
        assert min(line["size"] for line in title_lines) >= minimum - 0.03, (path.name, number, "title size")
        invitation = next((line for line in page_lines if norm("Tell us how safe you feel") in norm(line["text"])),None)
        assert invitation, (path.name,number,"rider invitation")
        footer_lines = [line for line in page_lines if line["y"] >= invitation["y"]-1]
        footer_text = norm(" ".join(line["text"] for line in footer_lines))
        assert norm("Tell us how safe you feel") in footer_text, (path.name, number, "rider invitation footer")
        if expected_size[0] == 1224:
            assert norm(notice) in footer_text, (path.name, number, "footer notice")
            assert min((chunk["size"] for chunk in chunks if chunk["y"] >= invitation["y"]-1), default=0) >= 24 - .03, (path.name, number, "footer notice size")
            assert any(norm("Tell us how safe") in norm(line["text"]) and line["size"] >= 24 - .03 for line in footer_lines), (path.name, number, "footer invitation size")
            assert min([line["size"] for line in action_lines] + [line["size"] for line in title_lines]) >= 28 - .03, (path.name, number, "tabloid status/title size")
            first_action_y = min(line["y"]-line["size"] for line in action_lines)
            assert first_action_y <= float(page.mediabox.height) / 3, (path.name, number, "first action top third", first_action_y)
        page_results.append({"page": number, "sheet": sheet_labels[0], "revision": revision,
                             "minimum_text_pt": round(min(sizes), 2), "action_status_text_pt": round(min(line["size"] for line in action_lines), 2), "action_title_text_pt": round(min(line["size"] for line in title_lines), 2),
                             "first_action_text_top_pt": round(min(line["y"]-line["size"] for line in action_lines), 2), "action_count":len(action_lines)})
    assert len(set(revisions)) == 1, (path.name, "revision differs", revisions)
    assert [int(re.search(r"Sheet\s+(\d+)", page["sheet"], re.I).group(1)) for page in page_results] == list(range(1, len(page_results) + 1)), (path.name, "sheet sequence")
    assert max(page["action_count"] for page in page_results)>=2, (path.name,"multiple actions must fit on at least one sheet")
    return {"file": str(path.relative_to(evidence)), "page_size_pt": expected_size, "pages": page_results,
            "revision": revisions[0], "stress": require_stress}


boards = []
for name, size in (("letter", (612, 792)), ("tabloid", (1224, 792))):
    disk_guard(f"{name} board PDF check")
    boards.append(board_pdf(evidence / f"v1.2.1-board-{name}-print.pdf", size, 18))
    stress = evidence / f"v1.2.1-board-{name}-multipage.pdf"
    disk_guard(f"{name} stress PDF check")
    boards.append(board_pdf(stress, size, 18, True))

card_path = evidence / "v1.2.1-card-print.pdf"
disk_guard("card PDF check")
card = PdfReader(card_path)
assert len(card.pages) == 2, ("card page count", len(card.pages))
card_pages = []
card_text = []
for number, page in enumerate(card.pages, 1):
    assert page_size(page) == (612, 792), ("card page size", number, page_size(page))
    text, chunks = page_content(page)
    sizes = [chunk["size"] for chunk in chunks if chunk["size"] > 0]
    assert sizes and min(sizes) >= 12 - .03, ("card text size", number, min(sizes) if sizes else None)
    card_text.append(text)
    card_pages.append({"page": number, "minimum_text_pt": round(min(sizes), 2)})
card_all = norm(" ".join(card_text))
assert norm("How safe do you feel at this station?") in card_all
assert all(f"{number}." in " ".join(card_text) for number in range(1, 7)), "card questions"

receipt = {"passed": True, "version": "1.2.1", "source_commit": commit, "final_run": final_run, "dirty_fields": dirty_fields, "disk_free_gb_at_start": free_gb,
           "card_pages": card_pages, "boards": boards}
artifact("v1.2.1-print-results.json", json.dumps(receipt, indent=2) + "\n")
print(f"PASS: {sum(len(board['pages']) for board in boards)} board pages retain one exact notice, legend, revision and sheet label. Rider card: {len(card.pages)} Letter sides.")
