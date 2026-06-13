import chromadb
from chromadb.config import Settings as ChromaSettings

from core.config import settings
from .base import VectorStore, Chunk, SearchResult
from .embedder import Embedder


class ChromaVectorStore(VectorStore):
    def __init__(self) -> None:
        self._client = chromadb.PersistentClient(
            path=settings.CHROMA_DB_PATH,
            settings=ChromaSettings(anonymized_telemetry=False),
        )
        self._embedder = Embedder()

    def _collection(self, muse_id: str):
        return self._client.get_or_create_collection(
            name=f"muse_{muse_id}",
            metadata={"hnsw:space": "cosine"},
        )

    async def add_chunks(self, muse_id: str, chunks: list[Chunk]) -> None:
        if not chunks:
            return
        collection = self._collection(muse_id)
        texts = [c.text for c in chunks]
        embeddings = self._embedder.embed(texts)
        collection.add(
            ids=[c.id for c in chunks],
            documents=texts,
            embeddings=embeddings,
            metadatas=[{"resource_id": c.resource_id, **c.metadata} for c in chunks],
        )

    async def query(self, muse_id: str, text: str, k: int = 6) -> list[SearchResult]:
        collection = self._collection(muse_id)
        embedding = self._embedder.embed([text])[0]
        results = collection.query(query_embeddings=[embedding], n_results=min(k, collection.count()))
        if not results["ids"] or not results["ids"][0]:
            return []
        return [
            SearchResult(
                chunk_id=id_,
                text=doc,
                resource_id=meta.get("resource_id", ""),
                score=1.0 - dist,          # cosine distance → similarity
                metadata=meta,
            )
            for id_, doc, meta, dist in zip(
                results["ids"][0],
                results["documents"][0],
                results["metadatas"][0],
                results["distances"][0],
            )
        ]

    async def delete_resource(self, muse_id: str, resource_id: str) -> None:
        collection = self._collection(muse_id)
        existing = collection.get(where={"resource_id": resource_id})
        if existing["ids"]:
            collection.delete(ids=existing["ids"])

    async def delete_muse(self, muse_id: str) -> None:
        try:
            self._client.delete_collection(f"muse_{muse_id}")
        except Exception:
            pass


def get_vector_store() -> VectorStore:
    if settings.VECTOR_STORE_BACKEND == "chroma":
        return ChromaVectorStore()
    raise ValueError(f"Unknown vector store backend: {settings.VECTOR_STORE_BACKEND}")
