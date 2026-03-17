# System Architecture

The Document Intelligence System is a decoupled, asynchronous, full-stack web application designed for robust and scalable PDF processing using generative AI. It consists of a React frontend and an Express Node.js backend, backed by **Supabase (PostgreSQL)** for persistence and **Redis/Bull** for background job management.

## Component Descriptions

- **Frontend (React + Vite):** A modern SPA built with Tailwind CSS, utilizing TanStack Query for robust data fetching and polling. Recharts is used for dashboard visualization. **Optimizations:** Implemented adaptive polling intervals and optimistic UI updates for manual corrections.
- **Backend (Node.js + Express):** A RESTful API that handles file uploads (Multer), data serving, and queuing. **Optimizations:** Parallelized file processing using `Promise.all` during upload to improve throughput for multi-file submissions.
- **Database (Supabase / PostgreSQL):** A cloud-hosted PostgreSQL database provided by Supabase. This migration from SQLite enables better scalability, centralized data management, and simplified deployment. **Optimizations:** Refined metrics aggregation to fetch only necessary fields, reducing memory overhead.
- **Message Queue (Bull + Redis):** Manages the asynchronous execution of PDF extraction tasks to ensure the main event loop remains unblocked.
- **AI Integration (@google/generative-ai):** Interfaces with Gemini models (defaulting to **Gemini 2.5 Flash Lite**, configurable via `GEMINI_MODEL`) to extract structured JSON from raw invoice text. **Optimizations:** Global singleton for the Gemini client to reduce initialization overhead.

## Full Async Data Flow

1. **Upload:** Client submits a multipart form request to `POST /api/documents`.
2. **Multer:** Middleware intercepts the request, validates the files, and provides file buffers.
3. **Parallel Processing:** For each file in the request:
   - **DB Insert:** Generate a UUID and insert a row into the Supabase `documents` table with a `PENDING` status.
   - **Supabase Storage:** Upload the file buffer to Supabase Storage.
   - **Bull Queue:** A job containing the storage path and document ID is added to the Redis-backed Bull queue.
4. **Immediate Response:** The server returns an HTTP 202 Accepted response after all files are queued.
5. **Worker:** A background worker picks up the job, updating the Supabase document status to `PROCESSING`.
... rest of the flow remains unchanged ...

8. **Gemini:** The text is injected into the selected prompt template and sent to the Gemini API for structured JSON extraction.
9. **Validate:** The result is passed through the Validation Service to check required fields, normalize dates/currencies, calculate math accuracy, and generate a confidence score.
10. **DB Update:** The extraction results and final status (`COMPLETED` or `FAILED`) are saved to the Supabase `extractions` and `documents` tables.
11. **API / React:** The frontend, which has been polling the `GET /api/documents` endpoint, receives the updated status and renders the extracted data.

## Why Bull + Redis?

Processing PDFs with LLMs can take several seconds per file. If this were done synchronously in the Express request handler:
- The HTTP request would hang, potentially timing out.
- The Node.js event loop could be blocked.
- A server restart during processing would lose the upload entirely.

Using Bull + Redis provides:
- **Non-blocking uploads:** Users get immediate feedback.
- **Automatic retries:** If the LLM API fails or returns malformed JSON, Bull can automatically retry the job based on backoff settings.
- **Job persistence:** Redis stores the queue state, meaning jobs are not lost if the Node.js process crashes.

## Architecture Diagram

```text
+-------------------+       HTTP POST       +----------------------+
|                   |---------------------->|                      |
|   React Frontend  |                       |   Express Backend    |
|   (Vite, Query)   |<----------------------|   (API, Multer)      |
|                   |       HTTP 202        |                      |
+---------+---------+                       +----------+-----------+
          ^                                            |
          | HTTP GET (Polling)                         | 1. Save file to disk
          |                                            | 2. Insert PENDING to DB
          |                                            v
+---------+---------+                       +----------+-----------+
|                   |     2. Read status    |                      |
|     Supabase      |<----------------------|     Bull Queue       |
|   (PostgreSQL)    |                       |     (Redis)          |
|                   |<----------------------|                      |
+---------+---------+     4. Update DB      +----------+-----------+
          ^               (COMPLETED)                  |
          |                                            | 3. Pick up job
          |                                            v
          |                                 +----------+-----------+
          +---------------------------------|                      |
                                            |   Worker Processor   |
                                            | (pdf-parse, Gemini)  |
                                            |                      |
                                            +----------+-----------+
                                                       |
                                                       v
                                            +----------+-----------+
                                            |                      |
                                            |  Google Gemini API   |
                                            |                      |
                                            +----------------------+
```
