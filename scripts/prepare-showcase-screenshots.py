"""Make pixel-exact public crops from native QA evidence.

The source captures remain unchanged for audit. The crop removes the OS title
bar, desktop QA panel, taskbar and neighboring windows without painting or
generating any application content.
"""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs" / "validation" / "evidence"
DESTINATION = ROOT / "docs" / "images" / "showcase"
NAMES = (
    "quotalune_settings",
    "settings_menubar",
    "settings_about",
    "dashboard",
    "analytics",
    "providers",
    "themes",
    "provider_display",
    "surfaces",
    "dashboard_studio",
)


def main() -> None:
    DESTINATION.mkdir(parents=True, exist_ok=True)
    for name in NAMES:
        source = SOURCE / f"PHASE_NATIVE_{name}_2026-09-26.png"
        with Image.open(source) as image:
            if image.width < 1846 or image.height < 1088:
                raise ValueError(f"unexpected native capture dimensions: {source}")
            # The QA panel begins below y=850 in these archived captures.
            # The app ends at x=1835; anything farther right is desktop chrome.
            box = (10, 45, 1835, 850)
            image.crop(box).save(DESTINATION / f"{name}.png", optimize=True)
            print(f"{name}: {box}")


if __name__ == "__main__":
    main()
