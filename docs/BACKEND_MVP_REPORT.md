# RAES Core Backend MVP — informe final

Fecha: 2026-10-03, America/Bogota.

El backend MVP está completado y verificado contra el proyecto Supabase enlazado `raes-core`. La plataforma ciudadana permanece separada y sin cambios. No se hizo commit ni push; los cambios previos sin commit se conservaron.

## Fases completadas

| Fase | Resultado |
|---|---|
| 0 Baseline | Documentos/código/tipos/migraciones inspeccionados; typecheck/lint/44 pruebas iniciales pasaron; plan creado |
| 1 Autorización y errores | Guards reutilizables, admin separado, scopes/tipos/asociación institucional; errores estables y JSON limitado |
| 2 Lecturas de credenciales | Autenticación y scope; aislamiento institucional; PLATFORM requiere personId en colección; detalle por UUID correcto |
| 3 Personas | Endpoints generales admin; resolve idempotente/concurrente por identidad compuesta, ID solamente, sin sobrescritura |
| 4 Instituciones | Mutaciones admin auditadas; lecturas institucionales propias; estados explícitos |
| 5 Programas | Scopes read/write, propiedad en SELECT/UPDATE, institución derivada al crear; admin y sin PLATFORM |
| 6 Catálogos | Document/credential types activos y autenticados; sin CRUD global innecesario |
| 7 API clients | Administración create/list/rotate/revoke; hash/prefix solamente; clave completa una vez |
| 8 Auditoría | Cambios administrativos/API-client key lifecycle con auditoría transaccional; GET filtrado/paginado admin |
| 9 Importaciones | Batches existentes, 50 filas, identidad autenticada, bloqueo y subtransacciones; COMPLETED/PARTIAL/FAILED |
| 10 Ciclo de credenciales | Transacciones existentes preservadas; conflictos y propiedad verificados; sin DELETE ni PATCH genérico |
| 11 Exposición | Matriz de 29 operaciones; únicamente health público |
| 12 Límites | Paginación 20/100, UUID/enums/fechas, strings, metadata 16 KiB, body 256 KiB |
| 13 Base de datos | Dos migraciones nuevas aplicadas, tipos regenerados, ACL/RLS/constraints/advisors comprobados |
| 14 Seguridad | Pruebas BOLA/IDOR, scopes/tipos, hash/rotación, PII, errores, colecciones, administración y límites |
| 15 Tests | 122 pruebas aisladas y flujo real reproducible de 133 comprobaciones HTTP |
| 16 Verificación final | Typecheck/lint/tests/live HTTP y comprobaciones PostgreSQL pasan |
| 17 Documentación | Estado, API, seguridad, base, decisiones, arquitectura, matriz, plan y aceptación actualizados |

## Archivos creados en esta misión

Rutas bajo `apps/raes-api/src/app/api/v1/`:
- `persons/resolve/route.ts`
- `document-types/route.ts`
- `api-clients/[id]/rotate/route.ts`
- `audit-logs/route.ts`
- `credential-import-batches/route.ts`
- `credential-import-batches/[id]/route.ts`
- `credential-import-batches/[id]/credentials/route.ts`

Utilities bajo `apps/raes-api/src/lib/`:
- `api.ts`
- `credential-input.ts`
- `credential-read.ts`
- `person-input.ts`
- `institution-input.ts`
- `program-input.ts`
- `api-client-input.ts`

Pruebas:
- `apps/raes-api/tests/backend-security.test.mjs`
- `apps/raes-api/tests/backend-acceptance.mjs`

Documentos:
- `docs/exec-plans/complete-raes-core-backend.md`
- `docs/API_AUTHORIZATION_MATRIX.md`
- `docs/BACKEND_ACCEPTANCE_TESTING.md`
- `docs/BACKEND_MVP_REPORT.md`

## Archivos existentes modificados

- `apps/raes-api/package.json`: scripts typecheck/test/test:acceptance, sin dependencias nuevas.
- `apps/raes-api/src/lib/api-client-auth.ts`: conserva autenticación/hash/last_used_at, elimina impresión de errores DB internos.
- `apps/raes-api/src/types/database.ts`: regenerado desde Supabase.
- `apps/raes-api/tests/credential-machine-auth.test.mjs`: compatibilidad del loader con clases Error y ambas transiciones terminales opuestas.
- Rutas existentes: colección/detalle/revoke/void de credentials; colección/detalle de persons, institutions y programs; credential-types; api-clients colección y revoke.
- `docs/CURRENT_STATE.md`, `docs/API.md`, `docs/SECURITY.md`, `docs/DATABASE.md`, `docs/DECISIONS.md`, `docs/ARCHITECTURE.md`, `docs/MACHINE_AUTH_TESTING.md`.

