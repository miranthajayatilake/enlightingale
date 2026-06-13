from arq.connections import RedisSettings
from core.config import settings


async def run_research_agent(ctx, muse_id: str, job_id: str, focus: str | None = None) -> None:
    from services.research_agent.agent import run
    await run(muse_id=muse_id, job_id=job_id, redis_conn=ctx["redis"], focus=focus)


async def run_process_resource(ctx, resource_id: str, job_id: str) -> None:
    from services.ingest.processor import process_resource
    await process_resource(resource_id=resource_id, job_id=job_id, redis_conn=ctx["redis"])


async def run_build_knowledge_layer(ctx, muse_id: str, job_id: str) -> None:
    from services.knowledge.builder import build_knowledge_layer
    await build_knowledge_layer(muse_id=muse_id, job_id=job_id, redis_conn=ctx["redis"])


async def run_generate_lessons(ctx, muse_id: str, job_id: str) -> None:
    from services.lessons.generator import generate_lessons
    await generate_lessons(muse_id=muse_id, job_id=job_id, redis_conn=ctx["redis"])


async def run_build_canvas(ctx, muse_id: str, job_id: str) -> None:
    from services.canvas.generator import build_canvas
    await build_canvas(muse_id=muse_id, job_id=job_id, redis_conn=ctx["redis"])


class WorkerSettings:
    functions = [run_research_agent, run_process_resource, run_build_knowledge_layer, run_generate_lessons, run_build_canvas]
    redis_settings = RedisSettings.from_dsn(settings.REDIS_URL)
    max_jobs = 10
    job_timeout = 600
