from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass
class Chunk:
    id: str
    text: str
    resource_id: str
    muse_id: str
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class SearchResult:
    chunk_id: str
    text: str
    resource_id: str
    score: float          # 0–1, higher = more similar
    metadata: dict[str, Any] = field(default_factory=dict)


class VectorStore(ABC):
    @abstractmethod
    async def add_chunks(self, muse_id: str, chunks: list[Chunk]) -> None: ...

    @abstractmethod
    async def query(self, muse_id: str, text: str, k: int = 6) -> list[SearchResult]: ...

    @abstractmethod
    async def delete_resource(self, muse_id: str, resource_id: str) -> None: ...

    @abstractmethod
    async def delete_muse(self, muse_id: str) -> None: ...
