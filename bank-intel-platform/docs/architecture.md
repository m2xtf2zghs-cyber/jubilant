# Architecture

## Pipeline
1. Upload files -> create `Job` + `SourceFile`
2. Text extraction (`pdfplumber`, fallback `PyMuPDF`)
3. Adapter selection (`BankParserRegistry`)
4. Adapter parse -> `RawTransactionRow`
5. Normalize -> `CanonicalTransaction`
6. Classification + detection + entity resolution
7. Persist `Transaction` + `ParseException`
8. Export workbook (`ANALYSIS`, `XNS`, `PIVOT`, `ODD FIG`, `DOUBT`, `BANK FIN`, `PVT FIN`, `RETURN`, `CONS`, `FINAL`)

## Separation of concerns
- `app/parsers`: PDF and bank layout handling
- `app/narration`: narration cleaning/extraction
- `app/classification`: rule chain
- `app/detection`: special detectors
- `app/entity_resolution`: alias/fuzzy name normalization
- `app/services`: orchestration and DB persistence
- `app/workbook`: deterministic Excel generation
