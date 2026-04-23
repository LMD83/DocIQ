import os

import httpx
from fastapi import FastAPI, HTTPException, Path

ANTHROPIC_BASE_URL = "https://api.anthropic.com"
ANTHROPIC_VERSION = "2023-06-01"

app = FastAPI(title="Anthropic Admin API Proxy")


def _admin_key() -> str:
    key = os.environ.get("ANTHROPIC_ADMIN_API_KEY")
    if not key:
        raise HTTPException(
            status_code=500,
            detail="ANTHROPIC_ADMIN_API_KEY is not set on the server",
        )
    return key


@app.get("/v1/organizations/api_keys/{api_key_id}")
async def get_api_key(
    api_key_id: str = Path(..., description="ID of the API key"),
):
    url = f"{ANTHROPIC_BASE_URL}/v1/organizations/api_keys/{api_key_id}"
    headers = {
        "anthropic-version": ANTHROPIC_VERSION,
        "X-Api-Key": _admin_key(),
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(url, headers=headers)

    if resp.status_code >= 400:
        try:
            detail = resp.json()
        except ValueError:
            detail = resp.text
        raise HTTPException(status_code=resp.status_code, detail=detail)

    return resp.json()
