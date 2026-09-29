from enum import Enum
from typing import AsyncGenerator

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import String, Text, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://ticolisto:ticolisto@localhost:5432/ticolisto"
    cors_origins: str = "http://localhost:3000"
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
engine = create_async_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class Service(Base):
    __tablename__ = "services"
    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    category: Mapped[str] = mapped_column(String(80), index=True)
    name_en: Mapped[str] = mapped_column(String(180))
    name_es: Mapped[str] = mapped_column(String(180))
    description_en: Mapped[str] = mapped_column(Text)
    description_es: Mapped[str] = mapped_column(Text)
    location: Mapped[str] = mapped_column(String(120))
    whatsapp: Mapped[str | None] = mapped_column(String(40), nullable=True)


class RequestStatus(str, Enum):
    received = "received"
    reviewing = "reviewing"
    quoted = "quoted"
    confirmed = "confirmed"
    completed = "completed"


class AssistanceRequest(Base):
    __tablename__ = "assistance_requests"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255))
    phone: Mapped[str] = mapped_column(String(40))
    location: Mapped[str] = mapped_column(String(180))
    category: Mapped[str] = mapped_column(String(80))
    description: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(30), default=RequestStatus.received.value)


class ServiceOut(BaseModel):
    id: int
    slug: str
    category: str
    name_en: str
    name_es: str
    description_en: str
    description_es: str
    location: str
    whatsapp: str | None

    model_config = {"from_attributes": True}


class AssistanceRequestIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    phone: str = Field(min_length=7, max_length=40)
    location: str = Field(min_length=2, max_length=180)
    category: str = Field(min_length=2, max_length=80)
    description: str = Field(min_length=10, max_length=5000)


class AssistanceRequestOut(BaseModel):
    id: int
    status: RequestStatus

    model_config = {"from_attributes": True}


DEFAULT_SERVICES = [
    {
        "slug": "airport-transfer",
        "category": "transport",
        "name_en": "Airport transfer",
        "name_es": "Transporte desde el aeropuerto",
        "description_en": "Safe, private transportation from Juan Santamaría airport.",
        "description_es": "Transporte privado y seguro desde el aeropuerto Juan Santamaría.",
        "location": "San José · Airport",
        "whatsapp": None,
    },
    {
        "slug": "paperwork-help",
        "category": "paperwork",
        "name_en": "Help with paperwork",
        "name_es": "Asistencia con trámites",
        "description_en": "Understand the next steps for local paperwork without the jargon.",
        "description_es": "Entiende los siguientes pasos para tus trámites locales.",
        "location": "All Costa Rica",
        "whatsapp": None,
    },
    {
        "slug": "housing-guidance",
        "category": "housing",
        "name_en": "Housing guidance",
        "name_es": "Orientación para vivienda",
        "description_en": "Get help reviewing a rental, neighborhood or basic services.",
        "description_es": "Recibe ayuda para revisar un alquiler, barrio o servicios básicos.",
        "location": "San José · Guanacaste",
        "whatsapp": None,
    },
    {
        "slug": "health-navigation",
        "category": "health",
        "name_en": "Health navigation",
        "name_es": "Orientación de salud",
        "description_en": "Find the right channel for non-emergency health assistance.",
        "description_es": "Encuentra el canal adecuado para asistencia de salud no urgente.",
        "location": "All Costa Rica",
        "whatsapp": None,
    },
]


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session


app = FastAPI(title="TicoListo API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.cors_origins.split(",")],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup() -> None:
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    async with SessionLocal() as session:
        has_services = await session.scalar(select(Service.id).limit(1))
        if has_services is None:
            session.add_all(Service(**service) for service in DEFAULT_SERVICES)
            await session.commit()


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/services", response_model=list[ServiceOut])
async def list_services(
    category: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
) -> list[Service]:
    query = select(Service).order_by(Service.id)
    if category:
        query = query.where(Service.category == category)
    return list((await session.scalars(query)).all())


@app.post("/assistance-requests", response_model=AssistanceRequestOut, status_code=201)
async def create_request(
    payload: AssistanceRequestIn,
    session: AsyncSession = Depends(get_session),
) -> AssistanceRequest:
    request = AssistanceRequest(**payload.model_dump())
    session.add(request)
    await session.commit()
    await session.refresh(request)
    return request


@app.get("/assistance-requests/{request_id}", response_model=AssistanceRequestOut)
async def get_request(request_id: int, session: AsyncSession = Depends(get_session)) -> AssistanceRequest:
    request = await session.get(AssistanceRequest, request_id)
    if request is None:
        raise HTTPException(status_code=404, detail="Assistance request not found")
    return request
