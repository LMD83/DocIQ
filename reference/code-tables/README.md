# Code table reference CSVs

Source CSVs for the NEIS convention code tables seeded into Convex via
`convex/seed/seedData.ts`. Kept here for traceability.

**Important:** the Convex seed does NOT read these files at runtime. The data
is embedded as TypeScript constants in `seedData.ts` so seeds are reproducible
in any environment. If you need to update a code table:

1. Edit the CSV here
2. Regenerate the corresponding `const` in `convex/seed/seedData.ts`
3. Bump `NEIS_CONVENTION.version` if it's a semantically meaningful change
4. Run `npm run seed:conventions` (idempotent — safe to re-run)

These are the 8 code tables that compose the NEIS convention (Rev 11):

- `AcceptanceCodes.csv` — acceptance status (S/A/B/C/D) — metadata, not in filename
- `DisciplineCodes.csv` — discipline / role codes (2 chars)
- `ElementCodes.csv` — CWMF building/site element codes (2 digits)
- `InfoTypeCodes.csv` — information type codes (2 chars)
- `LevelCodes.csv` — floor/level codes (L##, M##, B##, DTM, XXX, ZZZ)
- `OriginatorRegister.csv` — organisation codes (2–5 chars)
- `PhaseCodes.csv` — project phase codes (PH##)
- `PurposeCodes.csv` — purpose codes (P00–P10) — metadata, not in filename
