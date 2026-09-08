# SOFTWARE DEVELOPMENT PLAN (SDP)
## LEADS (Lead generation Engine for Automated Discovery System)

---

### 1. PROJECT DETAILS
- **Project Title:** LEADS (Lead generation Engine for Automated Discovery System)
- **Project Type:** Web Application / Artificial Intelligence & Problem Solving (Real Estate Market Intelligence, Automated Multi-Agent Scraping & Buyer-Seller Outreach Platform)
- **Start Date:** Monday, April 27, 2026
- **End Date:** Monday, April 26, 2027
- **Duration:** 1 Year / 52 Weeks (365 Calendar Days / ~260 Working Days)
- **Development Methodology:** Agile / Iterative SDLC (Sprint-driven feature delivery combining Scrum iterations with continuous integration for scraping and AI inference subsystems)
- **Project Manager:** Muhammad Soban & Mamoon Tahir (Academic Supervision by Dr. Tehseen Riaz Abbasi)
- **Client / Organization:** Department of Computer Science, COMSATS University Islamabad (CUI), Islamabad Campus (Project Evaluators: FYP Committee; Target Market: Pakistani Real Estate Practitioners, Sellers, Agents, and Buyers)
- **Project Objectives:**
  - **BO-1 (Market Intelligence & Demand Scoring):** Continuously scrape publicly available listing data from four Pakistani platforms (Zameen.com, OLX Pakistan, Graana.com, Ilaan.com), compute listing velocity, average days on market, and price trends per city and category, and generate human-readable investment trend recommendations using LLMs.
  - **BO-2 (Targeted Multi-Agent Scraping):** Deploy parallel proxy-assigned Celery scrapers combining Scrapy and Playwright to collect filtered on-demand listings across competitor platforms without rate-limit disruptions.
  - **BO-3 (AI-Assisted Seller Outreach):** Automatically generate personalized WhatsApp outreach messages and Terms & Conditions summaries with human-in-the-loop review before dispatch.
  - **BO-4 (Structured Property Data Collection):** Distribute dynamic, category-specific digital property forms (House, Flat, Shop, Plot, Plaza) via WhatsApp to eliminate chaotic manual communications.
  - **BO-5 (Two-Stage LLM Property Analysis):** Evaluate submitted seller form details using Google Gemini 2.0 Flash / OpenAI GPT-4o mini to estimate fair market valuations (min, recommended, max), identify hot selling features, flag issues, verify property categories, and synthesize professional listing descriptions.
  - **BO-6 (Buyer Outreach & Intent Scoring):** Execute secondary scraping passes to discover active market buyers, rank them via an ML-based composite lead scoring model (intent, budget, category, recency), and dispatch WhatsApp outreach campaigns.
  - **BO-7 (Webhook-Driven Warm Lead Detection):** Ingest real-time WhatsApp replies via Cloud API webhooks, classify responses into HOT, WARM, or COLD using NLP keywords and sentiment analysis, route hot/warm leads to the seller dashboard, and auto-draft follow-up replies.
  - **BO-8 (Verified Property Listing Hub):** Publish AI-enhanced, verified property listings to a public discovery portal featuring Server-Side Rendering (SSR), Meilisearch fast indexing, and Google Maps integration.
  - **BO-9 (Comprehensive Administration Control):** Equip administrators with real-time controls over scraper scheduling, rotating proxy pools, API credentials, scoring model weights, and user audit logs.
  - **BO-10 (Dual-OTP User Verification):** Enforce mandatory identity verification using email OTP (SendGrid) and phone OTP (WhatsApp Cloud API) to eradicate fake listings and anonymous spam.
- **Project Scope (In-Scope / Out-of-Scope):**
  - **In-Scope:**
    - Pre-transaction stage automation tailored specifically for the Pakistani real estate market.
    - Continuous market data collection and intelligence generation across four competitor portals (Zameen, OLX, Graana, Ilaan).
    - Multi-agent scraping infrastructure utilizing Scrapy, Playwright, Celery, and rotating proxy IP pools.
    - Dual OTP identity verification (Email via SendGrid and Phone via WhatsApp Cloud API).
    - Three isolated, role-tailored web portals: Seller/Agent Portal, Buyer Portal, and Admin Control Panel.
    - Category-specific responsive digital seller intake forms for five property types.
    - Two-stage LLM evaluation pipeline for automated valuation, issue detection, and listing description enhancement.
    - Machine learning composite lead scoring model (scikit-learn + Hugging Face Transformers).
    - WhatsApp Cloud API campaign dispatch and bidirectional webhook-based reply monitoring.
    - Automated warm lead classification (HOT, WARM, COLD) and follow-up message generation.
    - Public listing discovery hub featuring Meilisearch full-text search, Google Maps location display, and SSR.
  - **Out-of-Scope:**
    - Post-transaction financial handling: Escrow, digital payment processing, bank transfers, or deposit holding.
    - Legal documentation: Title deed verification, registry documentation, stamp paper drafting, or lease agreements.
    - On-site physical property inspection or verification of legal property ownership (sellers remain legally liable).
    - Scraping behind authentication walls or private channels (e.g., Facebook Marketplace login walls or private chats).
    - Multilingual support beyond English (system operates exclusively in English for this release).
    - Geographic regions outside Pakistan and multi-currency exchange mechanisms.
    - Automated offline deal closing verification (agent revenue and commissions are logged manually).

