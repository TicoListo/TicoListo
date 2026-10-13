from enum import Enum
from datetime import datetime
from uuid import uuid4
from pathlib import Path
from typing import AsyncGenerator
from urllib.request import Request as UrlRequest, urlopen
from urllib.error import HTTPError, URLError
import asyncio
import csv
import io
import json
import logging
import os

from fastapi import Depends, FastAPI, File, Header, HTTPException, Query, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import Boolean, DateTime, String, Text, select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://ticolisto:ticolisto@localhost:5432/ticolisto"
    cors_origins: str = "http://localhost:3000"
    admin_api_key: str = "dev-admin-key"
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
engine = create_async_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)
portal_monitor_task: asyncio.Task | None = None
logger = logging.getLogger("ticolisto")


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
    provider: Mapped[str | None] = mapped_column(String(180), nullable=True)
    whatsapp: Mapped[str | None] = mapped_column(String(40), nullable=True)
    # The legacy slug/name/description columns remain the compatibility contract.
    slug_en: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    slug_es: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    meta_title_en: Mapped[str | None] = mapped_column(String(220), nullable=True)
    meta_title_es: Mapped[str | None] = mapped_column(String(220), nullable=True)
    meta_description_en: Mapped[str | None] = mapped_column(String(320), nullable=True)
    meta_description_es: Mapped[str | None] = mapped_column(String(320), nullable=True)
    keywords_en: Mapped[str | None] = mapped_column(Text, nullable=True)
    keywords_es: Mapped[str | None] = mapped_column(Text, nullable=True)
    content_en: Mapped[str | None] = mapped_column(Text, nullable=True)
    content_es: Mapped[str | None] = mapped_column(Text, nullable=True)
    requirements_en: Mapped[str | None] = mapped_column(Text, nullable=True)
    requirements_es: Mapped[str | None] = mapped_column(Text, nullable=True)
    steps_en: Mapped[str | None] = mapped_column(Text, nullable=True)
    steps_es: Mapped[str | None] = mapped_column(Text, nullable=True)
    faq_en: Mapped[str | None] = mapped_column(Text, nullable=True)
    faq_es: Mapped[str | None] = mapped_column(Text, nullable=True)
    official_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    published: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")


class RequestStatus(str, Enum):
    new = "new"
    contacted = "contacted"
    waiting_documents = "waiting_documents"
    documents_received = "documents_received"
    in_progress = "in_progress"
    waiting_institution = "waiting_institution"
    correction_required = "correction_required"
    completed = "completed"
    received = "received"
    reviewing = "reviewing"
    quoted = "quoted"
    confirmed = "confirmed"


class AssistanceRequest(Base):
    __tablename__ = "assistance_requests"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255))
    phone: Mapped[str] = mapped_column(String(40))
    location: Mapped[str] = mapped_column(String(180))
    category: Mapped[str] = mapped_column(String(80))
    description: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(40), default=RequestStatus.new.value)
    assigned_to: Mapped[str | None] = mapped_column(String(120), nullable=True)
    province: Mapped[str | None] = mapped_column(String(80), nullable=True)
    tags: Mapped[str] = mapped_column(Text, default="")
    consent: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    chat_token: Mapped[str] = mapped_column(String(64), unique=True, index=True, default=lambda: uuid4().hex)


class Guide(Base):
    __tablename__ = "guides"
    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    module: Mapped[str] = mapped_column(String(80), index=True)
    title: Mapped[str] = mapped_column(String(220))
    institution: Mapped[str] = mapped_column(String(180))
    official_url: Mapped[str] = mapped_column(String(500))
    requirements: Mapped[str] = mapped_column(Text)
    steps: Mapped[str] = mapped_column(Text)
    published: Mapped[bool] = mapped_column(default=True)


class RequestMessage(Base):
    __tablename__ = "request_messages"
    id: Mapped[int] = mapped_column(primary_key=True)
    request_id: Mapped[int] = mapped_column(index=True)
    author: Mapped[str] = mapped_column(String(120))
    message: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class RequestDocument(Base):
    __tablename__ = "request_documents"
    id: Mapped[int] = mapped_column(primary_key=True)
    request_id: Mapped[int] = mapped_column(index=True)
    filename: Mapped[str] = mapped_column(String(255))
    storage_path: Mapped[str] = mapped_column(String(500))
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Task(Base):
    __tablename__ = "tasks"
    id: Mapped[int] = mapped_column(primary_key=True)
    request_id: Mapped[int] = mapped_column(index=True)
    title: Mapped[str] = mapped_column(String(220))
    due_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(40), default="pending")
    priority: Mapped[str] = mapped_column(String(20), default="normal")
    alert_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    variables: Mapped[str] = mapped_column(Text, default="{}")
    portal_id: Mapped[int | None] = mapped_column(nullable=True)
    portal_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    portal_checked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class RequestAction(Base):
    __tablename__ = "request_actions"
    id: Mapped[int] = mapped_column(primary_key=True)
    request_id: Mapped[int] = mapped_column(index=True)
    action: Mapped[str] = mapped_column(String(80))
    details: Mapped[str] = mapped_column(Text, default="{}")
    actor: Mapped[str] = mapped_column(String(120), default="admin")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[int] = mapped_column(primary_key=True)
    request_id: Mapped[int] = mapped_column(index=True)
    channel: Mapped[str] = mapped_column(String(30), default="internal")
    message: Mapped[str] = mapped_column(Text)
    sent_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class OfficialPortal(Base):
    __tablename__ = "official_portals"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(180))
    url: Mapped[str] = mapped_column(String(500), unique=True)
    status: Mapped[str] = mapped_column(String(30), default="unknown")
    status_code: Mapped[int | None] = mapped_column(nullable=True)
    checked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)


