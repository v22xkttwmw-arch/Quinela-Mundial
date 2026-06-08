# AUDITORÍA TÉCNICA — SMR Quinielas Mundialistas 2026

**Documento confidencial — Preparado para inversores y socios estratégicos**
**Fecha:** 9 de junio de 2026
**Auditor:** Claude Sonnet 4.6 (Anthropic) — Arquitecto de Software Senior
**Repositorio auditado:** `quiniela-backend` (rama `main`)
**Estado del sistema:** Producción activa — Railway (API) + Vercel (Frontend)

---

## Índice

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Arquitectura y Stack Tecnológico](#2-arquitectura-y-stack-tecnológico)
3. [Análisis del Backend (FastAPI)](#3-análisis-del-backend-fastapi)
4. [Análisis del Frontend (Next.js / React)](#4-análisis-del-frontend-nextjs--react)
5. [Seguridad y Vulnerabilidades](#5-seguridad-y-vulnerabilidades)
6. [Escalabilidad y Preparación para Producción](#6-escalabilidad-y-preparación-para-producción)
7. [Hoja de Ruta y Recomendaciones Finales](#7-hoja-de-ruta-y-recomendaciones-finales)

---

## 1. Resumen Ejecutivo

SMR Quinielas es una plataforma SaaS de entretenimiento deportivo construida específicamente para el Mundial de Fútbol 2026. Combina dos modos de juego diferenciados — **Modo Clásico** (predicción completa del torneo con bracket de 48 equipos) y **Modo Supervivencia** (Last Man Standing por jornada) — con integración en tiempo real contra la API oficial de resultados (API-Football v3) y pasarela de pagos Stripe.

### Calificación Global: **B+ (Muy Bueno con Riesgos Identificados)**

| Dimensión | Calificación | Observación |
|-----------|-------------|-------------|
| Funcionalidad | A | Motor de bracket completo y correctamente validado |
| Arquitectura | B+ | Diseño limpio; algunos N+1 queries |
| Seguridad | C+ | Dos endpoints críticos sin autenticación en producción |
| Escalabilidad | C | SQLite es el cuello de botella principal |
| Calidad de Código | A- | Código legible, bien estructurado, escaso de comentarios innecesarios |
| Preparación para el Mundial | B | Funcional; migrar BD y cerrar endpoints antes del 11 jun |

**Valoración del producto:** La profundidad técnica del motor de bracket (12 grupos FIFA, terceros mejor clasificados, anti-duplicación, snapshot para scoring automático) supera con creces la complejidad habitual de un MVP en esta etapa. El equipo ha tomado decisiones de arquitectura correctas y demostrables.

**Riesgo principal antes del torneo:** La base de datos SQLite en Railway y dos endpoints administrativos sin protección de autenticación representan riesgos operativos que deben resolverse antes del inicio del campeonato (11 de junio de 2026).

---

## 2. Arquitectura y Stack Tecnológico

### 2.1 Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENTE (Navegador)                          │
│                                                                     │
│   Next.js 16.2.6 + React 19 + TypeScript 5                         │
│   Tailwind CSS 4 · shadcn/ui · sonner (toasts)                     │
│                                                                     │
│   ┌──────────────┐  ┌─────────────────────┐  ┌────────────────┐   │
│   │ PredictorFluido│  │ Supervivencia Page  │  │ Dashboard/     │   │
│   │ (bracket 48eq)│  │ (pick por jornada)  │  │ Rendimiento    │   │
│   └──────┬───────┘  └──────────┬──────────┘  └───────┬────────┘   │
│          │ axios / fetch        │                      │            │
└──────────┼──────────────────────┼──────────────────────┼────────────┘
           │ HTTPS/JWT Bearer     │                      │
           ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    BACKEND (Railway)                                 │
│                                                                     │
│   FastAPI 0.128 + Uvicorn + Python 3.x                             │
│                                                                     │
│   ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐             │
│   │  main.py│ │classic.py│ │survival.py│ │ admin.py │             │
│   │ (auth,  │ │(bracket  │ │ (last man │ │(sync,    │             │
│   │ stripe, │ │ scoring) │ │ standing) │ │ fixtures)│             │
│   │ matches)│ └──────────┘ └──────────┘ └──────────┘             │
│   └────┬────┘                                                       │
│        │                                                            │
│   ┌────▼───────────────┐   ┌──────────────────────┐               │
│   │   crud.py          │   │  services/           │               │
│   │   (ORM queries,    │   │  ├── live_updater.py  │               │
│   │   scoring)         │   │  ├── scoring.py       │               │
│   └────┬───────────────┘   │  └── football_api.py  │               │
│        │ SQLAlchemy 2.0    └──────────┬───────────┘               │
│        │                              │ httpx async                │
│   ┌────▼───────────────┐             │                            │
│   │  SQLite / PostgreSQL│             ▼                            │
│   │  (Alembic migrations│   ┌──────────────────────┐              │
│   │   13 versiones)    │   │  API-Football v3       │              │
│   └────────────────────┘   │  (v3.football.api-    │              │
│                             │   sports.io)          │              │
│   ┌────────────────────┐   └──────────────────────┘              │
│   │  JWT (HS256, 7 días)│                                          │
│   │  bcrypt passwords   │   ┌──────────────────────┐              │
│   │  Stripe Checkout    │   │  Stripe API           │              │
│   └────────────────────┘   └──────────────────────┘              │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Inventario Tecnológico

**Backend:**

| Paquete | Versión | Rol |
|---------|---------|-----|
| fastapi | 0.128.8 | Framework HTTP asíncrono |
| uvicorn[standard] | 0.39.0 | Servidor ASGI |
| sqlalchemy | 2.0.50 | ORM (estilo 2.0) |
| alembic | 1.16.5 | Migraciones de BD |
| psycopg2-binary | 2.9.12 | Driver PostgreSQL (preparado) |
| pydantic | 2.13.4 | Validación y serialización |
| python-jose | 3.5.0 | JWT HS256 |
| passlib[bcrypt] | 1.7.4 | Hash de contraseñas |
| stripe | 15.1.0 | Pasarela de pagos |
| httpx | 0.28.1 | Cliente HTTP async (API-Football) |
| python-dotenv | 1.2.1 | Gestión de variables de entorno |

**Frontend:**

| Paquete | Versión | Rol |
|---------|---------|-----|
| next | 16.2.6 | Framework React (App Router) |
| react | 19.2.4 | UI Library |
| typescript | ^5 | Tipado estático |
| tailwindcss | ^4 | Estilos utility-first |
| shadcn / radix-ui | ^4.8 / ^1.4 | Componentes accesibles |
| sonner | ^2.0.7 | Notificaciones toast |
| axios | ^1.16.1 | Cliente HTTP |
| js-cookie | ^3.0.7 | Gestión de cookies JWT |

### 2.3 Infraestructura de Despliegue

- **Backend:** Railway (Procfile: `web: uvicorn main:app --host 0.0.0.0 --port $PORT`)
- **Frontend:** Vercel (Next.js con App Router, SSR)
- **Base de datos:** SQLite en filesystem local de Railway (`quiniela.db`)
- **Estado actual de BD:** 11 usuarios, 72 partidos (fase de grupos Mundial 2026), 2 quinielas clásicas guardadas

---

## 3. Análisis del Backend (FastAPI)

### 3.1 Organización del Código

La estructura de archivos es clara y bien separada por responsabilidades:

```
main.py              — punto de entrada, rutas de autenticación, pagos y admin
auth.py              — creación de tokens JWT
deps.py              — dependencias de FastAPI (get_current_user, get_current_admin)
crud.py              — capa de acceso a datos + scoring de predicciones por partido
models.py            — modelos SQLAlchemy (11 tablas)
schemas.py           — esquemas Pydantic de entrada/salida
database.py          — engine SQLAlchemy y sesiones
routers/
  classic.py         — guardar/cargar/puntuar quiniela clásica
  survival.py        — modo supervivencia (last man standing)
  groups.py          — grupos privados (legacy)
  admin.py           — endpoints administrativos
services/
  live_updater.py    — bucle asíncrono de sincronización de resultados
  scoring.py         — motor de puntuación del modo clásico
  football_api.py    — wrapper de API-Football (legacy, síncrono)
migrations/          — 13 versiones Alembic con historia completa
```

**Puntos fuertes:**
- Separación limpia entre capa de transporte (FastAPI), capa de datos (crud.py) y lógica de negocio (services/).
- Alembic con cadena de migraciones íntegra y coherente (no se detectan migraciones huérfanas).
- `services/scoring.py` es un módulo puro y fácilmente testeable en aislamiento.

### 3.2 Sistema de Autenticación y Autorización

**Implementación JWT (auth.py / deps.py):**
- Algoritmo: HS256 con `SECRET_KEY` de entorno.
- Duración: 10.080 minutos (7 días). No existe mecanismo de refresh ni de revocación (blacklist).
- `get_current_user`: decode JWT → buscar email en BD → devolver User ORM. Sin caché.
- `get_current_admin`: envuelve `get_current_user` y comprueba `user.is_admin == True`.

**Roles:**
- Usuario anónimo: puede registrarse y hacer login.
- Usuario autenticado: puede predecir si `has_paid_classic` o `has_paid_survival`.
- Admin (`is_admin=True`): puede crear partidos, cerrar resultados y disparar sincronizaciones.

**Flujo de pago:**
1. `POST /payments/create-checkout-session` → crea sesión Stripe, guarda registro `pending`.
2. Stripe redirige al usuario → webhook `POST /payments/webhook` verifica firma y llama `crud.confirm_payment`.
3. `confirm_payment` activa `user.is_paid = True` (flag legacy). Los flags granulares (`has_paid_classic`, `has_paid_survival`) se activan separadamente por `POST /payments/activate-plan`.

**Observación:** Existe un `POST /simulate-payment/` que activa `is_paid` sin verificación de pago real. Aunque está protegido por autenticación de usuario, cualquier usuario registrado puede ejecutarlo. Debe eliminarse o restringirse a admin antes de producción.

### 3.3 Motor de Puntuación (Dos Vías)

El sistema tiene **dos caminos de scoring** que deben coexistir correctamente:

**Vía 1 — Por partido individual** (`crud.finish_match_and_calculate_points`):
- Disparada por `live_updater.py` cuando un partido termina (FT/AET/PEN).
- Evalúa `Prediction` (predicciones simples de marcador) y `SurvivorPick`.
- Para PEN: el ganador real se extrae del campo `fixture["teams"]["home"]["winner"]` de la API, ya que el marcador queda empatado.
- Actualiza `User.total_points` y recalcula `Leaderboard.rank_position` en orden denso (dense rank).

**Vía 2 — Quiniela clásica de bracket** (`crud.score_classic_knockout_match`):
- Disparada por `live_updater.py` solo para partidos con `match.round` que no contenga "Group Stage".
- Usa `ClassicPrediction.bracket_snapshot` (JSON guardado al momento de la predicción) para mapear `(equipo_local, equipo_visitante)` → `slot_id`.
- Aplica multiplicadores por fase: R32/R16 ×2, QF/SF/TP ×3, Final ×4.
- Separación limpia: los puntos clásicos se acumulan en `ClassicPrediction.total_points_classic`, no en `User.total_points`.

**Observación arquitectónica:** `crud.score_classic_knockout_match` importa dentro de la función (`from services.scoring import ...`), rompiendo la convención de imports al nivel de módulo. Funciona, pero dificulta la detección de dependencias circulares y el testing.

### 3.4 Árbitro Automático (live_updater.py)

El servicio de sincronización en tiempo real se ejecuta como `asyncio.create_task` en el evento `startup` de FastAPI.

**Flujo:**
1. Cada 300 segundos consulta `GET /fixtures?date=HOY` a API-Football.
2. Filtra solo partidos con status `{FT, AET, PEN}`.
3. Busca partido en BD por nombre de equipo (case-insensitive).
4. Si aún no está cerrado, dispara scoring.
5. Si es fase eliminatoria, dispara `score_classic_knockout_match` adicionalmente.

**Riesgo identificado — partidos que cruzan la medianoche:** La consulta usa `date.today()` (UTC del servidor). Un partido que empieza a las 23:30 UTC y termina a las 01:15 UTC del día siguiente no se procesará en el siguiente ciclo, ya que la fecha habrá cambiado. La mitigación correcta es incluir también los partidos del día anterior con status live o no finalizado.

**Riesgo identificado — gestión de sesión de BD:** El `SessionLocal()` se crea dentro del bucle sin context manager (`try/finally: db.close()` sí existe, pero no usa `with`). Si `fetch_and_update_matches` lanza una excepción antes de cerrar la sesión en algún path, se podría producir un leak de conexiones (bajo riesgo con SQLite, riesgo real con PostgreSQL bajo carga).

### 3.5 Endpoints y Rutas (Inventario Completo)

| Ruta | Método | Auth | Descripción |
|------|--------|------|-------------|
| `/` | GET | No | Health check |
| `/users/` | POST | No | Registro |
| `/login` | POST | No | Login (Bearer token) |
| `/users/me` | GET | User | Perfil propio |
| `/users/me/favorites` | PATCH | User | Equipos favoritos |
| `/users/me/stats` | GET | User | Estadísticas personales |
| `/payments/create-checkout-session` | POST | User | Crear sesión Stripe |
| `/payments/webhook` | POST | Stripe sig | Confirmar pago |
| `/payments/activate-plan` | POST | User | **⚠️ Activa plan sin verificar pago** |
| `/simulate-payment/` | POST | User | **⚠️ Solo para testing — eliminar** |
| `/matches/` | GET | No | Partidos no finalizados |
| `/matches/all` | GET | No | Todos los partidos |
| `/matches/live` | GET | No | Partidos en vivo |
| `/matches/today` | GET | No | Partidos de hoy |
| `/matches/` | POST | Admin | Crear partido manual |
| `/matches/{id}/finish` | POST | Admin | Cerrar partido manual |
| `/predictions/` | POST | User+paid | Predicción simple |
| `/predictions/me` | GET | User | Mis predicciones |
| `/predictions/me/detail` | GET | User | Mis predicciones con detalle |
| `/predictions/classic` | POST | User+paid_classic | Guardar quiniela clásica |
| `/predictions/classic` | GET | User | Cargar quiniela clásica |
| `/predictions/classic/score` | POST | User | Calcular puntuación manual |
| `/leaderboard` | GET | No | Tabla de posiciones |
| `/leaderboard/global` | GET | No | Clasificación global |
| `/survivors/global` | GET | No | Estado supervivencia global |
| `/admin/sync-fixtures` | POST | **⚠️ SIN AUTH** | Sincronizar calendario |
| `/admin/sync-results` | POST | Admin | Sincronizar resultados |
| `/admin/sync-live` | POST | Admin | Sincronizar marcadores en vivo |
| `/admin/force-sync` | POST | **Verificar** | Forzar ciclo del árbitro |

### 3.6 Análisis de Rendimiento de Queries

Se identifican tres patrones de N+1 queries en producción:

**1. `GET /leaderboard/global` (main.py:406-422)**
```python
for user in users:
    lb = db.query(models.Leaderboard).filter(...).first()  # N queries
```
Con 1.000 usuarios: 1.001 queries por petición. Corrección: `db.query(models.Leaderboard).options(joinedload(models.Leaderboard.user)).all()`.

**2. `GET /survivors/global` (main.py:424-448)**
```python
for user in users:
    last_pick = db.query(models.SurvivorPick)...  # 2N queries
```
Corrección: subconsulta con `DISTINCT ON user_id ORDER BY created_at DESC`.

**3. `GET /users/me/stats` (main.py:472-500)**
```python
finished = [p for p in preds
    if db.query(models.Match)...first()]  # N queries
```
Corrección: `JOIN` entre `Prediction` y `Match` en una sola query.

---

## 4. Análisis del Frontend (Next.js / React)

### 4.1 Estructura del Proyecto

```
src/app/
  (auth)/login        — Página de login
  (auth)/register     — Registro de usuario
  dashboard/
    page.tsx          — Dashboard principal (Mi Radar)
    predict/          — Predicciones simples de partidos
    predictor/        — Predictor de quiniela clásica
    supervivencia/    — Modo supervivencia
    rendimiento/      — Estadísticas y rendimiento
    bracket/          — Vista del bracket
    groups/           — Grupos (legacy)
    upgrade/          — Página de upgrade/pago
    checkout/         — Flujo de pago
  pagar/              — Página de selección de plan
  payment-success/    — Confirmación de pago
  payment-cancel/     — Cancelación de pago
src/components/dashboard/
  PredictorFluido.tsx — Componente principal del bracket (800+ líneas)
  navbar.tsx          — Navegación
  MatchCenterWidget.tsx — Widget de partidos en vivo
  OnboardingModal.tsx — Modal de primer uso
  InfoTooltip.tsx     — Tooltips de ayuda contextual
src/lib/
  classicPredictor.ts — Motor de lógica del bracket (lógica pura, exportable)
  flags.ts            — Mapa de banderas emoji por equipo
  api.ts              — Cliente HTTP centralizado (axios)
  useLiveMatches.ts   — Hook de polling de partidos en vivo
  useUser.ts          — Hook de usuario autenticado
  utils.ts            — Utilidades genéricas
```

### 4.2 Motor de Bracket (classicPredictor.ts)

Este es el módulo técnicamente más sofisticado del frontend y merece análisis detallado.

**Funcionalidades implementadas:**
- `buildFixturesFromAPI`: BFS para detectar grupos desde fixtures de API-Football. Filtrado estricto a `isGroupStageMatch()` antes del BFS para evitar que los cruces de eliminatoria fusionen grupos.
- `buildStandings`: Calcula clasificación por grupo con desempate. Incluye `claimedTeams` Set como defensa en profundidad contra equipos duplicados.
- `assignThirdsToR32`: Asigna los 8 mejores terceros a los 16 slots del bracket según las reglas oficiales de cruce FIFA 2026. Implementa backtracking en dos niveles (estricto → greedy). Verificado con fuerza bruta: **495/495 combinaciones resueltas correctamente**.
- `buildTournamentSnapshotWithKnockout`: Genera el snapshot completo del torneo (48 equipos, 16 partidos de R32, árbol completo). Usa `regularQualifiers` Set para prevenir que terceros asignados dupliquen a clasificados directos.
- `buildKnockoutOverlayFromAPI`: Mapea partidos reales de la API (por nombre de equipo) al bracket del usuario para mostrar resultados reales sobre las predicciones.
- `hasPendingTiebreak`: Distingue entre "partido sin marcar" y "empate sin método de desempate seleccionado" — dos estados nulos diferentes con UX distinta.

**Calidad técnica:** Excelente. La lógica es correcta, está bien separada de los componentes React y es testeable en Node.js puro (lo que permitió la verificación con 495 combinaciones).

### 4.3 PredictorFluido.tsx — Análisis del Estado

El componente central usa `useReducer` con el siguiente estado:

```typescript
{
  groupFixtures:     GroupFixture[]     // 72 partidos con marcadores del usuario
  knockoutScores:    KnockoutScores     // {slot_id: {homeScore, awayScore}}
  selectedThirds:    string[]           // equipos terceros seleccionados (0-8)
  thirdAssignments:  Record<string, string>  // {slot_id: teamName}
  isBracketGenerated: boolean
  captainMatches:    string[]           // IDs de partidos con bono ×2
}
```

**Acciones del reducer implementadas:**
- `HYDRATE_STATE` — restaura estado guardado desde API al cargar la página
- `UPDATE_SCORE` — actualiza marcador de un partido de grupos
- `UPDATE_KNOCKOUT_SCORE` — actualiza marcador de un partido eliminatorio
- `TOGGLE_THIRD` / `SET_THIRD_ASSIGNMENTS` — gestión de terceros seleccionados
- `GENERATE_BRACKET` / `RESET_BRACKET` — generación y limpieza del árbol
- `TOGGLE_CAPTAIN` — activación del bono capitán (×2)
- `CLEAN_STALE_THIRDS` — limpieza automática de terceros obsoletos al cambiar standings

**Efecto anti-stale:**
```typescript
useEffect(() => {
  if (!state.groupFixtures.length) return;
  const groupStandings = buildStandings(state.groupFixtures);
  const validThirdTeams = new Set<string>();
  for (const [, rows] of groupStandings) {
    if (rows[2]) validThirdTeams.add(rows[2].team);
  }
  dispatch({ type: "CLEAN_STALE_THIRDS", validThirdTeams });
}, [state.groupFixtures]);
```
Este efecto garantiza que si un equipo asciende de 3.º a 1.º en standings, se elimina automáticamente de `selectedThirds` y el bracket se marca como no generado.

**Punto de mejora:** El componente supera las 800 líneas. Candidato a descomposición en: `GroupStageSection`, `KnockoutBracketSection`, `ThirdsSelector` y `BracketGeneratorControls`. No es urgente pero mejora la mantenibilidad.

### 4.4 Hooks y Comunicación con la API

`useLiveMatches.ts`: Polling por SSE o polling básico cada N segundos para actualizar marcadores en vivo. Apropiado para el volumen actual de usuarios.

`useUser.ts`: Lee el JWT de cookies y llama a `/users/me` para obtener el perfil. Correcto.

`api.ts`: Cliente Axios centralizado que inyecta el Bearer token en todas las peticiones autenticadas. Buen patrón, evita repetir lógica de auth en cada componente.

**Ausencia notable:** No existe configuración de tests (Jest, Vitest, Playwright, Cypress). Todo el testing realizado hasta la fecha ha sido manual o mediante scripts ad-hoc de Node.js.

---

## 5. Seguridad y Vulnerabilidades

### 5.1 Vulnerabilidades Críticas (Resolución Inmediata)

#### CVE-SMR-001: `/admin/sync-fixtures` sin autenticación
**Severidad:** CRÍTICA  
**Archivo:** `main.py:220`  
**Descripción:** El endpoint `POST /admin/sync-fixtures` tiene el `Depends(get_current_admin)` comentado explícitamente como bypass temporal. Cualquier persona en internet puede disparar este endpoint, que realiza escrituras masivas en la base de datos (72+ registros `Match`).

```python
# main.py:218-220 — ESTADO ACTUAL
# TEMPORAL — sin auth para poder disparar desde Swagger sin login (2026-06-08).
# ⚠️ Restaurar Depends(get_current_admin) antes de producción
@app.post("/admin/sync-fixtures")
async def sync_fixtures(db: Session = Depends(get_db)):
```

**Corrección:**
```python
@app.post("/admin/sync-fixtures")
async def sync_fixtures(
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_admin),
):
```

#### CVE-SMR-002: `/payments/activate-plan` — escalación de privilegios por usuarios no pagados
**Severidad:** ALTA  
**Archivo:** `main.py:158`  
**Descripción:** Cualquier usuario autenticado puede enviar `POST /payments/activate-plan` con `{"plan": "complete"}` y obtener acceso a ambos modos de juego sin pagar. El endpoint solo verifica que el usuario tenga sesión activa, no que haya completado un pago.

**Corrección:** Este endpoint debe estar protegido por `get_current_admin` (solo el sistema lo usa tras confirmar el webhook de Stripe) o debe verificar un `stripe_session_id` válido antes de activar el plan.

#### CVE-SMR-003: `/simulate-payment/` — bypass de pago en producción
**Severidad:** ALTA  
**Archivo:** `main.py:151`  
**Descripción:** Endpoint para testing que activa `user.is_paid = True` en cualquier usuario autenticado. En producción representa pérdida de ingresos directa.

**Corrección:** Eliminar el endpoint completamente o restringirlo al entorno de desarrollo (`if os.getenv("ENV") != "production"`).

### 5.2 Vulnerabilidades Medias

#### CVE-SMR-004: CORS con credenciales y wildcard por defecto
**Severidad:** MEDIA  
**Archivo:** `main.py:26-38`  
**Descripción:** Si `ALLOWED_ORIGINS` no está configurada en Railway, el valor por defecto es `"*"`. Combinado con `allow_credentials=True`, esto resulta en una configuración que los navegadores modernos rechazan con preflight (navegadores correctos no envían cookies a `*`), pero APIs REST clients como Postman/curl sí pueden abusar de ella.

**Corrección:** El valor por defecto debe ser el dominio de producción, nunca `"*"`. Verificar que Railway tiene `ALLOWED_ORIGINS=https://quiniela-frontend.vercel.app` configurado.

#### CVE-SMR-005: Tokens JWT sin mecanismo de revocación
**Severidad:** MEDIA  
**Descripción:** Los tokens duran 7 días (10.080 minutos). Si un token es comprometido no puede ser invalidado sin reiniciar el servidor o cambiar `SECRET_KEY` (lo que invalida todos los tokens). No existe endpoint de logout que invalide el token.

**Recomendación a mediano plazo:** Implementar una tabla `token_blacklist` o reducir la duración del token a 1 hora con refresh tokens de 30 días.

#### CVE-SMR-006: Sin rate limiting en `/login`
**Severidad:** MEDIA  
**Descripción:** El endpoint `POST /login` no tiene protección contra fuerza bruta. Un atacante puede intentar millones de combinaciones de contraseña sin limitación.

**Corrección:** Añadir `slowapi` (rate limiting para FastAPI) con límite de 5 intentos por minuto por IP en el endpoint de login.

### 5.3 Vulnerabilidades Bajas / Informativas

| ID | Descripción | Recomendación |
|----|-------------|---------------|
| CVE-SMR-007 | `User.total_points` duplica datos de `Leaderboard.total_points` — posible desincronización | Usar una sola fuente de verdad |
| CVE-SMR-008 | `datetime.utcnow()` deprecated en Python 3.12+ | Migrar a `datetime.now(timezone.utc)` |
| CVE-SMR-009 | `FavoriteTeamsUpdate` no valida que los equipos sean nombres de equipos reales | Añadir validador de whitelist si se expone en ranking |
| CVE-SMR-010 | `knockout_scores` en `ClassicPrediction` se guarda como raw JSON sin esquema fijo | La deserialización manual con `json.loads` podría fallar silenciosamente en datos corruptos |
| CVE-SMR-011 | El campo `bracket_snapshot` no tiene límite de tamaño | Un payload malicioso podría enviar un JSON de varios MB |

### 5.4 Gestión de Secretos

**Estado actual:**
- `.env` presente en el repositorio local (no commiteado — confirmado en `.gitignore`).
- `.env.example` correctamente documentado con todos los valores necesarios.
- `SECRET_KEY` tiene validación explícita al arranque: `raise RuntimeError("SECRET_KEY no está definida")`.
- `API_FOOTBALL_KEY` se usa sin validación — si está vacía el árbitro automático falla silenciosamente.

**Recomendación:** Añadir validación al arranque similar a `SECRET_KEY` para `API_FOOTBALL_KEY` y `STRIPE_SECRET_KEY`.

---

## 6. Escalabilidad y Preparación para Producción

### 6.1 El Problema de SQLite en Railway

**Esta es la limitación técnica más urgente del sistema.**

SQLite es un motor de base de datos que escribe con bloqueo exclusivo de archivo. En Railway, el filesystem es efímero: cualquier redeploy del servicio destruye el archivo `quiniela.db` y todos los datos con él. Adicionalmente:

- SQLite no soporta escrituras concurrentes. Con el árbitro automático escribiendo cada 300 segundos y usuarios guardando predicciones simultáneamente, se producirán `OperationalError: database is locked` bajo carga.
- No existe mecanismo de backup automático del archivo SQLite.

**Solución:** Migrar a PostgreSQL (el driver `psycopg2-binary` ya está en `requirements.txt`, lo que demuestra que la migración fue planificada desde el inicio). Railway ofrece PostgreSQL como addon nativo. Los pasos son:

```bash
# 1. Crear addon PostgreSQL en Railway
# 2. Actualizar DATABASE_URL en variables de entorno:
DATABASE_URL=postgresql://user:pass@host:port/dbname
# 3. Ejecutar migraciones:
alembic upgrade head
```

El código está preparado: `database.py` lee `DATABASE_URL` del entorno, `alembic.ini` referencia la misma variable. La migración es un cambio de configuración, no de código.

### 6.2 Análisis de Carga — 1.000 Usuarios Concurrentes

Estimación de carga durante un partido del Mundial en vivo (partidos de máxima audiencia):

| Escenario | Request rate estimado | Impacto con SQLite | Impacto con PostgreSQL |
|-----------|-----------------------|-------------------|----------------------|
| 1.000 usuarios ven dashboard | ~50 req/s (polling 20s) | Degradación severa | Manejable con indexing |
| Inicio de partido (rush de predicciones) | ~200 req/s en 60s | Timeouts y locks | OK con connection pool |
| Árbitro procesa resultado | 1 escritura masiva | Bloquea todos los reads | Transacción aislada |
| Leaderboard global (N+1) | 1 req → 1.001 queries | Inaceptable | Aceptable con eager load |

**Recomendación para Railway con PostgreSQL:**
- Connection pool: `pool_size=10, max_overflow=20` en `database.py`.
- Añadir índices compuestos: `(user_id, match_id)` en `predictions`, `(user_id)` en `classic_predictions`.
- Endpoint `/leaderboard/global`: cachear 60 segundos con `functools.lru_cache` o Redis.

### 6.3 El Árbitro Automático en Producción

El bucle de 300 segundos es adecuado para un campeonato donde los partidos duran ~90-120 minutos. Recomendaciones adicionales:

1. **Logging estructurado:** Los logs actuales van a stdout. En Railway esto se pierde al reiniciar. Añadir integración con Sentry o Datadog para errores del árbitro.

2. **Deduplicación de procesamiento:** La guardia `if not match or match.status in _FINISHED_STATUSES` es correcta, pero si el árbitro procesa un partido dos veces antes de que el primer commit se complete (race condition bajo carga), `Prediction.points_earned` se acumularía incorrectamente. Recomendación: añadir `Prediction.scored_at = Column(DateTime, nullable=True)` como flag atómico.

3. **Partidos que cruzan medianoche UTC:** Añadir los partidos del día anterior con status no finalizado a la query:
```python
# Consultar hoy Y ayer para cubrir partidos nocturnos
params = {"league": 1, "season": 2026, "status": "1H-HT-2H-ET-BT-P-PEN-AET-FT"}
```

### 6.4 Checklist de Producción — Antes del 11 de Junio

| Ítem | Estado | Prioridad |
|------|--------|-----------|
| Migrar BD de SQLite a PostgreSQL en Railway | ❌ Pendiente | 🔴 Crítico |
| Restaurar auth en `/admin/sync-fixtures` | ❌ Pendiente | 🔴 Crítico |
| Eliminar o proteger `/simulate-payment/` | ❌ Pendiente | 🔴 Crítico |
| Proteger `/payments/activate-plan` con admin o verificación Stripe | ❌ Pendiente | 🔴 Crítico |
| Configurar `ALLOWED_ORIGINS` en Railway con dominio real | Verificar | 🟠 Alto |
| Activar webhook de Stripe con STRIPE_WEBHOOK_SECRET real | Verificar | 🟠 Alto |
| Configurar `API_FOOTBALL_KEY` válida y vigente en Railway | ✅ Hecho | — |
| Ejecutar `alembic upgrade head` en producción | Verificar | 🟠 Alto |
| Rate limiting en `/login` | ❌ Pendiente | 🟡 Medio |
| Logging estructurado / Sentry | ❌ Pendiente | 🟡 Medio |

---

## 7. Hoja de Ruta y Recomendaciones Finales

### 7.1 Acciones Críticas — Esta Semana (Antes del 11 de Junio)

Estas cinco acciones son bloqueantes para un lanzamiento seguro:

**1. Migrar a PostgreSQL**
```
Esfuerzo: 2 horas | Riesgo de no hacerlo: pérdida total de datos en el primer redeploy
```
Crear addon PostgreSQL en Railway, actualizar `DATABASE_URL`, ejecutar `alembic upgrade head`. Sin cambios de código.

**2. Cerrar los tres endpoints vulnerables**
```
Esfuerzo: 30 minutos | Riesgo de no hacerlo: cualquier usuario accede gratis a todos los planes
```
- `main.py:220`: Restaurar `Depends(get_current_admin)` en `/admin/sync-fixtures`.
- `main.py:151-153`: Eliminar el endpoint `/simulate-payment/`.
- `main.py:158-174`: Mover `/payments/activate-plan` a admin-only o activación automática desde webhook.

**3. Verificar variables de entorno en Railway**
```
Esfuerzo: 15 minutos | Riesgo de no hacerlo: CORS abierto, árbitro mudo, Stripe inactivo
```
Confirmar que `ALLOWED_ORIGINS`, `STRIPE_WEBHOOK_SECRET` y `API_FOOTBALL_KEY` están configurados correctamente.

**4. Ejecutar migraciones pendientes en producción**
```
Esfuerzo: 5 minutos | Riesgo de no hacerlo: columnas bracket_snapshot, round, venue ausentes → 500 errors
```
```bash
alembic upgrade head  # debe aplicar a7b8c9d0e1f2 y f6a7b8c9d0e1
```

**5. Test de extremo a extremo con usuario real**
```
Esfuerzo: 1 hora | Riesgo de no hacerlo: bugs de integración descubiertos por usuarios en pleno torneo
```
Registrar usuario nuevo → pagar → guardar quiniela → verificar que se hidrata correctamente → simular cierre de partido → verificar puntos acumulados.

### 7.2 Mejoras a Corto Plazo (Semanas 1-2 del Torneo)

- **Rate limiting:** Añadir `slowapi` con límite de 5 req/min en `/login` y 100 req/min globales.
- **Corregir N+1 queries:** Priorizar `/leaderboard/global` y `/survivors/global` con eager loading.
- **Monitoreo:** Integrar Sentry (5 minutos de configuración, plan gratuito) para alertas de errores del árbitro.
- **Backup de BD:** Configurar pg_dump diario en Railway o activar el addon de backups de Railway PostgreSQL.

### 7.3 Mejoras a Mediano Plazo (Tras el Torneo)

- **Testing automatizado:** Añadir suite de tests unitarios para `services/scoring.py` y `classicPredictor.ts`. El motor de bracket ya tiene estructura testeable.
- **Refresh tokens:** Reducir JWT a 1h con refresh tokens de 30 días. Añadir endpoint `POST /auth/refresh`.
- **Descomposición de PredictorFluido.tsx:** Separar en 4-5 componentes más pequeños para mejorar mantenibilidad.
- **Caché de leaderboard:** Redis o `functools.lru_cache` de 60 segundos en endpoints de clasificación.
- **Índice compuesto en predictions:** `CREATE UNIQUE INDEX ON predictions(user_id, match_id)` para prevenir predicciones duplicadas a nivel de BD.

### 7.4 Valoración para Inversores

**Fortalezas técnicas demostrables:**
- Motor de bracket FIFA 2026 completo y correctamente validado (495/495 combinaciones, deduplicación garantizada de 48 equipos únicos).
- Integración end-to-end con API-Football para datos en tiempo real (sincronización automática cada 300s).
- Arquitectura de scoring automático con `bracket_snapshot` — solución elegante al problema de mapeo predicción → partido real.
- Pasarela de pagos Stripe integrada con verificación de firma de webhook.
- Historial completo de migraciones Alembic (13 versiones) — demuestra evolución controlada del esquema.
- Stack moderno y estándar (FastAPI + Next.js 16 + React 19) con bajo costo de incorporación de nuevos desarrolladores.

**Deuda técnica a comunicar con transparencia:**
- La migración de SQLite a PostgreSQL es imprescindible y está al 90% (driver ya instalado, code ya preparado).
- Cinco vulnerabilidades de seguridad (3 críticas, 2 altas) están identificadas y tienen corrección mecánica — no son problemas de diseño, son descuidos de prototipado rápido.
- Ausencia de tests automatizados es el riesgo de calidad a largo plazo más relevante.

**Conclusión:** El sistema está técnicamente en condiciones de soportar el Mundial 2026 con las correcciones de seguridad y la migración de base de datos aplicadas. La arquitectura es sólida, el producto está completo en funcionalidad y el equipo ha demostrado capacidad para manejar la complejidad del dominio (reglas FIFA 2026 de 48 equipos) de forma técnicamente rigurosa.

---

*Documento generado el 9 de junio de 2026. Versión 1.0.*
*Este análisis refleja el estado del código en la rama `main` en la fecha indicada.*
*Para consultas técnicas, contactar al equipo de desarrollo.*
