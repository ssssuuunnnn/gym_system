from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

TagColor = Literal["blue", "green", "gold", "orange", "red", "magenta", "purple", "cyan", "geekblue", "default"]


class MemberTagIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=20)
    color: TagColor = "blue"


class MemberTagOut(BaseModel):
    id: int
    name: str
    color: str
    member_count: int
    # 其中可以收到 LINE 優惠訊息的人數（已綁定且同意）
    sendable_count: int
    created_at: datetime


class UserTagsIn(BaseModel):
    """一次設定某位會員的全部標籤（沒有列到的就拿掉）。"""

    tag_ids: list[int] = Field(default_factory=list, max_length=50)


class TagMembersIn(BaseModel):
    """把一批會員加上（或拿掉）某個標籤，例如會員名單篩出來的人。"""

    user_ids: list[int] = Field(min_length=1, max_length=5000)
