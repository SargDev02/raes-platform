# RAES Execution Plans

For substantial features, migrations, security changes, or refactors, create an execution plan before modifying code.

A plan should contain:

## Goal

What must work when this stage is complete.

## Existing state

What already exists and must not be recreated.

## Files involved

Expected files to create or modify.

## Database impact

Migrations, tables, functions, indexes or policies affected.

## API impact

Endpoints or contracts affected.

## Security considerations

Authentication, authorization, data exposure and secrets.

## Implementation

Ordered implementation steps.

## Verification

Commands/tests that demonstrate the stage works.

## Result

Update this section once completed with what actually changed.

Plans should be stored in:

`docs/exec-plans/`

and committed when they represent important project history.