class ServiceOut(BaseModel):
    id: int
    slug: str
    category: str
    name_en: str
    name_es: str
    description_en: str
    description_es: str
    location: str
    provider: str | None
    whatsapp: str | None
    slug_en: str | None = None
    slug_es: str | None = None
    meta_title_en: str | None = None
    meta_title_es: str | None = None
    meta_description_en: str | None = None
    meta_description_es: str | None = None
    keywords_en: list[str] = []
    keywords_es: list[str] = []
    content_en: str | None = None
    content_es: str | None = None
    requirements_en: str | None = None
    requirements_es: str | None = None
    steps_en: str | None = None
    steps_es: str | None = None
    faq_en: list[dict[str, str]] = []
    faq_es: list[dict[str, str]] = []
    official_url: str | None = None
    image_url: str | None = None
    published: bool = True

    @field_validator("keywords_en", "keywords_es", mode="before")
    @classmethod
    def decode_keywords(cls, value: str | list[str] | None) -> list[str]:
        if not value:
            return []
        if isinstance(value, list):
            return value
        try:
            decoded = json.loads(value)
            return decoded if isinstance(decoded, list) else [value]
        except (TypeError, json.JSONDecodeError):
            return [item.strip() for item in value.split(",") if item.strip()]

    @field_validator("faq_en", "faq_es", mode="before")
    @classmethod
    def decode_faq(cls, value: str | list[dict[str, str]] | None) -> list[dict[str, str]]:
        if not value:
            return []
        if isinstance(value, list):
            return value
        try:
            decoded = json.loads(value)
            return decoded if isinstance(decoded, list) else []
        except (TypeError, json.JSONDecodeError):
            return []

    model_config = {"from_attributes": True}


class AssistanceRequestIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    phone: str = Field(min_length=7, max_length=40)
    location: str = Field(min_length=2, max_length=180)
    category: str = Field(min_length=2, max_length=80)
    description: str = Field(min_length=10, max_length=5000)
    province: str | None = Field(default=None, max_length=80)
    tags: list[str] = Field(default_factory=list, max_length=20)
    consent: bool = False


class AssistanceRequestOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    phone: str
    location: str
    category: str
    description: str
    status: RequestStatus
    assigned_to: str | None = None
    province: str | None = None
    tags: list[str] = []
    consent: bool = False
    created_at: datetime
    chat_token: str | None = None

    @field_validator("tags", mode="before")
    @classmethod
    def split_tags(cls, value: str | list[str]) -> list[str]:
        return value.split(",") if isinstance(value, str) and value else value or []

    model_config = {"from_attributes": True}

    @staticmethod
    def from_request(request: AssistanceRequest) -> "AssistanceRequestOut":
        data = request.__dict__.copy()
        data["tags"] = [tag for tag in request.tags.split(",") if tag]
        return AssistanceRequestOut.model_validate(data)


class GuideOut(BaseModel):
    id: int
    slug: str
    module: str
    title: str
    institution: str
    official_url: str
    requirements: str
    steps: str
    published: bool

    model_config = {"from_attributes": True}


class RequestUpdate(BaseModel):
    status: RequestStatus | None = None
    assigned_to: str | None = Field(default=None, max_length=120)
    tags: list[str] | None = Field(default=None, max_length=20)


class MessageIn(BaseModel):
    author: str = Field(min_length=2, max_length=120)
    message: str = Field(min_length=1, max_length=5000)


class MessageOut(BaseModel):
    id: int
    request_id: int
    author: str
    message: str

    model_config = {"from_attributes": True}


class ChatMessageIn(BaseModel):
    message: str = Field(min_length=1, max_length=5000)


class ChatMessageOut(BaseModel):
    id: int
    author: str
    message: str
    created_at: datetime | None = None
    model_config = {"from_attributes": True}


class PortalOut(BaseModel):
    id: int
    name: str
    url: str
    status: str
    status_code: int | None
    checked_at: datetime | None
    error: str | None
    model_config = {"from_attributes": True}


class TaskIn(BaseModel):
    title: str = Field(min_length=2, max_length=220)
    due_at: datetime | None = None
    status: str = Field(default="pending", max_length=40)
    priority: str = Field(default="normal", max_length=20)
    alert_at: datetime | None = None
    variables: dict[str, str | int | float | bool | None] = Field(default_factory=dict)
    portal_id: int | None = None


class TaskOut(TaskIn):
    id: int
    request_id: int
    completed: bool
    portal_status: str | None = None
    portal_checked_at: datetime | None = None

    @field_validator("variables", mode="before")
    @classmethod
    def decode_variables(cls, value: str | dict) -> dict:
        if isinstance(value, str):
            try:
                decoded = json.loads(value)
                return decoded if isinstance(decoded, dict) else {}
            except json.JSONDecodeError:
                return {}
        return value

    model_config = {"from_attributes": True}


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=220)
    due_at: datetime | None = None
    status: str | None = Field(default=None, max_length=40)
    priority: str | None = Field(default=None, max_length=20)
    completed: bool | None = None
    alert_at: datetime | None = None
    variables: dict[str, str | int | float | bool | None] | None = None
    portal_id: int | None = None


class ActionOut(BaseModel):
    id: int
    request_id: int
    action: str
    details: dict = {}
    actor: str
    created_at: datetime

    @field_validator("details", mode="before")
    @classmethod
    def decode_details(cls, value: str | dict) -> dict:
        if isinstance(value, str):
            try:
                decoded = json.loads(value)
                return decoded if isinstance(decoded, dict) else {}
            except json.JSONDecodeError:
                return {}
        return value

    model_config = {"from_attributes": True}


class DocumentOut(BaseModel):
    id: int
    request_id: int
    filename: str
    storage_path: str
    uploaded_at: datetime
    model_config = {"from_attributes": True}


class NotificationOut(BaseModel):
    id: int
    request_id: int
    channel: str
    message: str
    sent_at: datetime
    model_config = {"from_attributes": True}


class GuideIn(BaseModel):
    slug: str = Field(min_length=3, max_length=160)
    module: str = Field(min_length=2, max_length=80)
    title: str = Field(min_length=3, max_length=220)
    institution: str = Field(min_length=2, max_length=180)
    official_url: str = Field(min_length=10, max_length=500)
    requirements: str = Field(min_length=3)
    steps: str = Field(min_length=3)
    published: bool = True


