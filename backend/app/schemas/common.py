"""Common response schemas for unified API format."""

from typing import Any, Generic, List, Optional, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class APIResponse(BaseModel, Generic[T]):
    """Unified API response format.

    Example success:
        {"code": 0, "message": "success", "data": {...}}
    """

    code: int = Field(default=0, description="Response code, 0 means success")
    message: str = Field(default="success", description="Response message")
    data: Optional[T] = Field(default=None, description="Response data payload")

    @classmethod
    def success(cls, data: Any = None, message: str = "success") -> "APIResponse":
        return cls(code=0, message=message, data=data)

    @classmethod
    def error(cls, code: int, message: str, data: Any = None) -> "APIResponse":
        return cls(code=code, message=message, data=data)


class PaginatedData(BaseModel, Generic[T]):
    """Paginated list data."""

    items: List[T] = Field(default_factory=list)
    total: int = Field(default=0, description="Total number of items")
    page: int = Field(default=1, description="Current page number")
    page_size: int = Field(default=20, description="Items per page")
    total_pages: int = Field(default=0, description="Total number of pages")


class PaginatedResponse(BaseModel, Generic[T]):
    """Paginated API response.

    Example:
        {"code": 0, "message": "success", "data": {"items": [...], "total": 100, ...}}
    """

    code: int = Field(default=0)
    message: str = Field(default="success")
    data: Optional[PaginatedData[T]] = None

    @classmethod
    def create(
        cls,
        items: List[Any],
        total: int,
        page: int,
        page_size: int,
    ) -> "PaginatedResponse":
        total_pages = (total + page_size - 1) // page_size if page_size > 0 else 0
        return cls(
            data=PaginatedData(
                items=items,
                total=total,
                page=page,
                page_size=page_size,
                total_pages=total_pages,
            )
        )


class ErrorResponse(BaseModel):
    """Error response schema for OpenAPI docs."""

    code: int = Field(description="Error code")
    message: str = Field(description="Error message")
    data: Optional[Any] = None
