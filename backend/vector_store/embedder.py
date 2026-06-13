from sentence_transformers import SentenceTransformer


class Embedder:
    """Lazy-loaded local embedding model. Downloaded on first use."""

    _model: SentenceTransformer | None = None

    @classmethod
    def _get_model(cls) -> SentenceTransformer:
        if cls._model is None:
            cls._model = SentenceTransformer("all-MiniLM-L6-v2")
        return cls._model

    def embed(self, texts: list[str]) -> list[list[float]]:
        model = self._get_model()
        return model.encode(texts, normalize_embeddings=True).tolist()