class ServiceIn(BaseModel):
    slug_en: str = Field(min_length=3, max_length=120)
    slug_es: str = Field(min_length=3, max_length=120)
    category: str = Field(min_length=2, max_length=80)
    name_en: str = Field(min_length=2, max_length=180)
    name_es: str = Field(min_length=2, max_length=180)
    description_en: str = Field(min_length=2)
    description_es: str = Field(min_length=2)
    location: str = Field(min_length=2, max_length=120)
    provider: str | None = Field(default=None, max_length=180)
    whatsapp: str | None = Field(default=None, max_length=40)
    meta_title_en: str | None = Field(default=None, max_length=220)
    meta_title_es: str | None = Field(default=None, max_length=220)
    meta_description_en: str | None = Field(default=None, max_length=320)
    meta_description_es: str | None = Field(default=None, max_length=320)
    keywords_en: list[str] = Field(default_factory=list)
    keywords_es: list[str] = Field(default_factory=list)
    content_en: str | None = None
    content_es: str | None = None
    requirements_en: str | None = None
    requirements_es: str | None = None
    steps_en: str | None = None
    steps_es: str | None = None
    faq_en: list[dict[str, str]] = Field(default_factory=list)
    faq_es: list[dict[str, str]] = Field(default_factory=list)
    official_url: str | None = Field(default=None, max_length=500)
    image_url: str | None = Field(default=None, max_length=500)
    published: bool = True


class ServiceUpdate(BaseModel):
    slug_en: str | None = Field(default=None, min_length=3, max_length=120)
    slug_es: str | None = Field(default=None, min_length=3, max_length=120)
    category: str | None = Field(default=None, min_length=2, max_length=80)
    name_en: str | None = Field(default=None, min_length=2, max_length=180)
    name_es: str | None = Field(default=None, min_length=2, max_length=180)
    description_en: str | None = Field(default=None, min_length=2)
    description_es: str | None = Field(default=None, min_length=2)
    location: str | None = Field(default=None, min_length=2, max_length=120)
    provider: str | None = Field(default=None, max_length=180)
    whatsapp: str | None = Field(default=None, max_length=40)
    meta_title_en: str | None = Field(default=None, max_length=220)
    meta_title_es: str | None = Field(default=None, max_length=220)
    meta_description_en: str | None = Field(default=None, max_length=320)
    meta_description_es: str | None = Field(default=None, max_length=320)
    keywords_en: list[str] | None = None
    keywords_es: list[str] | None = None
    content_en: str | None = None
    content_es: str | None = None
    requirements_en: str | None = None
    requirements_es: str | None = None
    steps_en: str | None = None
    steps_es: str | None = None
    faq_en: list[dict[str, str]] | None = None
    faq_es: list[dict[str, str]] | None = None
    official_url: str | None = Field(default=None, max_length=500)
    image_url: str | None = Field(default=None, max_length=500)
    published: bool | None = None


def require_admin(x_admin_key: str = Header(default="")) -> None:
    if x_admin_key != settings.admin_api_key:
        raise HTTPException(status_code=401, detail="Invalid admin credentials")


def task_values(payload: TaskIn | TaskUpdate) -> dict:
    values = payload.model_dump(exclude_unset=True)
    if "variables" in values:
        values["variables"] = json.dumps(values["variables"], ensure_ascii=False)
    return values


def record_action(session: AsyncSession, request_id: int, action: str, details: dict | None = None) -> RequestAction:
    return RequestAction(request_id=request_id, action=action, details=json.dumps(details or {}, ensure_ascii=False, default=str))


def catalog_service(slug: str, category: str, name_en: str, name_es: str, provider: str) -> dict[str, str | None]:
    return {
        "slug": slug,
        "slug_en": slug,
        "slug_es": slug,
        "category": category,
        "name_en": name_en,
        "name_es": name_es,
        "description_en": f"Get clear guidance for {name_en.lower()} in Costa Rica.",
        "description_es": f"Recibe orientación clara para {name_es.lower()} en Costa Rica.",
        "location": "Costa Rica",
        "provider": provider,
        "whatsapp": None,
        "published": True,
    }


DEFAULT_SERVICES = [
    catalog_service("airport-transfer", "transport", "Airport transfer", "Transporte desde el aeropuerto", "TicoListo concierge"),
    catalog_service("paperwork-help", "paperwork", "Help with paperwork", "Asistencia con trámites", "TicoListo concierge"),
    catalog_service("housing-guidance", "housing", "Housing guidance", "Orientación para vivienda", "TicoListo concierge"),
    catalog_service("health-navigation", "health", "Health navigation", "Orientación de salud", "TicoListo concierge"),
    catalog_service("renew-drivers-license", "vehicles", "Renew a driver's license", "Renovar licencia de conducir", "COSEVI / Educación Vial"),
    catalog_service("first-drivers-license", "vehicles", "Get a first driver's license", "Sacar licencia por primera vez", "COSEVI / Educación Vial"),
    catalog_service("vehicle-inspection", "vehicles", "Vehicle technical inspection (DEKRA)", "Inspección técnica vehicular (DEKRA)", "DEKRA Costa Rica"),
    catalog_service("buy-used-vehicle", "vehicles", "Buy a used vehicle", "Comprar un vehículo usado", "Registro Nacional / notario"),
    catalog_service("sell-vehicle", "vehicles", "Sell a vehicle", "Vender un vehículo", "Registro Nacional / notario"),
    catalog_service("lost-id", "identity", "I lost my ID", "Perdí mi cédula", "Tribunal Supremo de Elecciones"),
    catalog_service("passport-renewal", "travel", "Renew or get a passport", "Renovar o sacar pasaporte", "Migración y Extranjería"),
    catalog_service("minor-passport", "family", "Passport for a minor", "Pasaporte para una persona menor", "Migración y Extranjería"),
    catalog_service("registry-certificate", "paperwork", "Get a registry certificate", "Obtener una certificación registral", "Registro Nacional"),
    catalog_service("buy-property", "property", "Buy a property", "Comprar una propiedad", "Registro Nacional / municipalidad / notario"),
    catalog_service("sell-property", "property", "Sell a property", "Vender una propiedad", "Registro Nacional / notario"),
    catalog_service("short-stay-rental", "property", "Operate a short-stay rental", "Quiero operar un alquiler de corta estancia", "Municipalidad / ICT / Hacienda según el caso"),
    catalog_service("create-company", "business", "Create a company", "Crear una sociedad", "Notario / Registro Nacional / Hacienda"),
    catalog_service("tax-obligations", "business", "Register or review tax obligations", "Inscribirme o revisar obligaciones en Hacienda", "Ministerio de Hacienda / TRIBU-CR"),
    catalog_service("municipal-license", "business", "Get a municipal business license", "Sacar patente municipal", "Municipalidad correspondiente"),
    catalog_service("health-permit", "business", "Sanitary operating permit", "Permiso Sanitario de Funcionamiento", "Ministerio de Salud"),
    catalog_service("self-employed", "business", "Start working independently", "Empezar a trabajar por cuenta propia", "Hacienda / CCSS según corresponda"),
    catalog_service("dismissal-next-steps", "work", "Organize next steps after dismissal", "Me despidieron: ordenar los siguientes pasos", "MTSS / CCSS / empleador según el caso"),
    catalog_service("birth-documents", "family", "Resolve birth documentation", "Registrar o resolver documentación de nacimiento", "Registro Civil / TSE"),
    catalog_service("civil-marriage", "family", "Prepare for a civil marriage", "Prepararme para contraer matrimonio civil", "Registro Civil / notario"),
    catalog_service("death-of-family-member", "family", "What to arrange after a family death", "Qué ordenar cuando fallece un familiar", "Registro Civil / CCSS / notario y otras entidades"),
    catalog_service("minor-international-travel", "travel", "Travel abroad with a minor", "Viajar fuera de Costa Rica con una persona menor", "Migración y Extranjería"),
    catalog_service("legal-status-certificate", "paperwork", "Get a legal status certificate", "Sacar una personería jurídica", "Registro Nacional"),
    catalog_service("marchamo", "vehicles", "Review and pay the marchamo", "Revisar y pagar el marchamo", "INS / entidades recaudadoras autorizadas"),
    catalog_service("business-checklist", "business", "Open a business: initial checklist", "Abrir un negocio: checklist inicial", "Municipalidad / Hacienda / Salud según actividad"),
    catalog_service("ccss-sick-leave", "health", "Organize a CCSS sick leave", "Ordenar una incapacidad de la CCSS", "Caja Costarricense de Seguro Social"),
]

