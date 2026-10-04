# RAES Core API authorization matrix

All paths below are under `/api/v1`. Authentication uses `Authorization: Bearer <key>`.
ADMIN is the existing server-configured administrative key; INSTITUTION and PLATFORM are stored API clients. An admin key does not bypass machine scopes on credential endpoints.

| Endpoint | Method | Classification | ADMIN | INSTITUTION | PLATFORM | Scope | Ownership / context |
|---|---|---|---|---|---|---|---|
| /health | GET | PUBLIC | Yes | Yes | Yes | None | No registry data |
| /credentials | POST | INSTITUTION | No | Yes | No | credentials:write | Institution and provenance from client |
| /credentials | GET | MULTI-CLIENT | No | Yes | Yes | credentials:read | Own institution; PLATFORM requires personId |
| /credentials/:id | GET | MULTI-CLIENT | No | Yes | Yes | credentials:read | Own institution; PLATFORM known UUID |
| /credentials/:id/revoke | POST | INSTITUTION | No | Yes | No | credentials:revoke | API check + locked SQL ownership check |
| /credentials/:id/void | POST | INSTITUTION | No | Yes | No | credentials:revoke | API check + locked SQL ownership check |
| /persons | POST | ADMIN | Yes | No | No | Admin key | Audited master creation |
| /persons | GET | ADMIN | Yes | No | No | Admin key | Paginated master registry |
| /persons/:id | GET | ADMIN | Yes | No | No | Admin key | Administrative identity detail |
| /persons/resolve | POST | INSTITUTION | No | Yes | No | persons:resolve | Composite identity, no overwrite; returns ID only |
| /institutions | POST | ADMIN | Yes | No | No | Admin key | Audited creation |
| /institutions | GET | MULTI-CLIENT | Yes | Yes | No | Admin key / valid institutional client | Admin all; institution own record only |
| /institutions/:id | GET | MULTI-CLIENT | Yes | Yes | No | Admin key / valid institutional client | Admin any; institution own UUID only |
| /institutions/:id | PATCH | ADMIN | Yes | No | No | Admin key | Audited modification |
| /programs | POST | MULTI-CLIENT | Yes | Yes | No | Admin key / programs:write | Admin body institutionId; institution derived from key |
| /programs | GET | MULTI-CLIENT | Yes | Yes | No | Admin key / programs:read | Admin any; institution own rows |
| /programs/:id | GET | MULTI-CLIENT | Yes | Yes | No | Admin key / programs:read | Own institution predicate |
| /programs/:id | PATCH | MULTI-CLIENT | Yes | Yes | No | Admin key / programs:write | Own institution in UPDATE predicate; admin audited |
| /credential-types | GET | MULTI-CLIENT | No | Yes | Yes | Valid API client | Active catalog, paginated |
| /document-types | GET | MULTI-CLIENT | No | Yes | Yes | Valid API client | Active catalog, paginated |
| /api-clients | POST | ADMIN | Yes | No | No | Admin key | Key returned once; hash never returned |
| /api-clients | GET | ADMIN | Yes | No | No | Admin key | Paginated; no hash/full key |
| /api-clients/:id/rotate | POST | ADMIN | Yes | No | No | Admin key | Same client; new prefix/hash; audit atomic |
| /api-clients/:id/revoke | POST | ADMIN | Yes | No | No | Admin key | Revoke + audit atomic |
| /audit-logs | GET | ADMIN | Yes | No | No | Admin key | Paginated and filtered |
| /credential-import-batches | POST | INSTITUTION | No | Yes | No | imports:write | Institution/API client derived from key |
| /credential-import-batches | GET | INSTITUTION | No | Yes | No | imports:read | Own institution only |
| /credential-import-batches/:id | GET | INSTITUTION | No | Yes | No | imports:read | Own institution only |
| /credential-import-batches/:id/credentials | POST | INSTITUTION | No | Yes | No | imports:write + credentials:write | SQL rechecks institution and locks PENDING batch |

Foreign resource reads return 404 without disclosing whether the UUID exists. Foreign lifecycle/import writes return 403. Institutional collection filters cannot replace the authenticated institution.

The detail credential route now implements GET by UUID. Its accidental duplicated collection POST is removed; POST belongs only at `/credentials`. No DELETE routes, generic credential PATCH, public credential verification or catalog mutation endpoints exist.
