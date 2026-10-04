# RAES Project Context

## What is RAES?

RAES is a platform for academic trust in Colombia.

Its objective is to manage, consult, share and verify academic credentials such as:

- degrees
- certificates
- courses
- diplomas
- academic attestations

The project is intended to evolve beyond a university prototype toward a realistic institutional or departmental pilot.

## Systems

RAES consists of two separate components.

### 1. RAES Core

Central registry and API.

Educational institutions report academic credentials to RAES.

RAES stores and manages the authoritative academic credential information.

Main actors:

- educational institutions
- RAES administrators
- institutional integrations
- Citizen Platform service integration

### 2. Citizen Platform

Separate web application.

Citizens can:

- register
- perform identity/document capture
- consult credentials associated with them
- visualize credentials
- share credentials
- eventually create controlled QR/link verification mechanisms

Third parties can eventually verify credentials through controlled verification flows.

## Important architectural boundary

The Citizen Platform does not access the RAES Core PostgreSQL database directly.

Correct:

Citizen Platform -> HTTPS -> RAES API -> RAES Database

Incorrect:

Citizen Platform -> RAES Database

There must be no physical foreign keys between the RAES Core database and the Citizen Platform database.

External references such as:

- `raes_persona_id`
- `raes_credencial_id`

may be stored by the Platform.

## Privacy

RAES must not provide an unrestricted public search such as:

"enter a Colombian document number and see all academic credentials."

Public verification should be based on explicit sharing/verification mechanisms.

## OCR

OCR belongs primarily to the Citizen Platform.

OCR is a capture and initial validation mechanism, not legal proof of identity.

Design should minimize retention of identity-document images.

Future OCR data should support:

- extracted fields
- confidence
- review reason
- processing timestamps
- cleanup/deletion strategy