DEFAULT_GUIDES = [
    {
        "slug": "licencia-de-conducir",
        "module": "Tránsito, licencias y vehículos",
        "title": "Renovar o sacar licencia de conducir",
        "institution": "COSEVI / Educación Vial",
        "official_url": "https://www.educacionvial.go.cr",
        "requirements": "Cédula o documento de identificación vigente, requisitos de Educación Vial y comprobante de pago cuando corresponda.",
        "steps": "1. Ingresa al portal oficial y revisa el tipo de licencia. 2. Consulta requisitos y disponibilidad de cita. 3. Realiza la prueba o renovación según corresponda. 4. Confirma la emisión o retiro del documento.",
    },
    {
        "slug": "pasaporte-y-permisos-de-salida",
        "module": "Identificación, pasaportes y registro civil",
        "title": "Renovar pasaporte o tramitar permiso para menor",
        "institution": "Dirección General de Migración y Extranjería",
        "official_url": "https://www.migracion.go.cr",
        "requirements": "Documento de identificación vigente, requisitos específicos del trámite y autorización de responsables cuando se trate de una persona menor.",
        "steps": "1. Consulta el requisito exacto en Migración. 2. Agenda la cita en el canal habilitado. 3. Presenta documentos y comprobantes. 4. Conserva la confirmación para retirar o recibir el documento.",
    },
    {
        "slug": "consulta-registro-propiedad",
        "module": "Propiedades y bienes inmuebles",
        "title": "Consultar propiedad, gravámenes o planos",
        "institution": "Registro Nacional",
        "official_url": "https://www.rnpdigital.com",
        "requirements": "Datos registrales o identificación del inmueble y medio de pago para la certificación solicitada.",
        "steps": "1. Ingresa a RNP Digital. 2. Selecciona la certificación o consulta. 3. Busca por los datos disponibles y paga el arancel. 4. Descarga y verifica el documento emitido.",
    },
    {
        "slug": "registro-hacienda-atv",
        "module": "Empresas, Hacienda, permisos y alquileres",
        "title": "Inscribirse o revisar obligaciones en Hacienda",
        "institution": "Ministerio de Hacienda / ATV",
        "official_url": "https://www.atv.hacienda.go.cr",
        "requirements": "Identificación, información de actividad económica y datos de contacto o representación cuando corresponda.",
        "steps": "1. Ingresa a ATV o al portal de Hacienda. 2. Accede al RUT o módulo correspondiente. 3. Completa o actualiza la información. 4. Guarda el comprobante y revisa las obligaciones generadas.",
    },
    {
        "slug": "citas-ccss-edus",
        "module": "Salud y seguridad social",
        "title": "Agendar una cita o revisar EDUS",
        "institution": "Caja Costarricense de Seguro Social",
        "official_url": "https://edus.ccss.sa.cr",
        "requirements": "Identificación, afiliación activa y datos de acceso al canal EDUS.",
        "steps": "1. Ingresa a EDUS. 2. Inicia sesión o completa el registro. 3. Selecciona citas, expediente o incapacidad. 4. Confirma la gestión y guarda el comprobante.",
    },
    {
        "slug": "derechos-laborales-liquidacion",
        "module": "Empleo y derechos laborales",
        "title": "Ordenar los siguientes pasos tras un despido",
        "institution": "Ministerio de Trabajo y Seguridad Social",
        "official_url": "https://www.mtss.go.cr",
        "requirements": "Contrato, comprobantes de pago, fechas laborales y documentos de terminación cuando estén disponibles.",
        "steps": "1. Reúne la documentación laboral. 2. Consulta la calculadora oficial de liquidación. 3. Verifica preaviso, cesantía, vacaciones y aguinaldo. 4. Solicita orientación o conciliación por los canales del MTSS.",
    },
    {
        "slug": "abrir-negocio-vui",
        "module": "Traslados, relocalización y vivienda",
        "title": "Abrir un negocio o resolver trámites unificados",
        "institution": "Ventanilla Única de Inversión / PROCOMER",
        "official_url": "https://vui.cr",
        "requirements": "Identificación, información del negocio, actividad económica y permisos sectoriales según el caso.",
        "steps": "1. Ingresa a VUI. 2. Identifica el trámite o actividad. 3. Completa la información y adjunta documentos. 4. Da seguimiento a cada institución desde el expediente.",
    },
]

