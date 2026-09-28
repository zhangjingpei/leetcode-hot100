"""API 路由：薄层，只调用 services。"""
from fastapi import APIRouter, HTTPException, Query

from . import services

router = APIRouter(prefix="/api")


@router.get("/health")
def api_health():
    return services.health()


@router.get("/catalog")
def api_catalog():
    return services.catalog()


@router.get("/problems")
def api_problems(
    difficulty: str | None = Query(default=None),
    category: str | None = Query(default=None),
    q: str | None = Query(default=None),
):
    return services.list_problems(difficulty=difficulty, category=category, q=q)


@router.get("/problems/{pid}")
def api_problem(pid: str):
    p = services.get_problem(pid)
    if p is None:
        raise HTTPException(status_code=404, detail="problem not found")
    return p


@router.get("/stats")
def api_stats():
    return services.stats()
