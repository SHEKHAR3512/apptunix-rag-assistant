"""Local Apptunix knowledge assistant."""

import os
from pathlib import Path

# Windows fallback for machines without the system Visual C++ redistributable.
# Ollama's official Windows installation already includes Microsoft's runtime.
# Keep the directory handle alive; Python closes it when this process exits.
_runtime_handle = None
if (
    os.name == "nt"
    and not (Path(os.environ.get("WINDIR", "C:/Windows")) / "System32/msvcp140.dll").exists()
):
    _runtime = Path(os.environ.get("LOCALAPPDATA", "")) / "Programs/Ollama/lib/ollama/cuda_v13"
    if (_runtime / "msvcp140.dll").is_file():
        _runtime_handle = os.add_dll_directory(str(_runtime))
