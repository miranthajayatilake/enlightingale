from pathlib import Path
import aiofiles
from .base import StorageService


class LocalStorageService(StorageService):
    def __init__(self, base_path: str) -> None:
        self._base = Path(base_path)
        self._base.mkdir(parents=True, exist_ok=True)

    async def save(self, key: str, data: bytes, content_type: str) -> str:
        path = self._base / key
        path.parent.mkdir(parents=True, exist_ok=True)
        async with aiofiles.open(path, "wb") as f:
            await f.write(data)
        return key

    async def load(self, key: str) -> bytes:
        async with aiofiles.open(self._base / key, "rb") as f:
            return await f.read()

    async def delete(self, key: str) -> None:
        path = self._base / key
        if path.exists():
            path.unlink()

    def public_url(self, key: str) -> str:
        return f"/files/{key}"
