"""FastAPI 应用：API 路由 + 页面路由 + 静态资源。"""
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from . import api, services

ROOT = Path(__file__).resolve().parent.parent
STATIC = ROOT / "static"

app = FastAPI(title="LeetCode Hot 100 刷题教程", docs_url=None, redoc_url=None)
app.include_router(api.router)
app.mount("/static", StaticFiles(directory=STATIC), name="static")


@app.get("/", include_in_schema=False)
def index():
    return FileResponse(STATIC / "index.html")


@app.get("/problem/{pid}", include_in_schema=False)
def problem_page(pid: str):
    if services.get_problem(pid) is None:
        raise HTTPException(status_code=404, detail="problem not found")
    return FileResponse(STATIC / "problem.html")
