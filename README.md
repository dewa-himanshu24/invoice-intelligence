# Document Intelligence System

A complete full-stack system for processing and extracting data from invoice PDFs using Google Gemini 2.5 Flash.

## Overview
This system allows users to upload PDF invoices, queues them for asynchronous processing, and extracts structured data (Vendor Name, Invoice Number, Date, Currency, Totals, and Line Items) using an LLM. It includes a React dashboard for monitoring status, reviewing extracted data, correcting errors, and analyzing system metrics.

## Prerequisites
- Node.js 18+
- npm
- Redis (running locally on default port 6379)
- Google Gemini API Key
- Supabase Account (for PostgreSQL)

## Setup Steps

1. **Install and Start Redis:**
   - macOS: `brew install redis && redis-server`
   - Ubuntu/Debian: `sudo apt install redis && sudo systemctl start redis`

2. **Supabase Database Setup:**
   - Create a new project on [Supabase](https://supabase.com).
   - In the SQL Editor, run the following SQL to create the necessary tables:
     ```sql
     -- 1. Create Documents Table
     CREATE TABLE documents (
         id UUID PRIMARY KEY,
         filename TEXT NOT NULL,
         file_path TEXT NOT NULL,
         status TEXT NOT NULL DEFAULT 'PENDING',
         prompt_version TEXT,
         processing_ms INTEGER,
         error_message TEXT,
         created_at TIMESTAMPTZ DEFAULT now(),
         updated_at TIMESTAMPTZ DEFAULT now()
     );

     -- 2. Create Extractions Table
     CREATE TABLE extractions (
         id UUID PRIMARY KEY,
         document_id UUID NOT NULL UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
         vendor_name TEXT,
         invoice_number TEXT,
         invoice_date TEXT,
         currency TEXT,
         total_amount DECIMAL,
         tax_amount DECIMAL,
         line_items JSONB,
         raw_json JSONB,
         confidence_score DECIMAL,
         validation_errors JSONB,
         missing_fields JSONB,
         is_valid BOOLEAN,
         corrected_data JSONB,
         created_at TIMESTAMPTZ DEFAULT now()
     );
     ```

3. **Backend Setup:**
   ```bash
   cd backend
   npm install
   cp .env.example .env
   # Edit .env and add:
   # - GEMINI_API_KEY
   # - SUPABASE_URL
   # - SUPABASE_ANON_KEY
   mkdir -p uploads
   npm run dev
   ```
   The backend will start on `http://localhost:3000`.

4. **Frontend Setup:**
   Open a new terminal:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   The frontend will be available at `http://localhost:5173`.

## How the Queue Works
To prevent the web server from blocking during long LLM calls, the system uses an asynchronous processing pattern:
1. The user uploads PDFs via the `POST /api/documents` endpoint.
2. Files are saved to disk, Supabase document rows are inserted with a status of `PENDING`, and jobs are added to a Bull queue.
3. The API immediately returns an HTTP 202 Accepted response.
4. A background worker picks up the jobs from the Redis queue, updates the status to `PROCESSING` in Supabase, calls the Gemini API, runs validation, and saves the final result (marking it `COMPLETED` or `FAILED`).
5. The React frontend polls `GET /api/documents` to show real-time status updates to the user.

## Prompt Versioning
The system supports different extraction prompts. The active prompt is configured via `PROMPT_VERSION` in the `.env` file.
- `v1`: A basic JSON extraction prompt.
- `v2`: An advanced prompt optimized for token usage and JSON reliability.

## API Reference

### Upload Invoices
```bash
curl -X POST http://localhost:3000/api/documents \
  -F "invoices=@invoice1.pdf" \
  -F "invoices=@invoice2.pdf"
```

### List Documents
```bash
curl http://localhost:3000/api/documents
# With status filter:
curl "http://localhost:3000/api/documents?status=FAILED"
```

### Get Single Document
```bash
curl http://localhost:3000/api/documents/<document-id>
```

### Update Corrections
```bash
curl -X PATCH http://localhost:3000/api/documents/<document-id> \
  -H "Content-Type: application/json" \
  -d '{"vendor_name": "Corrected Vendor Inc", "total_amount": 1000}'
```

### Reprocess Document
```bash
curl -X POST http://localhost:3000/api/reprocess/<document-id>
```

### Get Metrics
```bash
curl http://localhost:3000/api/metrics
```