---

### 2. WBS - WORK BREAKDOWN STRUCTURE

#### 1.0 Initiation
- **1.1 Requirement Gathering**
  - 1.1.1 Target portal field mapping and anti-scraping analysis (Zameen, OLX, Graana, Ilaan)
  - 1.1.2 Stakeholder and real estate agent interviews across Rawalpindi and Islamabad
  - 1.1.3 Business and functional requirements specification across all 12 modules
- **1.2 Feasibility Study**
  - 1.2.1 Technical feasibility (Playwright vs Scrapy benchmarks, WhatsApp Cloud API WABA, LLM latency & cost)
  - 1.2.2 Operational feasibility (pre-transaction workflow and agent adoption assessment)
  - 1.2.3 Economic and legal feasibility (public data scraping boundaries and Pakistani compliance)
- **1.3 Project Charter**
  - 1.3.1 Definition of project vision, boundaries, constraints, and success criteria
  - 1.3.2 Stakeholder roles, team responsibilities, and resource allocation
  - 1.3.3 Formal scope approval and project kickoff

#### 2.0 Planning & Design
- **2.1 System Architecture Design**
  - 2.1.1 High-level modular architecture (Next.js frontend, FastAPI + Django backend, Celery workers)
  - 2.1.2 Asynchronous task and queue architecture (Redis broker, Celery Beat, rotating proxy pools)
  - 2.1.3 Webhook and external API integration architecture (WhatsApp Cloud API, Gemini, SendGrid)
- **2.2 Database Design**
  - 2.2.1 PostgreSQL relational schema modeling (Users, Roles, Listings, Campaigns, Leads, Audit Logs) via Prisma
  - 2.2.2 MongoDB unstructured repository design (Scraped raw listing collections, price histories, market telemetry)
  - 2.2.3 Meilisearch search index schema design (Faceted search, geo-coordinates, ranking rules)
- **2.3 UI/UX Design**
  - 2.3.1 Wireframes and mockups for Seller/Agent Portal (Dashboard, Leads, Market Intelligence, Campaigns)
  - 2.3.2 Wireframes and mockups for Buyer Portal (Search/Filter Hub, Listing SSR Views, Contact Routing)
  - 2.3.3 Wireframes and mockups for Admin Portal (Scraper Monitors, Proxy Manager, Scoring Weights, User Management)

#### 3.0 Development
- **3.1 Backend Development**
  - 3.1.1 M01 User Authentication & Dual OTP service (Bcrypt hashing, SendGrid email OTP, WhatsApp phone OTP, JWT cookies)
  - 3.1.2 M02 Market Intelligence Engine (Velocity, days on market, price movement calculations & Gemini market summary)
  - 3.1.3 M03 Multi-Agent Scraping Engine (Scrapy spiders for static pages, Playwright for JS-rendered portals, proxy rotation)
  - 3.1.4 M04 & M05 Seller Outreach & Dynamic Form Engine (WhatsApp T&C dispatch, tokenized web forms for 5 property types)
  - 3.1.5 M06 AI Property Analyzer (Two-stage LLM chain: valuation range, key features, issue flagging, listing description)
  - 3.1.6 M07 Buyer Outreach & ML Lead Scoring (NLP intent classification, scikit-learn composite scoring, campaign dispatch, webhook reply classifier)
- **3.2 Frontend Development**
  - 3.2.1 Next.js 16 + React 19 application setup, Tailwind CSS styling, responsive layout shells
  - 3.2.2 Seller Portal UI (Deal pipeline, lead scoring matrix, outreach triggers, form responses viewer)
  - 3.2.3 Buyer Discovery UI (Faceted filters, property detail SSR pages, Google Maps interactive integration, bookmarking)
  - 3.2.4 Admin Control Panel UI (Scraper telemetry dashboard, Celery task monitor, proxy health manager, weight adjustment)
- **3.3 System Integration**
  - 3.3.1 Inter-service communication setup (FastAPI REST endpoints to Next.js API routes)
  - 3.3.2 Celery worker task distribution with Redis broker and proxy pool middleware
  - 3.3.3 WhatsApp Cloud API webhook handler integration and automated event dispatch pipeline
  - 3.3.4 Meilisearch sync synchronization worker for approved listing publications

#### 4.0 Testing
- **4.1 Unit Testing**
  - 4.1.1 Unit tests for authentication, OTP validation, and JWT session lifecycle
  - 4.1.2 Unit tests for scraper parsing pipelines and HTML extraction logic
  - 4.1.3 Unit tests for ML feature extraction, sentiment analysis, and composite scoring functions
  - 4.1.4 Unit tests for dynamic property form validators across property types