Los helpers admin-auth, rutas/API clients previos y migraciones de autenticación ya existían al comenzar, aunque algunos eran archivos sin seguimiento Git. No se atribuyen como creación de esta misión. No se modificaron apps/platform, secretos, lockfile, tablas ni migraciones históricas.

## Migraciones creadas y aplicadas

- `supabase/migrations/20261004030126_complete_core_backend_mvp.sql`: fortalece checks de credenciales sin cambiar sus transacciones; agrega resolve_person, manage_core_resource, process_credential_import y un índice de auditoría.
- `supabase/migrations/20261004031223_isolate_invalid_import_rows.sql`: errores estructurales por fila sin conservar el input.

Creadas mediante Supabase CLI y aplicadas mediante MCP al proyecto enlazado. Nombres/versiones locales alineados al historial remoto. Verificación CLI confirma las diez migraciones locales/remotas coincidentes. Seis RPCs SECURITY INVOKER, ejecución solo service_role; diez tablas mantienen RLS y acceso directo anon/authenticated revocado.

## Endpoints y autorización

La matriz completa de las 29 operaciones, métodos, ADMIN/INSTITUTION/PLATFORM, scopes y reglas de propiedad está en [API_AUTHORIZATION_MATRIX.md](API_AUTHORIZATION_MATRIX.md). Los contratos y límites están en [API.md](API.md).

Nuevos flujos: resolución institucional, catálogo documental autenticado, rotación admin, consulta admin de auditoría e importaciones institucionales. Se elimina únicamente el POST accidental de la ruta detalle de credenciales; la creación válida sigue en POST /credentials.

## Resultados técnicos

| Verificación | Resultado |
|---|---|
| pnpm --filter raes-api exec tsc --noEmit | PASS |
| pnpm --filter raes-api lint | PASS |
| pnpm --filter raes-api test | 122 PASS, 0 fallos/skips |
| pnpm --filter raes-api test:acceptance | 133 comprobaciones HTTP PASS |
| Identidad compuesta/concurrencia de personas | PASS contra PostgreSQL real |
| Rotación/revocación/expiración/suspensión | PASS con clientes de prueba nuevos |
| Historia, actor y conflictos de credenciales | PASS; dos credenciales, cuatro eventos; sin eventos extra |
| Imports completos/parciales/fallidos/filas inválidas | PASS; contadores y asociación batch verificados |
| Procesamiento concurrente del mismo batch | PASS; 200 + 409, sin duplicación |
| Cambio administrativo + auditoría bajo rollback | PASS en probe SQL real |
| Funciones, RLS, grants y constraint compuesto | PASS inspección real |
| Advisors seguridad | 10 INFO intencionales RLS/no-policy; sin ERROR/WARN |
| Advisors performance | 16 INFO índices sin uso; sin ERROR/WARN |
| git diff --check | PASS |

Marcador final de datos de prueba: `RAES-MVP-TEST-36869ff0-cf68-49e4-84a6-c4eaaa18d0b1`. Sus cinco API clients están revocados. Se conservan credenciales, eventos y batches; no se borraron datos existentes. Una ejecución intermedia identificó el stream vacío de Next en rotación; fue corregido, añadido a regresión y repetido exitosamente. Los clientes de esa ejecución también se revocaron.

## Pendientes y límites reales

No quedan requisitos abiertos del backend MVP definido. No se realizó despliegue ni prueba de carga de producción. Fuera del alcance: ciudadanía/OCR/QR/compartir/verificación pública, corrección maestra de identidad, mutaciones globales de catálogos, cola/resume de imports y reemplazo de la clave admin del prototipo.

Próximo paso: apps/platform integra vía HTTPS con un cliente PLATFORM credentials:read. La plataforma debe validar la identidad/propiedad del ciudadano antes de determinar personId; nunca usa directamente la base Core ni FK entre bases.

## Comandos para revisión independiente

No queda una migración o reparación manual obligatoria. Para repetir:

```sh
pnpm --filter raes-api exec tsc --noEmit
pnpm --filter raes-api lint
pnpm --filter raes-api test
pnpm exec supabase migration list --linked
```

En terminales separadas:

```sh
pnpm --filter raes-api dev --port 3001
```

```sh
pnpm --filter raes-api test:acceptance
```

La prueba real carga el entorno server-side ya configurado sin imprimir secretos. Crea nuevos datos etiquetados y revoca sus propios clientes. Para comandos curl y SQL exactos, ver [BACKEND_ACCEPTANCE_TESTING.md](BACKEND_ACCEPTANCE_TESTING.md) y [MACHINE_AUTH_TESTING.md](MACHINE_AUTH_TESTING.md).
