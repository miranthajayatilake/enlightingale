from abc import ABC, abstractmethod


class StorageService(ABC):
    @abstractmethod
    async def save(self, key: str, data: bytes, content_type: str) -> str: ...

    @abstractmethod
    async def load(self, key: str) -> bytes: ...

    @abstractmethod
    async def delete(self, key: str) -> None: ...

    @abstractmethod
    def public_url(self, key: str) -> str: ...