- **4.2 Integration Testing**
  - 4.2.1 End-to-end scraper pipeline testing (Scrapy/Playwright -> Redis -> Celery -> MongoDB)
  - 4.2.2 End-to-end seller outreach workflow (Listing select -> WhatsApp draft -> Form submit -> LLM analysis)
  - 4.2.3 End-to-end buyer campaign & webhook reply handling (Scraping -> Scoring -> Campaign send -> Webhook HOT/WARM classify)
  - 4.2.4 External API error resilience and fallback testing (Gemini / OpenAI rate limits, WhatsApp delivery failure)
- **4.3 System Testing & UAT**
  - 4.3.1 Performance, load, and concurrent scraping throughput testing
  - 4.3.2 Security audit (RBAC enforcement, bcrypt password hashing, SQL injection, XSS, rate limiting)
  - 4.3.3 User Acceptance Testing (UAT) with real estate practitioners and academic evaluators
  - 4.3.4 Bug remediation, UI polish, and performance optimization based on UAT feedback

#### 5.0 Deployment & Closure
- **5.1 Deployment**
  - 5.1.1 Containerization with Docker & Docker-Compose (FastAPI, Next.js, Celery, Redis, Meilisearch)
  - 5.1.2 Cloud server provisioning (Ubuntu VPS, Nginx reverse proxy, SSL/TLS certificates via Let's Encrypt)
  - 5.1.3 Production database setup, automated migrations, and backup configurations (PostgreSQL + MongoDB)
  - 5.1.4 Production WhatsApp Cloud API webhook verification and live webhook registration
- **5.2 Documentation**
  - 5.2.1 Software Requirement Specification (SRS) & Software Design Specification (SDS) documents
  - 5.2.2 API documentation via Swagger / OpenAPI & system administration manual
  - 5.2.3 Comprehensive Final Project Report & Academic Presentation Deck
- **5.3 Project Closure & Handover**
  - 5.3.1 Final evaluation presentation and live system demonstration to FYP Committee
  - 5.3.2 Plagiarism verification and code repository archiving
  - 5.3.3 Formal sign-off and project handover to project supervisor and department

---

### 3. MILESTONES, DELIVERABLES, WORK PRODUCTS

| ID | Milestone | Planned Date | Deliverables | Work Products |
| :--- | :--- | :--- | :--- | :--- |
| **M1** | Scope & Initiation Complete | Wed 5/13/26 | Project Scope Document & Formal Charter | Competitor Analysis Matrix, Requirements Specification, Approved Scope Document |
| **M2** | System Design & Specifications Complete | Thu 8/20/26 | Software Requirement (SRS) & Software Design (SDS) Documents | System Architecture Diagrams, Prisma ERD & PostgreSQL Schemas, UI/UX Wireframes & Interactive Mockups, Sequence/Activity UML Diagrams |
| **M3** | Scraping & Market Intelligence Operational | Tue 10/6/26 | Market Intelligence & Multi-Agent Scraping Engine | Scrapy & Playwright Portal Spiders, Celery Task Worker Pipeline, MongoDB Telemetry Storage, Market Demand Index Calculation Service |
| **M4** | Seller & Buyer AI Outreach Pipeline Complete | Thu 12/3/26 | Integrated AI Property Analysis & WhatsApp Outreach Engine | WhatsApp Cloud API Webhook Handler, Dynamic Category Form Generator, Two-Stage Gemini LLM Chain, Scikit-learn Composite Lead Scoring Model |
| **M5** | 100% Working Integrated Product | Thu 2/11/27 | Fully Integrated Working Platform (All 12 Modules) | Unified Web Application (Seller, Buyer, Admin Portals), Meilisearch Sync Engine, Google Maps Integration, End-to-End Pipeline Verification Report |
| **M6** | Testing, Review & Project Delivery Complete | Mon 4/26/27 | Final Evaluated Product & Academic Deliverables | Complete Test Results & Traceability Matrix, UAT Feedback Report, Docker Deployment Bundle, Final Academic FYP Report, Defense Presentation |

---

### 4. GANTT CHART
The development schedule for LEADS spans 52 weeks from **April 27, 2026** to **April 26, 2027**. Below are the official Gantt chart parts from the project scope document, followed by the chronological phase breakdown.

#### Part 1: Scope, Planning and System Design (April 2026 – August 2026)
![Gantt Chart Part 1: Scope, Planning and System Design](/home/soban-iftikhar/.gemini/antigravity/brain/a7acd283-7215-406f-81c5-f96e5f066a66/gantt_chart_part1.png)
*Figure 4.1: Gantt Chart Part 1 – Initiation, System Design, SRS, and SDS Phases.*

#### Part 2: Core Modules Development (August 2026 – January 2027)
![Gantt Chart Part 2: Core Modules Development](/home/soban-iftikhar/.gemini/antigravity/brain/a7acd283-7215-406f-81c5-f96e5f066a66/gantt_chart_part2.png)
*Figure 4.2: Gantt Chart Part 2 – Development of Modules M01 through M12, Multi-Agent Scraping, and AI Pipeline.*

#### Part 3: Testing, Final Review and Delivery (January 2027 – April 2027)
![Gantt Chart Part 3: Testing, Final Review and Delivery](/home/soban-iftikhar/.gemini/antigravity/brain/a7acd283-7215-406f-81c5-f96e5f066a66/gantt_chart_part3.png)
*Figure 4.3: Gantt Chart Part 3 – Integration, Comprehensive Testing, UAT, Model Tuning, Final Report, and Defense.*

#### Timeline Summary Table
| Phase | Start Date | Finish Date | Duration | Primary Resources | Key Milestone / Output |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Scope & Planning** | Mon 4/27/26 | Wed 5/13/26 | ~3 Weeks | Mamoon Tahir, Muhammad Soban | M1: Scope Document Approved |
| **2. System Design** | Thu 5/14/26 | Tue 6/23/26 | ~6 Weeks | Mamoon Tahir, Muhammad Soban | Design Phase Sign-Off |
| **3. SRS Documentation** | Wed 6/24/26 | Mon 7/27/26 | ~5 Weeks | Mamoon Tahir, Muhammad Soban | SRS Document Complete |
| **4. SDS Documentation** | Tue 7/28/26 | Thu 8/20/26 | ~3.5 Weeks | Mamoon Tahir, Muhammad Soban | M2: SDS Document Complete |
| **5. Core Development** | Fri 8/21/26 | Thu 2/11/27 | ~25 Weeks | Mamoon Tahir, Muhammad Soban | M3, M4, M5: 100% Working Product |
| **6. Testing & QA** | Fri 2/12/27 | Fri 2/26/27 | ~2 Weeks | Mamoon Tahir, Muhammad Soban | Testing Documentation Complete |
| **7. Final Review & Delivery** | Mon 3/1/27 | Mon 4/26/27 | ~8 Weeks | Mamoon Tahir, Muhammad Soban, Dr. Tehseen Riaz Abbasi | M6: Project Closure & Evaluation |

---

### 5. NETWORK DIAGRAM

#### Activity On Node (AON) Network Diagram
```mermaid
flowchart TD
    classDef startEnd fill:#1e293b,stroke:#0f172a,stroke-width:2px,color:#fff;
    classDef crit fill:#dc2626,stroke:#991b1b,stroke-width:2px,color:#fff;
    classDef nonCrit fill:#2563eb,stroke:#1d4ed8,stroke-width:2px,color:#fff;

    START([START: Project Kickoff<br/>Mon 4/27/26]):::startEnd --> A1[1.1 Competitor Analysis<br/>3d | 4/27 - 4/29]:::crit
    A1 --> A2[1.2 Requirements Gathering<br/>6d | 4/30 - 5/7]:::crit
    A2 --> A3[1.3 Scope Document Writing<br/>4d | 5/8 - 5/13]:::crit
    A3 --> M1[1.4 Scope Approval M1<br/>0d | 5/13/26]:::crit
    
    M1 --> B1[2.1 Database Schema Design<br/>7d | 5/14 - 5/22]:::crit
    B1 --> B2[2.2 System Architecture & API<br/>7d | 5/25 - 6/2]:::crit
    B2 --> B3[2.3 Scoring & NLP Model Arch<br/>5d | 6/3 - 6/9]:::nonCrit
    B2 --> B4[2.4 UI/UX Wireframes<br/>10d | 6/10 - 6/23]:::crit
    B3 --> M_DES[2.5 Design Phase Complete<br/>0d | 6/23/26]:::crit
    B4 --> M_DES
    
    M_DES --> C1[3.1-3.6 SRS Documentation<br/>24d | 6/24 - 7/27]:::crit
    C1 --> D1[4.1-4.5 SDS Documentation<br/>18d | 7/28 - 8/20]:::crit
    D1 --> M2[4.5 SDS Complete M2<br/>0d | 8/20/26]:::crit
    
    M2 --> E1[5.1 Dev Environment Setup<br/>2d | 8/21 - 8/24]:::crit
    E1 --> E2[5.2 M01 User Auth & Dual OTP<br/>7d | 8/25 - 9/2]:::crit
    E2 --> E3[5.3 M02 Market Intelligence<br/>8d | 9/3 - 9/14]:::crit
    E3 --> E4[5.4 M03 Scrapy Spiders<br/>8d | 9/15 - 9/24]:::crit
    E4 --> E5[5.5 M03 Playwright Spiders<br/>8d | 9/25 - 10/6]:::crit
    E5 --> M3[5.6 Scraping Complete M3<br/>0d | 10/6/26]:::crit
    
    M3 --> E7[5.7 M04 Seller Outreach Agent<br/>7d | 10/7 - 10/15]:::crit
    E7 --> E8[5.8 M05 Seller Form System<br/>7d | 10/16 - 10/26]:::crit
    E8 --> E9[5.9 M06 AI Property Analyser<br/>8d | 10/27 - 11/5]:::crit
    E9 --> E10[5.10 M07 Lead Scoring Model<br/>10d | 11/6 - 11/19]:::crit
    E10 --> E11[5.11 M07 Campaign & Webhook<br/>10d | 11/20 - 12/3]:::crit
    E11 --> M4[5.12 Seller Pipeline Complete M4<br/>0d | 12/3/26]:::crit
    
    M4 --> E13[5.13 M08 Listing Management<br/>7d | 12/4 - 12/14]:::crit
    E13 --> E14[5.14 M08 Buyer Discovery UI<br/>7d | 12/15 - 12/23]:::crit
    E14 --> E15[5.15 M09 Seller Dashboard<br/>6d | 12/24 - 12/31]:::crit
    E15 --> E16[5.16 M10 Admin Control Panel<br/>8d | 1/1 - 1/12]:::crit
    E16 --> E17[5.17 M11 Campaign Dashboard<br/>6d | 1/13 - 1/20]:::crit
    E17 --> E18[5.18 M12 Profile & Settings<br/>5d | 1/21 - 1/27]:::crit
    E18 --> M_DEV[5.19 Core Dev Complete<br/>0d | 1/27/27]:::crit
    
    M_DEV --> E20[5.20 Module Integration<br/>7d | 1/28 - 2/5]:::crit
    E20 --> E21[5.21 E2E Pipeline Testing<br/>4d | 2/8 - 2/11]:::crit
    E21 --> M5[5.22 100% Working Product M5<br/>0d | 2/11/27]:::crit
    
    M5 --> F1[6.1 Unit Test Cases<br/>4d | 2/12 - 2/17]:::crit
    F1 --> F2[6.2 Integration Test Plan<br/>4d | 2/18 - 2/23]:::crit
    F2 --> F3[6.3 Test Traceability Matrix<br/>3d | 2/24 - 2/26]:::crit
    F3 --> M_TEST[6.4 Testing Milestone<br/>0d | 2/26/27]:::crit
    
    M_TEST --> G1[7.1 ML Retraining on Live Data<br/>5d | 3/1 - 3/5]:::crit
    G1 --> G2[7.2 Performance Optimization<br/>5d | 3/8 - 3/12]:::crit
    G2 --> G3[7.3 Security Audit & Review<br/>5d | 3/15 - 3/19]:::crit
    G3 --> G4[7.4 User Acceptance Testing UAT<br/>6d | 3/22 - 3/29]:::crit
    G4 --> G5[7.5 Bug Fixing & UAT Polish<br/>4d | 3/30 - 4/2]:::crit
    G5 --> G6[7.6 Final Report Writing<br/>7d | 4/5 - 4/13]:::crit
    G6 --> G7[7.7 Defense Prep & Slides<br/>7d | 4/14 - 4/22]:::crit
    G7 --> G8[7.8 Plagiarism Verification<br/>1d | 4/23/27]:::crit
    G8 --> G9[7.9 Final Evaluation<br/>1d | 4/26/27]:::crit
    G9 --> M6[7.10 Project Complete M6<br/>0d | 4/26/27]:::crit
    M6 --> FINISH([FINISH: Graduation & Handover<br/>Mon 4/26/27]):::startEnd
```

#### Critical Path Table
*Note: Duration is expressed in standard working days. The Critical Path represents the sequence of dependent activities that directly determines the minimum completion time of the project (Total Duration = 260 working days).*

| Activity ID | Description | Duration (Days) | Predecessor | Status |
| :--- | :--- | :--- | :--- | :--- |
| **1.1** | Competitor Analysis | 3 | None | Critical |
| **1.2** | Requirements Gathering | 6 | 1.1 | Critical |
| **1.3** | Scope Document Writing | 4 | 1.2 | Critical |
| **1.4** | Scope Submitted & Approved (Milestone M1) | 0 | 1.3 | Critical |
| **2.1** | Database Schema Design (PostgreSQL + MongoDB) | 7 | 1.4 | Critical |
| **2.2** | System Architecture & API Design | 7 | 2.1 | Critical |
| **2.4** | UI/UX Wireframes & Component Design | 10 | 2.2 | Critical |
| **2.5** | Design Phase Sign-Off | 0 | 2.3, 2.4 | Critical |
| **3.1-3.6** | Software Requirement Specification (SRS) | 24 | 2.5 | Critical |
| **4.1-4.5** | Software Design Specification (SDS) (Milestone M2) | 18 | 3.6 | Critical |
| **5.1** | Development Environment & Toolchain Setup | 2 | 4.5 | Critical |
| **5.2** | M01 - User Authentication & Dual OTP Engine | 7 | 5.1 | Critical |
| **5.3** | M02 - Market Intelligence Engine | 8 | 5.2 | Critical |
| **5.4** | M03 - Scraping Engine (Scrapy Spiders) | 8 | 5.3 | Critical |
| **5.5** | M03 - Scraping Engine (Playwright Spiders) | 8 | 5.4 | Critical |
| **5.6** | Scraping & Market Intelligence Operational (Milestone M3) | 0 | 5.5 | Critical |
| **5.7** | M04 - Seller Outreach Agent (WhatsApp Templates) | 7 | 5.6 | Critical |
| **5.8** | M05 - Seller Dynamic Form System | 7 | 5.7 | Critical |
| **5.9** | M06 - AI Property Analyser (Two-Stage LLM Chain) | 8 | 5.8 | Critical |
| **5.10** | M07 - Buyer Outreach: Lead Scoring Model (scikit-learn) | 10 | 5.9 | Critical |
| **5.11** | M07 - Campaign Dispatch & Webhook Reply Classifier | 10 | 5.10 | Critical |
| **5.12** | Seller Side Pipeline Complete (Milestone M4) | 0 | 5.11 | Critical |
| **5.13** | M08 - Listing Management System (Publish Pipeline & SSR) | 7 | 5.12 | Critical |
| **5.14** | M08 - Buyer Discovery UI (Faceted Search & Google Maps) | 7 | 5.13 | Critical |
| **5.15** | M09 - Seller Dashboard (Deal Pipeline & Revenue Tracking) | 6 | 5.14 | Critical |
| **5.16** | M10 - Admin Control Panel (Scrapers, Proxies, Scoring) | 8 | 5.15 | Critical |
| **5.17** | M11 - Campaign Dashboard | 6 | 5.16 | Critical |
| **5.18** | M12 - Profile and Settings | 5 | 5.17 | Critical |
| **5.19** | Core Modules Development Complete | 0 | 5.18 | Critical |
| **5.20** | Integration of All 12 Modules into Unified System | 7 | 5.19 | Critical |
| **5.21** | End-to-End Pipeline Verification | 4 | 5.20 | Critical |
| **5.22** | 100% Working Product Milestone (Milestone M5) | 0 | 5.21 | Critical |
| **6.1** | Unit Test Cases for All Modules | 4 | 5.22 | Critical |
| **6.2** | Integration Test Plan (End-to-End Pipeline) | 4 | 6.1 | Critical |
| **6.3** | Test Results Documentation & Traceability Matrix | 3 | 6.2 | Critical |
| **6.4** | Testing Milestone Sign-Off | 0 | 6.3 | Critical |
| **7.1** | Lead Scoring & NLP Model Retraining on Live Scraped Data | 5 | 6.4 | Critical |
| **7.2** | System Performance & Caching Optimization | 5 | 7.1 | Critical |
| **7.3** | Security Review & Vulnerability Assessment | 5 | 7.2 | Critical |
| **7.4** | User Acceptance Testing (UAT) with Agents | 6 | 7.3 | Critical |
| **7.5** | Bug Fixing & Final Polishing based on UAT | 4 | 7.4 | Critical |
| **7.6** | Final Academic Report Writing | 7 | 7.5 | Critical |
| **7.7** | Final Presentation & Defense Preparation | 7 | 7.6 | Critical |
| **7.8** | Turnitin Plagiarism Check & Verification | 1 | 7.7 | Critical |
| **7.9** | Final FYP Committee Evaluation & Defense | 1 | 7.8 | Critical |
| **7.10** | Formal Project Closure & Handover (Milestone M6) | 0 | 7.9 | Critical |

---

### 6. COST MANAGEMENT - EXCEL FORMAT

| S.No | Cost Category | Item Description | Quantity | Unit Rate (PKR) | Total Cost (PKR) | Formula |
| :---: | :--- | :--- | :---: | :---: | :---: | :--- |
| **1.1** | Human Resources | Lead Full-Stack & Systems Engineer (Muhammad Soban) | 12 Months | 120,000 | 1,440,000 | `=D2*E2` |
| **1.2** | Human Resources | AI/ML & Data Pipeline Engineer (Mamoon Tahir) | 12 Months | 120,000 | 1,440,000 | `=D3*E3` |
| **1.3** | Human Resources | Project Supervisor / Academic Advisor Honorarium | 12 Months | 40,000 | 480,000 | `=D4*E4` |
| **1.4** | Human Resources | UI/UX & Quality Assurance Specialist (Contractor) | 3 Months | 60,000 | 180,000 | `=D5*E5` |
| | **Subtotal: Human Resources** | | | | **3,540,000** | `=SUM(F2:F5)` |
| **2.1** | Software / Licenses | Google Gemini 2.0 Flash API (Listing generation & trends) | 12 Months | 15,000 | 180,000 | `=D7*E7` |
| **2.2** | Software / Licenses | OpenAI API (GPT-4o mini backup & sentiment analysis) | 12 Months | 10,000 | 120,000 | `=D8*E8` |
| **2.3** | Software / Licenses | WhatsApp Cloud API (Outreach campaigns & OTP messages) | 15,000 Msgs | 12 | 180,000 | `=D9*E9` |
| **2.4** | Software / Licenses | SendGrid Email Delivery Service (Transaction OTP & alerts) | 12 Months | 5,000 | 60,000 | `=D10*E10` |
| **2.5** | Software / Licenses | Domain Name (.com / .pk) and SSL Certificate | 1 Year | 10,000 | 10,000 | `=D11*E11` |
| | **Subtotal: Software / Licenses** | | | | **550,000** | `=SUM(F7:F11)` |
| **3.1** | Hardware / Cloud | High-Performance Cloud VPS (Ubuntu 8 vCPUs, 16GB RAM) | 12 Months | 25,000 | 300,000 | `=D13*E13` |
| **3.2** | Hardware / Cloud | Managed Database Hosting (PostgreSQL 17 + MongoDB) | 12 Months | 18,000 | 216,000 | `=D14*E14` |
| **3.3** | Hardware / Cloud | Rotating Residential & Datacenter Proxy Network Pool | 12 Months | 20,000 | 240,000 | `=D15*E15` |
| **3.4** | Hardware / Cloud | Development Workstation Amortization & Local Storage | 2 Units | 50,000 | 100,000 | `=D16*E16` |
| | **Subtotal: Hardware / Cloud** | | | | **856,000** | `=SUM(F13:F16)` |
| **4.1** | QA & Testing | Multi-Carrier SIM Cards & Test Phones (Jazz, Telenor, Zong) | 4 Units | 15,000 | 60,000 | `=D18*E18` |
| **4.2** | QA & Testing | Automated CI/CD Cloud Runner Hours (GitHub Actions) | 12 Months | 4,000 | 48,000 | `=D19*E19` |
| **4.3** | QA & Testing | Field User Acceptance Testing (UAT) Honorarium with Agents | 15 Agents | 5,000 | 75,000 | `=D20*E20` |
| | **Subtotal: QA & Testing** | | | | **183,000** | `=SUM(F18:F20)` |
| **5.1** | Deployment | Production Setup, Reverse Proxy & Meilisearch Deployment | 1 Service | 50,000 | 50,000 | `=D22*E22` |
| **5.2** | Deployment | Staging Environment VPS Hosting | 6 Months | 10,000 | 60,000 | `=D23*E23` |
| **5.3** | Deployment | Production Monitoring & Sentry Log Services | 12 Months | 6,000 | 72,000 | `=D24*E24` |
| | **Subtotal: Deployment** | | | | **182,000** | `=SUM(F22:F24)` |
| | **SUBTOTAL (BASE EXPENDITURE)** | | | | **5,311,000** | `=F6+F12+F17+F21+F25` |
| **6.1** | Contingency | Unforeseen Escalation & Emergency Reserve (10%) | 1 Lump Sum | 531,100 | 531,100 | `=F26*10%` |
| | **TOTAL PROJECT BUDGET** | | | | **5,842,100** | `=F26+F27` |

---

### 7. REPORTING STRUCTURE TO TOP MANAGEMENT

```
           Top Management / Client (COMSATS FYP Evaluation Committee)
                                      |
                      Project Supervisor (Dr. Tehseen Riaz Abbasi)
                                      |
                      Project Manager (Soban / Mamoon)
                                      |
         +----------------------------+----------------------------+
         |                                                         |
Tech Lead / Backend Lead                                  Design & QA Lead
 (Muhammad Soban)                                          (Mamoon Tahir)
```

#### Reporting Frequency:
- **Daily Report:** Conducted as an asynchronous daily standup via Slack/Discord. Covers tasks completed in the last 24 hours, planned goals for the day, Git commits pushed, and any blocking scraper/API issues.
- **Weekly Report:** Comprehensive weekly status report submitted to the Project Manager and Supervisor. Includes WBS sprint velocity, tasks completed versus planned, scraper health statistics (records scraped, proxy ban rates), and risk escalations.
- **Bi-Weekly Report:** Formal demonstration and review meeting with Project Supervisor (Dr. Tehseen Riaz Abbasi). Focuses on milestone deliverables, architecture reviews, pipeline code merges, and sprint planning adjustments.
- **Monthly Report:** Formal executive summary submitted to the Department FYP Committee. Documents milestone completion percentages, budget and burn-rate tracking, risk mitigation logs, and schedule variance.
- **Reporting Tools:**
  - **Task & Sprint Tracking:** GitHub Projects, Jira Agile Boards.
  - **Version Control & CI/CD:** GitHub Monorepo with Pull Request reviews and GitHub Actions logs.
  - **Communication & Standups:** Slack, Discord, Microsoft Teams.
  - **System Health & Scraper Telemetry:** Admin Control Panel telemetry dashboard, Sentry for runtime errors, Uptime Kuma for service availability.
  - **Formal Deliverable Documentation:** Overleaf (LaTeX) and Google Docs for SDS/SRS/Final Report milestones.

---

### 8. TOOLS AND TECHNOLOGIES
- **Frontend:**
  - **Framework:** Next.js 16+ (App Router architecture for SSR and fast page loads)
  - **Library:** React 19.2 (Component-driven modular interface)
  - **Styling:** Tailwind CSS 4+ (Utility-first responsive layouts for mobile and desktop)
  - **Language:** TypeScript 5.7+ / ES2025 (Strict type safety and robust component interfaces)
  - **Icons & UI:** Lucide React, Headless UI / Radix UI primitives
- **Backend:**
  - **Languages:** Python 3.13+ (Core analytics, machine learning, and scraper pipeline) & TypeScript / Node.js (Next.js API routes)
  - **Async Framework:** FastAPI 0.115+ (High-performance asynchronous endpoints for scraper triggers and AI analysis)
  - **Management Framework:** Django 5.1+ & Django REST Framework 3.15+ (Relational data endpoints and admin services)
  - **Task Queue & Workers:** Celery 5.4+ (Distributed asynchronous task execution for scrapers and campaigns)
  - **Message Broker & Cache:** Redis 7.4+ (High-throughput message queue and distributed in-memory cache)
  - **Scraping Engines:** Scrapy 2.12+ (High-speed static DOM crawling with throttling) & Playwright 1.50+ (Headless browser automation for JavaScript-heavy dynamic portals)
- **Database:**
  - **Relational Primary Store:** PostgreSQL 17+ with Prisma ORM (User authentication, roles, verified listings, outreach campaigns, leads, and audit logs)
  - **Unstructured Market Store:** MongoDB (Raw multi-platform scraped listings, price timelines, and scraping logs)
  - **Search & Discovery Engine:** Meilisearch 1.5+ (Blazing-fast typo-tolerant full-text search with faceted filtering)
- **Design:**
  - **UI/UX Mockups:** Figma (High-fidelity interactive prototypes across Seller, Buyer, and Admin portals)
  - **System Diagrams:** Draw.io & Mermaid.js (UML Use Case, Sequence, Class, and Activity-on-Node diagrams)
- **Version Control:**
  - **VCS & Hosting:** Git with GitHub Monorepo repository
  - **Workflow:** GitFlow branching strategy (feature branches, staging/develop branch, master release branch)
- **Project Management:**
  - **Agile Tooling:** GitHub Projects (Kanban boards, backlog grooming, issue tracking)
  - **Documentation:** Microsoft Word / Markdown & Overleaf
- **Testing:**
  - **Backend Testing:** Pytest (Unit and integration testing for scrapers, ML pipelines, and API endpoints)
  - **Frontend Testing:** Jest & React Testing Library (Component rendering and state verification)
  - **API Validation:** Postman (REST endpoint contract testing and mock servers)
  - **End-to-End Testing:** Playwright Test (Browser automation covering user registration, form fill, and search flows)
- **Deployment:**
  - **Containerization:** Docker Engine 27+ & Docker Compose (Multi-container orchestration for FastAPI, Celery, Redis, Meilisearch)
  - **Server Operating System:** Ubuntu 24.04 LTS (Cloud Virtual Private Server)
  - **Reverse Proxy & Web Server:** Nginx (Reverse proxy, SSL/TLS termination, gzip/brotli compression, rate limiting)
  - **SSL Certificates:** Let's Encrypt (Certbot automated SSL/TLS renewal)
  - **Monitoring:** Uptime Kuma & Sentry (Application performance and error tracking)

---

### 9. REQUIRED RESOURCES
- **Human Resources:**
  - **Full-Stack & Systems Lead (Muhammad Soban - FA23-BSE-056):** Responsible for Next.js frontend architecture, PostgreSQL schema & Prisma ORM, M01 Authentication, M02 Market Intelligence, M03 Multi-Agent Scraping Engine, M08 Buyer Discovery UI, M10 Admin Control Panel, and M11 Campaign Dashboard.
  - **AI/ML & Pipeline Engineer (Mamoon Tahir - FA23-BSE-051):** Responsible for M04 Seller Outreach Agent, M05 Seller Form System, M06 Two-Stage LLM Property Analyzer, M07 Lead Scoring ML Model & Webhook NLP, M09 Seller Dashboard, and M12 User Profile & Settings.
  - **Academic Project Supervisor (Dr. Tehseen Riaz Abbasi):** Technical guidance, architectural review, milestone evaluation, and academic oversight.
  - **Evaluation Committee:** COMSATS University Islamabad FYP Committee.
  - **Domain Practitioners:** Real estate agents and property consultants in Rawalpindi/Islamabad for interviews, market validation, and User Acceptance Testing (UAT).
- **Hardware Resources:**
  - **Development Machines:** Two high-performance workstations (x86_64, 16GB-32GB RAM, Intel Core i7/AMD Ryzen 7, fast NVMe SSD storage).
  - **Cloud Virtual Private Server (VPS):** Dedicated 8 vCPUs, 16GB RAM, 100GB SSD server running Ubuntu Linux with static IPv4.
  - **Test Mobile Devices:** Android and iOS mobile handsets to verify WhatsApp template rendering, responsive digital forms, and OTP flows.
  - **Multi-Carrier Cellular SIMs:** SIM cards from Jazz, Telenor, Zong, and Ufone for comprehensive OTP delivery and network resilience validation.
- **Software Resources:**
  - **Development Operating Systems:** Ubuntu Linux / Linux environments.
  - **Integrated Development Environments (IDEs):** Visual Studio Code with Python, TypeScript, Docker, and Prisma extensions.
  - **Database Management Tools:** pgAdmin 4 (PostgreSQL administration) and MongoDB Compass (unstructured telemetry inspection).
  - **Cloud Services & External APIs:**
    - Meta WhatsApp Cloud API (WABA-verified WhatsApp business platform account)
    - Google Gemini API (Gemini 2.0 Flash)
    - OpenAI API (GPT-4o mini)
    - SendGrid Email Delivery API
    - Google Maps Platform API (Places & Maps JavaScript API)
  - **Proxy Infrastructure:** Rotating residential and datacenter proxy pool subscription (providing clean Pakistani and domestic IP addresses).
- **Other Resources:**
  - High-speed redundant broadband connections with failover mobile data tethering.
  - Academic research access to IEEE Xplore, ACM Digital Library, and Google Scholar for ML scoring and NLP literature.
  - Public web access to Pakistani real estate portals (Zameen.com, OLX Pakistan, Graana.com, Ilaan.com) in compliance with standard research and pre-transaction discovery practices.
