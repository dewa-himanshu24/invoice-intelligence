# System Architecture

The Document Intelligence System is a decoupled, asynchronous, full-stack web application designed for robust and scalable PDF processing using generative AI. It consists of a React frontend and an Express Node.js backend, backed by SQLite for persistence and Redis/Bull for background job management.

## Component Descriptions

- **Frontend (React + Vite):** A modern SPA built with Tailwind CSS, utilizing TanStack Query for robust data fetching and polling. Recharts is used for dashboard visualization.
- **Backend (Node.js + Express):** A RESTful API that handles file uploads (Multer), data serving, and queuing.
- **Database (SQLite via better-sqlite3):** A zero-config, file-based database. \`better-sqlite3\` provides fast, synchronous execution ideal for simple, single-server applications.
- **Message Queue (Bull + Redis):** Manages the asynchronous execution of PDF extraction tasks to ensure the main event loop remains unblocked.
- **AI Integration (@google/generative-ai):** Interfaces with Gemini 1.5 Flash to extract structured JSON from raw invoice text.

## Full Async Data Flow

1. **Upload:** Client submits a multipart form request to \`POST /api/documents\`.
2. **Multer:** Middleware intercepts the request, validates the files, and saves the PDFs to the \`/uploads\` directory.
3. **DB Insert:** The controller generates a UUID for each file and synchronously inserts a row into the \`documents\` table with a \`PENDING\` status.
4. **Bull Queue:** A job containing the file path and document ID is added to the Redis-backed Bull queue.
5. **Immediate Response:** The server immediately returns an HTTP 202 Accepted response.
6. **Worker:** A background worker picks up the job, updating the database status to \`PROCESSING\`.
7. **pdf-parse:** The worker reads the PDF and extracts raw text.
8. **Gemini:** The text is injected into the selected prompt template and sent to the Gemini API for structured JSON extraction.
9. **Validate:** The result is passed through the Validation Service to check required fields, normalize dates/currencies, calculate math accuracy, and generate a confidence score.
10. **DB Update:** The extraction results and final status (\`COMPLETED\` or \`FAILED\`) are saved to the database.
11. **API / React:** The frontend, which has been polling the \`GET /api/documents\` endpoint, receives the updated status and renders the extracted data.

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

\`\`\`text
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
|  SQLite Database  |<----------------------|     Bull Queue       |
| (better-sqlite3)  |                       |     (Redis)          |
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
\`\`\`