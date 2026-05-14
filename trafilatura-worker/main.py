import asyncio
import os
from typing import Literal, Optional

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, model_validator
import trafilatura
from trafilatura.settings import use_config


app = FastAPI()

API_KEY = os.getenv("TRAFILATURA_API_KEY", "")
TRAFILATURA_VERSION = "2.0.0"


class ExtractRequest(BaseModel):
    url: Optional[str] = None
    html: Optional[str] = None
    output_format: Literal["text", "markdown", "json"] = "text"

    @model_validator(mode="after")
    def validate_input(self) -> "ExtractRequest":
        if not self.url and not self.html:
            raise ValueError("Either url or html must be provided")
        return self


class ExtractResponse(BaseModel):
    text: str
    title: Optional[str]
    author: Optional[str]
    date: Optional[str]
    sitename: Optional[str]
    url: Optional[str]
    success: bool
    error: Optional[str]


def require_api_key(x_api_key: Optional[str]) -> None:
    if API_KEY and x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")


def map_output_format(output_format: str) -> str:
    if output_format == "text":
        return "txt"
    return output_format


async def extract_from_downloaded(
    downloaded: str, output_format: str, timeout_seconds: float
) -> tuple[Optional[str], object]:
    mapped_output_format = map_output_format(output_format)

    def run_extraction() -> tuple[Optional[str], object]:
        extracted_text = trafilatura.extract(
            downloaded,
            output_format=mapped_output_format,
            include_comments=False,
            include_tables=True,
        )
        metadata = trafilatura.extract_metadata(downloaded)
        return extracted_text, metadata

    return await asyncio.wait_for(asyncio.to_thread(run_extraction), timeout=timeout_seconds)


@app.post("/extract", response_model=ExtractResponse)
async def extract(
    request: ExtractRequest,
    x_api_key: Optional[str] = Header(default=None),
) -> ExtractResponse:
    require_api_key(x_api_key)

    try:
        downloaded: Optional[str] = None
        request_url = request.url

        if request.url:
            config = use_config()
            config.set("DEFAULT", "DOWNLOAD_TIMEOUT", "15")
            downloaded = await asyncio.wait_for(
                asyncio.to_thread(trafilatura.fetch_url, request.url, config=config),
                timeout=15,
            )
            if not downloaded:
                return ExtractResponse(
                    text="",
                    title=None,
                    author=None,
                    date=None,
                    sitename=None,
                    url=request.url,
                    success=False,
                    error="Failed to fetch URL",
                )
        else:
            downloaded = request.html

        text, metadata = await extract_from_downloaded(
            downloaded or "",
            request.output_format,
            5 if request.html else 15,
        )

        return ExtractResponse(
            text=text or "",
            title=getattr(metadata, "title", None),
            author=getattr(metadata, "author", None),
            date=getattr(metadata, "date", None),
            sitename=getattr(metadata, "sitename", None),
            url=getattr(metadata, "url", None) or request_url,
            success=bool(text),
            error=None if text else "No content extracted",
        )
    except asyncio.TimeoutError:
        return ExtractResponse(
            text="",
            title=None,
            author=None,
            date=None,
            sitename=None,
            url=request.url,
            success=False,
            error="Extraction timed out",
        )
    except Exception as exc:
        return ExtractResponse(
            text="",
            title=None,
            author=None,
            date=None,
            sitename=None,
            url=request.url,
            success=False,
            error=str(exc),
        )


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "version": TRAFILATURA_VERSION}
