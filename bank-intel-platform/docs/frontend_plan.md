# Frontend Plan (Analyst UI)

Backend-first implementation is completed in this repo. Frontend should be implemented as a thin analyst console with these modules:

1. Upload Screen
- multi-file PDF upload
- create/parse job action

2. Jobs Screen
- list jobs
- status badges
- open job detail

3. Transaction Review Grid
- filters: account, month, classification, confidence
- inline edits for classification / normalized party / notes
- save override action

4. Exceptions Screen
- unresolved parsing or recon issues

5. Export Screen
- generate workbook
- download latest workbook

Suggested stack:
- Next.js + TanStack Table + React Query
- UI token set focused on data density
