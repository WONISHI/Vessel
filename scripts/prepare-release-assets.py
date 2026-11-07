"""Collect platform artifacts and merge the two macOS architecture manifests."""
import base64
import hashlib
import shutil
import sys
from pathlib import Path
from urllib.parse import unquote

import yaml

source, destination = map(Path, sys.argv[1:])
destination.mkdir(parents=True, exist_ok=True)
manifests = {}
for platform in ("windows-x64", "mac-arm64", "mac-x64"):
    directory = source / f"release-{platform}"
    manifest_name = "latest.yml" if platform == "windows-x64" else "latest-mac.yml"
    manifest = yaml.safe_load((directory / manifest_name).read_text(encoding="utf-8"))
    manifests[platform] = manifest
    for entry in manifest["files"]:
        name = unquote(entry["url"])
        if Path(name).name != name:
            raise ValueError(f"Invalid artifact name {name}")
        artifact = directory / name
        digest = base64.b64encode(hashlib.sha512(artifact.read_bytes()).digest()).decode()
        if digest != entry["sha512"] or artifact.stat().st_size != entry["size"]:
            raise ValueError(f"Artifact integrity check failed for {name}")
    for artifact in directory.iterdir():
        if artifact.suffix not in (".exe", ".dmg", ".zip", ".blockmap"):
            continue
        target = destination / artifact.name
        if target.exists():
            raise ValueError(f"Duplicate artifact {artifact.name}")
        shutil.copy2(artifact, target)

versions = {manifest["version"] for manifest in manifests.values()}
if len(versions) != 1:
    raise ValueError("Platform versions do not match")
mac = manifests["mac-arm64"]
mac["files"] = mac["files"] + manifests["mac-x64"]["files"]
for arch in ("arm64", "x64"):
    if not any(f"-{arch}.zip" in entry["url"] for entry in mac["files"]):
        raise ValueError(f"Missing macOS {arch} update ZIP")
for name, manifest in (("latest.yml", manifests["windows-x64"]), ("latest-mac.yml", mac)):
    (destination / name).write_text(yaml.safe_dump(manifest, sort_keys=False), encoding="utf-8")
