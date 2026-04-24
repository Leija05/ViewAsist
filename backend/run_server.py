import os
import sys

import uvicorn

import server


class _NoConsoleStream:
    def write(self, _text: str) -> int:
        return 0

    def flush(self) -> None:
        return None

    def isatty(self) -> bool:
        return False


def _ensure_stdio_for_windows_windowed_exe() -> None:
    """
    En ejecutables `--noconsole` (PyInstaller runw.exe), stdout/stderr pueden venir en None.
    Uvicorn intenta usar `.isatty()` en esos streams al configurar logging.
    """
    if sys.stdout is None:
        sys.stdout = _NoConsoleStream()  # type: ignore[assignment]
    if sys.stderr is None:
        sys.stderr = _NoConsoleStream()  # type: ignore[assignment]


if __name__ == "__main__":
    _ensure_stdio_for_windows_windowed_exe()

    host = os.getenv("BACKEND_HOST", "127.0.0.1")
    port = int(os.getenv("BACKEND_PORT", "8000"))

    uvicorn.run(
        server.app,
        host=host,
        port=port,
        log_config=None,
        access_log=False,
    )
