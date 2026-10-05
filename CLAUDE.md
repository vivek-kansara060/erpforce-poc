# ERPForce POC: Project Rules

## Mandatory context check (before ANY action)

Before writing code, answering a question, giving a recommendation, or doing research, Claude MUST first review all five sources below. Do not act or respond until this analysis is done.

1. **FE code**: `D:\projects\erpforce-fe` (React + Vite + TypeScript). Check the relevant modules (`src/modules/*`), routes, store, shell, components, and types for what already exists.
2. **BE code**: `D:\projects-clone\erpforce-be` the backend / data layer. This repo currently has no separate backend; data lives in `src/mock-data/` and `src/store/`. If a backend repo or path is added later, it must be checked here too.
3. **`ERP_PROJECT_DOCUMENTATION.md`**: our internal ERP project documentation (scope, modules, architecture).
4. **`ERPForce_Heavy_Equipment_Rental_Module.md`**: the client-provided heavy equipment rental requirements. Treat this as the client's source of truth for requirements.
5. **`Transcript.md`**: transcripts of our regular sync-up calls with the client. Newer decisions in the transcript override older ones and may override the original client document; check it for the latest agreed changes, clarifications, and open questions.

### How to apply

- Read the parts of each source relevant to the request (use search for large files; do not skip a source).
- Cross-check: if the code, our documentation, the client document, and the transcript disagree, call out the conflict explicitly and state which source the decision follows (latest transcript decision wins unless told otherwise).
- In the response, briefly cite which sources informed the answer (file and section/line where useful).
- Only after this analysis: implement, respond, or research accordingly.
