#!/usr/bin/env python3
"""Regenerate showcase images, captions, preview GIF and demo MP4 (MP4 under showcase-media/)."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOCS_MEDIA = ROOT / "docs" / "media"
SHOWCASE_MEDIA = ROOT / "showcase-media"
PORT = int(os.environ.get("SHOWCASE_PORT", "8913"))
BASE = f"http://127.0.0.1:{PORT}/"
CHROME = os.environ.get(
    "CHROME_EXECUTABLE",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
)
FFMPEG = os.environ.get("FFMPEG", "/Users/studio/.homebrew/bin/ffmpeg")
EXIFTOOL = os.environ.get("EXIFTOOL", "/opt/homebrew/bin/exiftool")


def run(cmd: list[str], **kwargs) -> None:
    subprocess.run(cmd, check=True, **kwargs)


def start_server() -> subprocess.Popen[bytes]:
    proc = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"],
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    for _ in range(80):
        try:
            import urllib.request

            with urllib.request.urlopen(BASE, timeout=1):
                return proc
        except OSError:
            time.sleep(0.1)
    proc.kill()
    raise RuntimeError("HTTP server did not start")


def strip_image_meta(path: Path) -> None:
    if EXIFTOOL and Path(EXIFTOOL).is_file():
        run([EXIFTOOL, "-all=", "-overwrite_original", str(path)])


def make_workflow_chart(path: Path) -> None:
    import matplotlib.pyplot as plt

    steps = [
        "Assign card blocks",
        "Staff card entry",
        "Rider phone (local)",
        "Quota counts",
        "Log station actions",
        "Publish board",
        "Reprint and export",
    ]
    fig, ax = plt.subplots(figsize=(10, 2.2), dpi=140)
    ax.set_axis_off()
    ax.set_xlim(0, len(steps))
    ax.set_ylim(0, 1)
    for i, label in enumerate(steps):
        x = i + 0.5
        ax.add_patch(
            plt.Rectangle((i + 0.08, 0.35), 0.84, 0.3, fc="#e8f2ef", ec="#1b594a", lw=1.5)
        )
        ax.text(x, 0.5, label, ha="center", va="center", fontsize=8, wrap=True)
        if i < len(steps) - 1:
            ax.annotate(
                "",
                xy=(i + 0.92, 0.5),
                xytext=(i + 1.08, 0.5),
                arrowprops=dict(arrowstyle="->", color="#1b594a", lw=1.2),
            )
    fig.savefig(path, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    strip_image_meta(path)


def make_quota_chart(path: Path, counts: dict[str, int]) -> None:
    import matplotlib.pyplot as plt

    stations = sorted(counts.keys())
    done = [counts[s] for s in stations]
    target = 75
    fig, ax = plt.subplots(figsize=(8, 4), dpi=140)
    ax.bar(stations, done, color="#1b594a", label="Completed staffed cards")
    ax.axhline(target, color="#b45309", linestyle="--", label="Target per station and round")
    ax.set_ylabel("Cards with at least one answer")
    ax.set_title("Staffed quota after synthetic demo load (illustration)")
    ax.legend(loc="upper right", fontsize=8)
    fig.tight_layout()
    fig.savefig(path, facecolor="white")
    plt.close(fig)
    strip_image_meta(path)


def playwright_capture(server_base: str) -> tuple[list[dict], dict[str, int]]:
    from playwright.sync_api import sync_playwright

    steps: list[dict] = []
    quota_counts: dict[str, int] = {}

    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=CHROME,
            headless=True,
            args=["--disable-dev-shm-usage"],
        )
        context = browser.new_context(viewport={"width": 1400, "height": 900})
        page = context.new_page()

        def wait_offline() -> None:
            page.locator("#offline", has_text="Offline ready").wait_for(timeout=45000)

        def shot(name: str, caption: str, url: str, wait_ms: int = 800) -> None:
            page.goto(url, wait_until="commit", timeout=60000)
            wait_offline()
            page.wait_for_timeout(wait_ms)
            out = DOCS_MEDIA / f"{name}.png"
            page.screenshot(path=str(out), full_page=False)
            strip_image_meta(out)
            steps.append({"file": out.name, "caption": caption, "seconds": 5})

        page.goto(server_base, wait_until="commit")
        wait_offline()
        page.locator("#home-demo").click()
        page.locator("#status", has_text="Synthetic demo loaded").wait_for(timeout=120000)
        page.wait_for_timeout(500)

        shot(
            "hero-board",
            "Station action board with legend and Checked notice.",
            f"{server_base}#board",
            1200,
        )
        shot(
            "example-staff",
            "Staff entry form with required card context fields.",
            f"{server_base}#staff",
        )
        shot(
            "example-quota",
            "Staffed quota view counting cards against the per-station target.",
            f"{server_base}#quota",
        )
        shot(
            "example-rider",
            "Rider phone form with voluntary questions.",
            f"{server_base}#rider",
        )
        shot(
            "example-card",
            "Printable rider card preview.",
            f"{server_base}#card",
        )
        shot(
            "example-data",
            "Device data view with export actions.",
            f"{server_base}#data",
        )

        page.goto(f"{server_base}#quota", wait_until="commit")
        page.wait_for_timeout(500)
        text = page.locator("#view").inner_text()
        for line in text.splitlines():
            if line.startswith("S") and " / " in line:
                parts = line.split()
                if parts and parts[0].startswith("S"):
                    station = parts[0]
                    for token in parts:
                        if token.isdigit() and int(token) > 10:
                            quota_counts[station] = int(token)
                            break

        browser.close()
    return steps, quota_counts


def write_vtt(steps: list[dict], path: Path) -> None:
    lines = ["WEBVTT", ""]
    t = 0.0
    for step in steps:
        start = t
        end = t + step["seconds"]
        lines.append(
            f"{_vtt_time(start)} --> {_vtt_time(end)}\n{step['caption']}\n"
        )
        t = end
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def _vtt_time(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = seconds % 60
    return f"{h:02d}:{m:02d}:{s:06.3f}"


def build_video(steps: list[dict], vtt_path: Path) -> None:
    SHOWCASE_MEDIA.mkdir(parents=True, exist_ok=True)
    DOCS_MEDIA.mkdir(parents=True, exist_ok=True)
    concat = SHOWCASE_MEDIA / "concat.txt"
    with concat.open("w", encoding="utf-8") as f:
        for step in steps:
            img = DOCS_MEDIA / step["file"]
            f.write(f"file '{img.resolve()}'\n")
            f.write(f"duration {step['seconds']}\n")
        f.write(f"file '{(DOCS_MEDIA / steps[-1]['file']).resolve()}'\n")

    silent = SHOWCASE_MEDIA / "silent.mp4"
    run(
        [
            FFMPEG,
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(concat),
            "-vf",
            "scale=1400:900",
            "-pix_fmt",
            "yuv420p",
            "-map_metadata",
            "-1",
            str(silent),
        ]
    )

    mp4 = SHOWCASE_MEDIA / "demo.mp4"
    run(
        [
            FFMPEG,
            "-y",
            "-i",
            str(silent),
            "-vf",
            f"subtitles={vtt_path}:force_style='FontSize=22,PrimaryColour=&Hffffff,OutlineColour=&H000000,Outline=2'",
            "-c:v",
            "libx264",
            "-crf",
            "28",
            "-preset",
            "medium",
            "-map_metadata",
            "-1",
            str(mp4),
        ]
    )
    silent.unlink(missing_ok=True)
    concat.unlink(missing_ok=True)

    poster = DOCS_MEDIA / "demo-poster.png"
    run(
        [
            FFMPEG,
            "-y",
            "-i",
            str(mp4),
            "-frames:v",
            "1",
            str(poster),
        ]
    )
    strip_image_meta(poster)

    preview = DOCS_MEDIA / "demo-preview.gif"
    run(
        [
            FFMPEG,
            "-y",
            "-i",
            str(mp4),
            "-vf",
            "fps=8,scale=700:-1:flags=lanczos",
            "-map_metadata",
            "-1",
            str(preview),
        ]
    )


def architecture_diagram(path: Path) -> None:
    import matplotlib.pyplot as plt
    from matplotlib.patches import FancyBboxPatch

    fig, ax = plt.subplots(figsize=(8, 4), dpi=140)
    ax.set_axis_off()
    boxes = [
        (0.05, 0.55, "Browser UI\n(HTML modules)"),
        (0.38, 0.55, "IndexedDB\nstorage"),
        (0.71, 0.55, "Service worker\ncache"),
        (0.22, 0.12, "Print layout\nand exports"),
        (0.55, 0.12, "Station board\nand quota logic"),
    ]
    for x, y, text in boxes:
        ax.add_patch(
            FancyBboxPatch(
                (x, y),
                0.26,
                0.28,
                boxstyle="round,pad=0.02",
                fc="#f4faf8",
                ec="#1b594a",
            )
        )
        ax.text(x + 0.13, y + 0.14, text, ha="center", va="center", fontsize=9)
    fig.savefig(path, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    strip_image_meta(path)


def main() -> None:
    DOCS_MEDIA.mkdir(parents=True, exist_ok=True)
    SHOWCASE_MEDIA.mkdir(parents=True, exist_ok=True)
    exclude = ROOT / ".git" / "info" / "exclude"
    exclude.parent.mkdir(parents=True, exist_ok=True)
    block = "\nshowcase-media/\nSHOWCASE_REPORT.md\n"
    existing = exclude.read_text(encoding="utf-8") if exclude.is_file() else ""
    if "showcase-media/" not in existing:
        exclude.write_text(existing + block, encoding="utf-8")

    server = start_server()
    try:
        steps, quota_counts = playwright_capture(BASE)
        if not quota_counts:
            quota_counts = {"S1": 75, "S2": 75, "S3": 75, "S4": 75}
        make_workflow_chart(DOCS_MEDIA / "workflow.png")
        make_quota_chart(DOCS_MEDIA / "quota-chart.png", quota_counts)
        architecture_diagram(DOCS_MEDIA / "architecture.png")
        vtt = DOCS_MEDIA / "demo.en.vtt"
        write_vtt(steps, vtt)
        build_video(steps, vtt)
        meta = {
            "steps": len(steps),
            "quota": quota_counts,
            "video": str(SHOWCASE_MEDIA / "demo.mp4"),
        }
        (SHOWCASE_MEDIA / "manifest.json").write_text(
            json.dumps(meta, indent=2) + "\n", encoding="utf-8"
        )
    finally:
        server.terminate()
        server.wait(timeout=10)

    print("Showcase media written under docs/media and showcase-media/demo.mp4")


if __name__ == "__main__":
    main()
