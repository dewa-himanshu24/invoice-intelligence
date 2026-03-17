# System Architecture

The Invoice Intelligence System is a decoupled, asynchronous, full-stack web application designed for robust and scalable PDF processing using generative AI. It consists of a React frontend and an Express Node.js backend, backed by **Supabase (PostgreSQL & Storage)** for persistence and **Redis/Bull** for background job management.

## Project Structure

### Backend
```text
backend/
├── src/
│   ├── config/             # Config for Logger, Bull Queue, and Supabase client
│   ├── controllers/        # Express controllers handling API logic
│   ├── middleware/         # Multer upload config and global error handler
│   ├── prompts/            # Versioned LLM prompt templates
│   ├── routes/             # API route definitions (Documents, Metrics)
│   └── services/           # Core business logic
│       ├── extractionService.js  # Gemini AI integration and text extraction
│       ├── storageService.js     # Supabase Storage (S3-compatible) integration
│       ├── validationService.js  # Schema validation and data normalization
│       └── workerService.js      # Bull queue consumer for async processing
├── uploads/                # Temporary local storage for uploads
└── examples/               # Reference JSON for testing/documentation
```

### Frontend
```text
frontend/
├── src/
│   ├── api/                # Axios client configuration
│   ├── components/         # UI components (ConfidenceBar, Tables, etc.)
│   ├── hooks/              # Custom React hooks (useDocuments for data fetching)
│   ├── pages/              # Page components (Dashboard, Upload, Detail)
│   ├── App.jsx             # React Router and layout
│   └── main.jsx            # React entry point
├── tailwind.config.js      # CSS styling configuration
└── vite.config.js          # Build and proxy configuration
```

## Component Descriptions

- **Frontend (React + Vite):** A modern SPA built with Tailwind CSS, utilizing TanStack Query for robust data fetching and polling. Recharts is used for dashboard visualization.
- **Backend (Node.js + Express):** A RESTful API that handles file uploads (Multer), data serving, and queuing.
- **Database & Storage (Supabase):** 
    - **PostgreSQL:** Stores document metadata and extraction results.
    - **Storage (Bucket):** Stores the actual PDF files, allowing the worker to access them from anywhere.
- **Message Queue (Bull + Redis):** Manages the asynchronous execution of PDF extraction tasks to ensure the main event loop remains unblocked.
- **AI Integration (@google/generative-ai):** Interfaces with Gemini models (defaulting to **Gemini 2.0 Flash Lite**) to extract structured JSON from raw invoice text.

## Full Async Data Flow

1. **Upload:** Client submits a multipart form request to `POST /api/documents`.
2. **Multer:** Middleware intercepts the request, validates the files, and saves them temporarily.
3. **Queueing:** For each file:
   - A `PENDING` record is created in the Supabase `documents` table.
   - The file is uploaded to Supabase Storage.
   - A job is added to the Bull queue with the document ID and storage path.
4. **Immediate Response:** The server returns an HTTP 202 Accepted response.
5. **Worker:** A background worker picks up the job, updating the status to `PROCESSING`.
6. **Download:** The worker downloads the file from Supabase Storage (or uses the local temp file).
7. **Extraction:** The worker parses the PDF text and sends it to the Gemini API with a specific prompt.
8. **Validation:** The LLM output is validated, normalized, and scored for confidence.
9. **Persistence:** Results are saved to the `extractions` table, and the document status is set to `COMPLETED` or `FAILED`.
10. **UI Update:** The frontend polling mechanism detects the status change and displays the results.

## Why Bull + Redis?

Processing PDFs with LLMs can take several seconds. If this were done synchronously:
- The HTTP request would likely timeout.
- The server's throughput would be severely limited.
- System crashes would result in lost data.

Bull + Redis provides **reliability (retries)**, **concurrency control**, and **visibility** into the processing pipeline.

## Architecture Diagram

```text
+-------------------+       HTTP POST       +----------------------+
|                   |---------------------->|                      |
|   React Frontend  |                       |   Express Backend    |
|   (Vite, Query)   |<----------------------|   (API, Multer)      |
|                   |       HTTP 202        |                      |
+---------+---------+                       +----------+-----------+
          ^                                            |
          | HTTP GET (Polling)                         | 1. Create DB Record
          |                                            | 2. Upload to Storage
          |                                            v
+---------+---------+                       +----------+-----------+
|                   |     3. Queue Job      |                      |
|     Supabase      |<----------------------|     Bull Queue       |
|  (DB & Storage)   |                       |     (Redis)          |
|                   |<----------------------|                      |
+---------+---------+     5. Update Status  +----------+-----------+
          ^               (COMPLETED)                  |
          |                                            | 4. Pick up job
          |                                            v
          |                                 +----------+-----------+
          +---------------------------------|                      |
                                            |   Worker Processor   |
                                            | (Gemini Multimodal)  |
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
