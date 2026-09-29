from enum import Enum
from typing import AsyncGenerator

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import String, Text, select, text
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
    assigned_to: Mapped[str | None] = mapped_column(String(120), nullable=True)


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
    name: str
    email: EmailStr
    phone: str
    location: str
    category: str
    description: str
    status: RequestStatus
    assigned_to: str | None = None

    model_config = {"from_attributes": True}


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


class MessageIn(BaseModel):
    author: str = Field(min_length=2, max_length=120)
    message: str = Field(min_length=1, max_length=5000)


class GuideIn(BaseModel):
    slug: str = Field(min_length=3, max_length=160)
    module: str = Field(min_length=2, max_length=80)
    title: str = Field(min_length=3, max_length=220)
    institution: str = Field(min_length=2, max_length=180)
    official_url: str = Field(min_length=10, max_length=500)
    requirements: str = Field(min_length=3)
    steps: str = Field(min_length=3)
    published: bool = True


def require_admin(x_admin_key: str = Header(default="")) -> None:
    if x_admin_key != settings.admin_api_key:
        raise HTTPException(status_code=401, detail="Invalid admin credentials")


def catalog_service(slug: str, category: str, name_en: str, name_es: str, provider: str) -> dict[str, str | None]:
    return {
        "slug": slug,
        "category": category,
        "name_en": name_en,
        "name_es": name_es,
        "description_en": f"Get clear guidance for {name_en.lower()} in Costa Rica.",
        "description_es": f"Recibe orientación clara para {name_es.lower()} en Costa Rica.",
        "location": "Costa Rica",
        "provider": provider,
        "whatsapp": None,
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
        await connection.execute(text("ALTER TABLE services ADD COLUMN IF NOT EXISTS provider VARCHAR(180)"))
        await connection.execute(text("ALTER TABLE assistance_requests ADD COLUMN IF NOT EXISTS assigned_to VARCHAR(120)"))
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


@app.get("/admin/assistance-requests", response_model=list[AssistanceRequestOut], dependencies=[Depends(require_admin)])
async def admin_list_requests(
    status: RequestStatus | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
) -> list[AssistanceRequest]:
    query = select(AssistanceRequest).order_by(AssistanceRequest.id.desc())
    if status:
        query = query.where(AssistanceRequest.status == status.value)
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
    for key, value in updates.items():
        setattr(request, key, value)
    await session.commit()
    await session.refresh(request)
    return request


@app.get("/admin/guides", response_model=list[GuideOut], dependencies=[Depends(require_admin)])
async def admin_list_guides(session: AsyncSession = Depends(get_session)) -> list[Guide]:
    return list((await session.scalars(select(Guide).order_by(Guide.id.desc()))).all())


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
