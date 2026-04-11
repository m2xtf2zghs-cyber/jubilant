# API Examples

## Upload and parse
```bash
curl -X POST http://localhost:8000/api/parse/upload \
  -F "job_name=Dhara BOI Parse" \
  -F $'borrower_rules_yaml=manual_overrides:\n  global:\n    \"RTGS/ABC PARTY|C\": SALES\nsister_concerns:\n  map:\n    AFFAN METALS: AFFAN METALS' \
  -F "files=@/path/BOI Jan'26.pdf" \
  -F "files=@/path/BOI Feb'26.pdf"
```

## List jobs
```bash
curl http://localhost:8000/api/jobs
```

## Transactions for a job
```bash
curl http://localhost:8000/api/jobs/<JOB_ID>/transactions
```

## Update borrower YAML rules
```bash
curl -X PUT http://localhost:8000/api/jobs/<JOB_ID>/rules \
  -H "Content-Type: application/json" \
  -d '{
    "borrower_rules_yaml": "manual_overrides:\n  global:\n    \"RTGS/ABC PARTY|C\": SALES\nsister_concerns:\n  map:\n    VARUN FILL: VARUN FILL"
  }'
```

## Apply override
```bash
curl -X POST http://localhost:8000/api/overrides/<JOB_ID> \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_id": 101,
    "classification_primary": "BANK FIN",
    "classification_secondary": "EMI",
    "normalized_party": "HDFC BANK",
    "analyst_notes": "manual override"
  }'
```

## Export workbook
```bash
curl -X POST http://localhost:8000/api/exports/<JOB_ID>
curl -L http://localhost:8000/api/exports/<JOB_ID>/latest -o output.xlsx
```