DEFAULT_PORTALS = [
    ("COSEVI / Educación Vial", "https://www.educacionvial.go.cr"),
    ("DEKRA Costa Rica", "https://www.dekra.cr"),
    ("Tribunal Supremo de Elecciones", "https://www.tse.go.cr"),
    ("Migración y Extranjería", "https://www.migracion.go.cr"),
    ("Registro Nacional", "https://www.rnpdigital.com"),
    ("Ministerio de Hacienda / ATV", "https://www.atv.hacienda.go.cr"),
    ("VUI / PROCOMER", "https://vui.cr"),
    ("CCSS / EDUS", "https://edus.ccss.sa.cr"),
    ("Ministerio de Trabajo", "https://www.mtss.go.cr"),
    ("INS Marchamo", "https://www.ins-cr.com"),
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
    global portal_monitor_task
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
        await connection.execute(text("ALTER TABLE services ADD COLUMN IF NOT EXISTS provider VARCHAR(180)"))
        for column, definition in (
            ("slug_en", "VARCHAR(120)"), ("slug_es", "VARCHAR(120)"),
            ("meta_title_en", "VARCHAR(220)"), ("meta_title_es", "VARCHAR(220)"),
            ("meta_description_en", "VARCHAR(320)"), ("meta_description_es", "VARCHAR(320)"),
            ("keywords_en", "TEXT"), ("keywords_es", "TEXT"), ("content_en", "TEXT"),
            ("content_es", "TEXT"), ("requirements_en", "TEXT"), ("requirements_es", "TEXT"),
            ("steps_en", "TEXT"), ("steps_es", "TEXT"), ("faq_en", "TEXT"), ("faq_es", "TEXT"),
            ("official_url", "VARCHAR(500)"), ("image_url", "VARCHAR(500)"),
            ("published", "BOOLEAN DEFAULT TRUE"),
        ):
            await connection.execute(text(f"ALTER TABLE services ADD COLUMN IF NOT EXISTS {column} {definition}"))
        await connection.execute(text("CREATE INDEX IF NOT EXISTS ix_services_slug_en ON services (slug_en)"))
        await connection.execute(text("CREATE INDEX IF NOT EXISTS ix_services_slug_es ON services (slug_es)"))
        await connection.execute(text("UPDATE services SET slug_en = COALESCE(slug_en, slug), slug_es = COALESCE(slug_es, slug), published = COALESCE(published, TRUE)"))
        await connection.execute(text("ALTER TABLE assistance_requests ADD COLUMN IF NOT EXISTS assigned_to VARCHAR(120)"))
        await connection.execute(text("ALTER TABLE assistance_requests ADD COLUMN IF NOT EXISTS province VARCHAR(80)"))
        await connection.execute(text("ALTER TABLE assistance_requests ADD COLUMN IF NOT EXISTS tags TEXT DEFAULT ''"))
        await connection.execute(text("ALTER TABLE assistance_requests ADD COLUMN IF NOT EXISTS consent BOOLEAN DEFAULT FALSE"))
        await connection.execute(text("ALTER TABLE assistance_requests ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()"))
        await connection.execute(text("ALTER TABLE assistance_requests ADD COLUMN IF NOT EXISTS chat_token VARCHAR(64)"))
        await connection.execute(text("UPDATE assistance_requests SET chat_token = md5(random()::text || clock_timestamp()::text) WHERE chat_token IS NULL"))
        await connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_assistance_requests_chat_token ON assistance_requests (chat_token)"))
        await connection.execute(text("ALTER TABLE request_messages ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()"))
        for column, definition in (
            ("status", "VARCHAR(40) DEFAULT 'pending'"),
            ("priority", "VARCHAR(20) DEFAULT 'normal'"),
            ("alert_at", "TIMESTAMP"),
            ("variables", "TEXT DEFAULT '{}'"),
            ("portal_id", "INTEGER"),
            ("portal_status", "VARCHAR(30)"),
            ("portal_checked_at", "TIMESTAMP"),
        ):
            await connection.execute(text(f"ALTER TABLE tasks ADD COLUMN IF NOT EXISTS {column} {definition}"))
        await connection.execute(text("UPDATE tasks SET status = CASE WHEN completed THEN 'completed' ELSE COALESCE(status, 'pending') END, priority = COALESCE(priority, 'normal'), variables = COALESCE(variables, '{}')"))
    async with SessionLocal() as session:
        existing_slugs = set((await session.scalars(select(Service.slug))).all())
        missing_services = [
            Service(**service)
            for service in DEFAULT_SERVICES
            if service["slug"] not in existing_slugs
        ]
        if missing_services:
            session.add_all(missing_services)
            await session.commit()
        existing_guides = set((await session.scalars(select(Guide.slug))).all())
        missing_guides = [
            Guide(**guide) for guide in DEFAULT_GUIDES if guide["slug"] not in existing_guides
        ]
        if missing_guides:
            session.add_all(missing_guides)
            await session.commit()
        existing_portals = set((await session.scalars(select(OfficialPortal.url))).all())
        missing_portals = [OfficialPortal(name=name, url=url) for name, url in DEFAULT_PORTALS if url not in existing_portals]
        if missing_portals:
            session.add_all(missing_portals)
            await session.commit()
    if not os.getenv("VERCEL"):
        portal_monitor_task = asyncio.create_task(portal_monitor_loop())


async def portal_monitor_loop() -> None:
    while True:
        try:
            async with SessionLocal() as session:
                portals = list((await session.scalars(select(OfficialPortal))).all())
                results = await asyncio.gather(*(asyncio.to_thread(check_portal, portal.url) for portal in portals))
                now = datetime.utcnow()
                for portal, (status, code, error) in zip(portals, results):
                    portal.status, portal.status_code, portal.error, portal.checked_at = status, code, error, now
                await session.commit()
        except (OSError, RuntimeError, SQLAlchemyError) as error:
            logger.exception("Portal monitor cycle failed: %s", error)
        await asyncio.sleep(86400)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


def check_portal(url: str) -> tuple[str, int | None, str | None]:
    try:
        request = UrlRequest(url, method="HEAD", headers={"User-Agent": "TicoListo-PortalMonitor/1.0"})
        with urlopen(request, timeout=10) as response:
            return ("active" if response.status < 400 else "error", response.status, None)
    except (HTTPError, URLError, TimeoutError, OSError) as error:
        return "error", None, str(error)[:500]


@app.get("/services", response_model=list[ServiceOut])
async def list_services(
    category: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
) -> list[Service]:
    query = select(Service).where(Service.published.is_(True)).order_by(Service.id)
    if category:
        query = query.where(Service.category == category)
    return list((await session.scalars(query)).all())


def service_values(payload: ServiceIn | ServiceUpdate) -> dict:
    values = payload.model_dump(exclude_unset=isinstance(payload, ServiceUpdate))
    for field in ("keywords_en", "keywords_es", "faq_en", "faq_es"):
        if field in values:
            values[field] = json.dumps(values[field], ensure_ascii=False)
    if "slug_en" in values and values["slug_en"] is not None:
        values["slug"] = values["slug_en"]
    return values


@app.get("/services/{language}/{slug}", response_model=ServiceOut)
async def get_service_by_language(
    language: str,
    slug: str,
    session: AsyncSession = Depends(get_session),
) -> Service:
    if language not in {"en", "es"}:
        raise HTTPException(status_code=400, detail="Language must be en or es")
    slug_column = Service.slug_en if language == "en" else Service.slug_es
    service = await session.scalar(select(Service).where(slug_column == slug, Service.published.is_(True)))
    if service is None:
        raise HTTPException(status_code=404, detail="Service not found")
    return service


@app.get("/guides", response_model=list[GuideOut])
async def list_guides(
    module: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
) -> list[Guide]:
    query = select(Guide).where(Guide.published.is_(True)).order_by(Guide.id)
    if module:
        query = query.where(Guide.module == module)
    return list((await session.scalars(query)).all())


@app.get("/guides/{slug}", response_model=GuideOut)
async def get_guide(slug: str, session: AsyncSession = Depends(get_session)) -> Guide:
    guide = await session.scalar(select(Guide).where(Guide.slug == slug, Guide.published.is_(True)))
    if guide is None:
        raise HTTPException(status_code=404, detail="Guide not found")
    return guide


@app.post("/assistance-requests", response_model=AssistanceRequestOut, status_code=201)
async def create_request(
    payload: AssistanceRequestIn,
    session: AsyncSession = Depends(get_session),
) -> AssistanceRequest:
    values = payload.model_dump()
    values["tags"] = ",".join(values["tags"])
    request = AssistanceRequest(**values)
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


@app.get("/chat/{chat_token}", response_model=list[ChatMessageOut])
async def public_chat_messages(chat_token: str, session: AsyncSession = Depends(get_session)) -> list[RequestMessage]:
    request = await session.scalar(select(AssistanceRequest).where(AssistanceRequest.chat_token == chat_token))
    if request is None:
        raise HTTPException(status_code=404, detail="Chat not found")
    query = select(RequestMessage).where(RequestMessage.request_id == request.id).order_by(RequestMessage.id)
    return list((await session.scalars(query)).all())


@app.post("/chat/{chat_token}", response_model=ChatMessageOut, status_code=201)
async def public_chat_message(
    chat_token: str,
    payload: ChatMessageIn,
    session: AsyncSession = Depends(get_session),
) -> RequestMessage:
    request = await session.scalar(select(AssistanceRequest).where(AssistanceRequest.chat_token == chat_token))
    if request is None:
        raise HTTPException(status_code=404, detail="Chat not found")
    message = RequestMessage(request_id=request.id, author="Cliente", message=payload.message)
    session.add(message)
    if request.status == RequestStatus.new.value:
        request.status = RequestStatus.contacted.value
    await session.commit()
    await session.refresh(message)
    return message


@app.get("/admin/assistance-requests", response_model=list[AssistanceRequestOut], dependencies=[Depends(require_admin)])
async def admin_list_requests(
    status: RequestStatus | None = Query(default=None),
    search: str | None = Query(default=None, max_length=120),
    province: str | None = Query(default=None, max_length=80),
    tag: str | None = Query(default=None, max_length=80),
    session: AsyncSession = Depends(get_session),
) -> list[AssistanceRequest]:
    query = select(AssistanceRequest).order_by(AssistanceRequest.id.desc())
    if status:
        query = query.where(AssistanceRequest.status == status.value)
    if search:
        term = f"%{search}%"
        query = query.where(
            AssistanceRequest.name.ilike(term)
            | AssistanceRequest.email.ilike(term)
            | AssistanceRequest.phone.ilike(term)
            | AssistanceRequest.description.ilike(term)
        )
    if province:
        query = query.where(AssistanceRequest.province == province)
    if tag:
        query = query.where(AssistanceRequest.tags.ilike(f"%{tag}%"))
    return list((await session.scalars(query)).all())


@app.patch("/admin/assistance-requests/{request_id}", response_model=AssistanceRequestOut, dependencies=[Depends(require_admin)])
async def admin_update_request(
    request_id: int,
    payload: RequestUpdate,
    session: AsyncSession = Depends(get_session),
) -> AssistanceRequest:
    request = await session.get(AssistanceRequest, request_id)
    if request is None:
        raise HTTPException(status_code=404, detail="Assistance request not found")
    updates = payload.model_dump(exclude_unset=True)
    if "status" in updates and updates["status"] is not None:
        updates["status"] = updates["status"].value
    if "tags" in updates and updates["tags"] is not None:
        updates["tags"] = ",".join(updates["tags"])
    for key, value in updates.items():
        setattr(request, key, value)
    session.add(record_action(session, request_id, "request_updated", updates))
    await session.commit()
    await session.refresh(request)
    return request


@app.get("/admin/guides", response_model=list[GuideOut], dependencies=[Depends(require_admin)])
async def admin_list_guides(session: AsyncSession = Depends(get_session)) -> list[Guide]:
    return list((await session.scalars(select(Guide).order_by(Guide.id.desc()))).all())


@app.get("/admin/services", response_model=list[ServiceOut], dependencies=[Depends(require_admin)])
async def admin_list_services(session: AsyncSession = Depends(get_session)) -> list[Service]:
    return list((await session.scalars(select(Service).order_by(Service.id.desc()))).all())


@app.get("/admin/services/{service_id}", response_model=ServiceOut, dependencies=[Depends(require_admin)])
async def admin_get_service(service_id: int, session: AsyncSession = Depends(get_session)) -> Service:
    service = await session.get(Service, service_id)
    if service is None:
        raise HTTPException(status_code=404, detail="Service not found")
    return service


@app.post("/admin/services", response_model=ServiceOut, status_code=201, dependencies=[Depends(require_admin)])
async def admin_create_service(payload: ServiceIn, session: AsyncSession = Depends(get_session)) -> Service:
    if await session.scalar(select(Service).where((Service.slug_en == payload.slug_en) | (Service.slug_es == payload.slug_es))):
        raise HTTPException(status_code=409, detail="Service slug already exists")
    service = Service(**service_values(payload))
    session.add(service)
    await session.commit()
    await session.refresh(service)
    return service


@app.patch("/admin/services/{service_id}", response_model=ServiceOut, dependencies=[Depends(require_admin)])
async def admin_update_service(
    service_id: int,
    payload: ServiceUpdate,
    session: AsyncSession = Depends(get_session),
) -> Service:
    service = await session.get(Service, service_id)
    if service is None:
        raise HTTPException(status_code=404, detail="Service not found")
    values = service_values(payload)
    for slug_field in ("slug_en", "slug_es"):
        slug = values.get(slug_field)
        if slug and await session.scalar(select(Service).where(getattr(Service, slug_field) == slug, Service.id != service_id)):
            raise HTTPException(status_code=409, detail="Service slug already exists")
    for key, value in values.items():
        setattr(service, key, value)
    await session.commit()
    await session.refresh(service)
    return service


@app.put("/admin/services/{service_id}", response_model=ServiceOut, dependencies=[Depends(require_admin)])
async def admin_replace_service(
    service_id: int,
    payload: ServiceIn,
    session: AsyncSession = Depends(get_session),
) -> Service:
    service = await session.get(Service, service_id)
    if service is None:
        raise HTTPException(status_code=404, detail="Service not found")
    values = service_values(payload)
    duplicate = await session.scalar(
        select(Service).where(
            ((Service.slug_en == payload.slug_en) | (Service.slug_es == payload.slug_es)),
            Service.id != service_id,
        )
    )
    if duplicate:
        raise HTTPException(status_code=409, detail="Service slug already exists")
    for key, value in values.items():
        setattr(service, key, value)
    await session.commit()
    await session.refresh(service)
    return service


@app.delete("/admin/services/{service_id}", response_model=ServiceOut, dependencies=[Depends(require_admin)])
async def admin_delete_service(service_id: int, session: AsyncSession = Depends(get_session)) -> Service:
    service = await session.get(Service, service_id)
    if service is None:
        raise HTTPException(status_code=404, detail="Service not found")
    deleted = ServiceOut.model_validate(service)
    await session.delete(service)
    await session.commit()
    return deleted


@app.post("/admin/guides", response_model=GuideOut, status_code=201, dependencies=[Depends(require_admin)])
async def admin_create_guide(payload: GuideIn, session: AsyncSession = Depends(get_session)) -> Guide:
    if await session.scalar(select(Guide).where(Guide.slug == payload.slug)):
        raise HTTPException(status_code=409, detail="Guide slug already exists")
    guide = Guide(**payload.model_dump())
    session.add(guide)
    await session.commit()
    await session.refresh(guide)
    return guide


@app.post("/admin/assistance-requests/{request_id}/messages", status_code=201, dependencies=[Depends(require_admin)])
async def admin_add_message(
    request_id: int,
    payload: MessageIn,
    session: AsyncSession = Depends(get_session),
) -> dict[str, int]:
    if await session.get(AssistanceRequest, request_id) is None:
        raise HTTPException(status_code=404, detail="Assistance request not found")
    message = RequestMessage(request_id=request_id, **payload.model_dump())
    session.add(message)
    await session.commit()
    await session.refresh(message)
    return {"id": message.id}


@app.get("/admin/portals", response_model=list[PortalOut], dependencies=[Depends(require_admin)])
async def list_portals(session: AsyncSession = Depends(get_session)) -> list[OfficialPortal]:
    return list((await session.scalars(select(OfficialPortal).order_by(OfficialPortal.name))).all())


@app.post("/admin/portals/check", response_model=list[PortalOut], dependencies=[Depends(require_admin)])
async def check_portals(session: AsyncSession = Depends(get_session)) -> list[OfficialPortal]:
    portals = list((await session.scalars(select(OfficialPortal).order_by(OfficialPortal.id))).all())
    results = await asyncio.gather(*(asyncio.to_thread(check_portal, portal.url) for portal in portals))
    now = datetime.utcnow()
    for portal, (status, code, error) in zip(portals, results):
        portal.status, portal.status_code, portal.error, portal.checked_at = status, code, error, now
    await session.commit()
    return portals


@app.get("/admin/assistance-requests/{request_id}/tasks", response_model=list[TaskOut], dependencies=[Depends(require_admin)])
async def list_tasks(request_id: int, session: AsyncSession = Depends(get_session)) -> list[Task]:
    query = select(Task).where(Task.request_id == request_id).order_by(Task.due_at, Task.id)
    return list((await session.scalars(query)).all())


@app.get("/admin/assistance-requests/{request_id}/documents", response_model=list[DocumentOut], dependencies=[Depends(require_admin)])
async def list_documents(request_id: int, session: AsyncSession = Depends(get_session)) -> list[RequestDocument]:
    query = select(RequestDocument).where(RequestDocument.request_id == request_id).order_by(RequestDocument.id)
    return list((await session.scalars(query)).all())


@app.post("/admin/assistance-requests/{request_id}/documents", response_model=DocumentOut, status_code=201, dependencies=[Depends(require_admin)])
async def upload_document(
    request_id: int,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
) -> RequestDocument:
    if await session.get(AssistanceRequest, request_id) is None:
        raise HTTPException(status_code=404, detail="Assistance request not found")
    safe_name = Path(file.filename or "document").name
    if len(safe_name) > 255:
        raise HTTPException(status_code=400, detail="Filename is too long")
    storage_dir = Path(__file__).resolve().parent.parent / "storage" / "documents" / str(request_id)
    storage_dir.mkdir(parents=True, exist_ok=True)
    destination = storage_dir / safe_name
    destination.write_bytes(await file.read())
    document = RequestDocument(request_id=request_id, filename=safe_name, storage_path=str(destination))
    session.add(document)
    session.add(record_action(session, request_id, "document_uploaded", {"filename": safe_name}))
    await session.commit()
    await session.refresh(document)
    return document


@app.post("/admin/assistance-requests/{request_id}/tasks", response_model=TaskOut, status_code=201, dependencies=[Depends(require_admin)])
async def create_task(request_id: int, payload: TaskIn, session: AsyncSession = Depends(get_session)) -> Task:
    if await session.get(AssistanceRequest, request_id) is None:
        raise HTTPException(status_code=404, detail="Assistance request not found")
    task = Task(request_id=request_id, **task_values(payload))
    session.add(task)
    session.add(record_action(session, request_id, "calendar_event_created", payload.model_dump()))
    await session.commit()
    await session.refresh(task)
    return task


@app.get("/admin/calendar/events", response_model=list[TaskOut], dependencies=[Depends(require_admin)])
async def calendar_events(
    start: datetime | None = Query(default=None),
    end: datetime | None = Query(default=None),
    status: str | None = Query(default=None, max_length=40),
    priority: str | None = Query(default=None, max_length=20),
    request_id: int | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
) -> list[Task]:
    query = select(Task).order_by(Task.due_at, Task.id)
    if start:
        query = query.where(Task.due_at >= start)
    if end:
        query = query.where(Task.due_at <= end)
    if status:
        query = query.where(Task.status == status)
    if priority:
        query = query.where(Task.priority == priority)
    if request_id:
        query = query.where(Task.request_id == request_id)
    return list((await session.scalars(query)).all())


@app.patch("/admin/calendar/events/{task_id}", response_model=TaskOut, dependencies=[Depends(require_admin)])
async def update_calendar_event(
    task_id: int,
    payload: TaskUpdate,
    session: AsyncSession = Depends(get_session),
) -> Task:
    task = await session.get(Task, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Calendar event not found")
    values = task_values(payload)
    if values.get("completed") is True:
        values["status"] = "completed"
    for key, value in values.items():
        setattr(task, key, value)
    session.add(record_action(session, task.request_id, "calendar_event_updated", {"task_id": task_id, **values}))
    await session.commit()
    await session.refresh(task)
    return task


@app.get("/admin/assistance-requests/{request_id}/history", response_model=list[ActionOut], dependencies=[Depends(require_admin)])
async def request_history(request_id: int, session: AsyncSession = Depends(get_session)) -> list[RequestAction]:
    if await session.get(AssistanceRequest, request_id) is None:
        raise HTTPException(status_code=404, detail="Assistance request not found")
    query = select(RequestAction).where(RequestAction.request_id == request_id).order_by(RequestAction.id.desc())
    return list((await session.scalars(query)).all())


@app.get("/admin/calendar/alerts", response_model=list[TaskOut], dependencies=[Depends(require_admin)])
async def calendar_alerts(
    before: datetime | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
) -> list[Task]:
    cutoff = before or datetime.utcnow()
    query = select(Task).where(
        Task.alert_at.is_not(None),
        Task.alert_at <= cutoff,
        Task.status.not_in(("completed", "cancelled")),
    ).order_by(Task.alert_at)
    return list((await session.scalars(query)).all())


@app.post("/admin/calendar/events/{task_id}/verify-portal", response_model=TaskOut, dependencies=[Depends(require_admin)])
async def verify_event_portal(task_id: int, session: AsyncSession = Depends(get_session)) -> Task:
    task = await session.get(Task, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Calendar event not found")
    if task.portal_id is None:
        raise HTTPException(status_code=400, detail="Calendar event has no portal")
    portal = await session.get(OfficialPortal, task.portal_id)
    if portal is None:
        raise HTTPException(status_code=404, detail="Portal not found")
    status, code, error = await asyncio.to_thread(check_portal, portal.url)
    now = datetime.utcnow()
    task.portal_status, task.portal_checked_at = status, now
    portal.status, portal.status_code, portal.error, portal.checked_at = status, code, error, now
    session.add(record_action(session, task.request_id, "portal_verified", {"task_id": task_id, "status": status, "status_code": code}))
    await session.commit()
    await session.refresh(task)
    return task


@app.get("/admin/calendar/export.csv", dependencies=[Depends(require_admin)])
async def export_calendar_csv(session: AsyncSession = Depends(get_session)) -> Response:
    tasks = list((await session.scalars(select(Task).order_by(Task.due_at, Task.id))).all())
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["event_id", "request_id", "customer", "email", "title", "due_at", "status", "priority", "alert_at", "variables"])
    for task in tasks:
        request = await session.get(AssistanceRequest, task.request_id)
        writer.writerow([
            task.id, task.request_id, request.name if request else "", request.email if request else "",
            task.title, task.due_at.isoformat() if task.due_at else "", task.status, task.priority,
            task.alert_at.isoformat() if task.alert_at else "", task.variables,
        ])
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="ticolisto-calendar.csv"'},
    )


@app.get("/admin/notifications", response_model=list[NotificationOut], dependencies=[Depends(require_admin)])
async def list_notifications(session: AsyncSession = Depends(get_session)) -> list[Notification]:
    return list((await session.scalars(select(Notification).order_by(Notification.id.desc()).limit(100))).all())


@app.get("/admin/assistance-requests/{request_id}/messages", response_model=list[MessageOut], dependencies=[Depends(require_admin)])
async def admin_list_messages(
    request_id: int,
    session: AsyncSession = Depends(get_session),
) -> list[RequestMessage]:
    if await session.get(AssistanceRequest, request_id) is None:
        raise HTTPException(status_code=404, detail="Assistance request not found")
    query = select(RequestMessage).where(RequestMessage.request_id == request_id).order_by(RequestMessage.id)
    return list((await session.scalars(query)).all())
