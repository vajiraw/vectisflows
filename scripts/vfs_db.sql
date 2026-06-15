### vfs_db.sql

```sql
-- ---------------------------------------------------------
-- VECTISFLOWS (VFS) DATABASE SCHEMA
-- Purpose: Institutional B2B Trade Execution Engine
-- ---------------------------------------------------------

-- Module: Workflow & State Engine ENUMS
CREATE TYPE trade_status AS ENUM (
    'CONTRACT_PENDING', 
    'ESCROW_AWAITING_FUNDS', 
    'PRODUCTION_IN_PROGRESS', 
    'INSPECTION_TRIGGERED', 
    'INSPECTION_PASSED', 
    'INSPECTION_FAILED', 
    'LOGISTICS_DISPATCHED', 
    'COMPLETED', 
    'DISPUTED'
);

CREATE TYPE org_role AS ENUM ('BUYER', 'SELLER', 'BANK', 'INSPECTOR', 'LOGISTICS');

-- 1. MODULE: IDENTITY & ENTITY MANAGEMENT
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    role org_role NOT NULL,
    country_code CHAR(2),
    is_kyb_verified BOOLEAN DEFAULT FALSE,
    metadata JSONB, -- For tax IDs, registration docs
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role_permissions JSONB, -- For RBAC/ABAC
    created_at TIMESTAMP DEFAULT NOW()
);

-- 2. MODULE: TRADE SPECIFICATION & RFQ
CREATE TABLE rfqs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id UUID REFERENCES organizations(id),
    commodity_type VARCHAR(100), -- e.g., 'Ceylon Tea'
    quantity NUMERIC NOT NULL,
    unit VARCHAR(20) NOT NULL, -- e.g., 'kg', 'MT'
    technical_specs JSONB NOT NULL, -- e.g., {"grade": "BOP", "moisture_max": 12.0}
    required_certificates TEXT[], -- e.g., ['XYZ', 'JAS_Organic']
    expires_at TIMESTAMP,
    status VARCHAR(50) DEFAULT 'ACTIVE'
);

-- 3. MODULE: WORKFLOW & STATE ENGINE
CREATE TABLE trade_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rfq_id UUID REFERENCES rfqs(id),
    seller_id UUID REFERENCES organizations(id),
    bank_id UUID REFERENCES organizations(id),
    current_status trade_status DEFAULT 'CONTRACT_PENDING',
    total_value_usd NUMERIC(15, 2),
    contract_terms JSONB, -- Incoterms, payment tranches
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 4. MODULE: LOGISTICS & COMPLIANCE
CREATE TABLE quality_inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trade_id UUID REFERENCES trade_orders(id),
    inspector_id UUID REFERENCES organizations(id),
    lab_metrics JSONB, -- Actual results from test
    status VARCHAR(50) DEFAULT 'PENDING', -- 'PASSED', 'FAILED'
    report_url TEXT,
    inspected_at TIMESTAMP
);

CREATE TABLE document_vault (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trade_id UUID REFERENCES trade_orders(id),
    doc_type VARCHAR(100), -- 'Bill of Lading', 'Phytosanitary'
    file_url TEXT NOT NULL,
    ai_extracted_data JSONB, -- Data from Python AI Worker
    is_verified BOOLEAN DEFAULT FALSE,
    uploaded_at TIMESTAMP DEFAULT NOW()
);

-- 5. MODULE: SETTLEMENT & ESCROW
CREATE TABLE escrow_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trade_id UUID REFERENCES trade_orders(id) UNIQUE,
    virtual_account_id VARCHAR(255), -- ID from Tazapay/Stripe
    balance_usd NUMERIC(15, 2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'AWAITING_DEPOSIT'
);

-- 6. MODULE: AUDIT & NOTIFICATION
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trade_id UUID REFERENCES trade_orders(id),
    actor_id UUID REFERENCES users(id),
    action VARCHAR(255), -- e.g., 'STATUS_TRANSITION'
    previous_state JSONB,
    new_state JSONB,
    ip_address INET,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ---------------------------------------------------------
-- SAMPLE RECORDS FOR TESTING (Ceylon Tea Scenario)
-- ---------------------------------------------------------

-- 1. Setup Organizations
INSERT INTO organizations (id, name, role, country_code, is_kyb_verified) VALUES
('a1b2c3d4-0000-0000-0000-000000000001', 'Tokyo Import Corp', 'BUYER', 'JP', TRUE),
('a1b2c3d4-0000-0000-0000-000000000002', 'Lanka Tea Exporters', 'SELLER', 'LK', TRUE),
('a1b2c3d4-0000-0000-0000-000000000003', 'Global Trade Bank', 'BANK', 'SG', TRUE),
('a1b2c3d4-0000-0000-0000-000000000004', 'SGS Lanka', 'INSPECTOR', 'LK', TRUE);

-- 2. Create RFQ for 200kg Ceylon Tea Grade 1 BOP
INSERT INTO rfqs (id, buyer_id, commodity_type, quantity, unit, technical_specs, required_certificates) VALUES
('b2c3d4e5-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'Ceylon Tea', 200, 'kg', 
 '{"grade": "BOP", "quality": "Grade 1", "moisture_max": 10.0}', ARRAY['XYZ', 'JAS_Organic']);

-- 3. Create a Trade Order in 'ESCROW_AWAITING_FUNDS' status
INSERT INTO trade_orders (id, rfq_id, seller_id, bank_id, current_status, total_value_usd) VALUES
('c3d4e5f6-0000-0000-0000-000000000001', 'b2c3d4e5-0000-0000-0000-000000000001', 
 'a1b2c3d4-0000-0000-0000-000000000002', 'a1b2c3d4-0000-0000-0000-000000000003', 
 'ESCROW_AWAITING_FUNDS', 2500.00);

-- 4. Setup Escrow Wallet for the Trade
INSERT INTO escrow_accounts (trade_id, virtual_account_id, status) VALUES
('c3d4e5f6-0000-0000-0000-000000000001', 'v_acc_tazapay_9988', 'AWAITING_DEPOSIT');
```

-- ---------------------------------------------------------
-- SAMPLE USERS FOR VECTISFLOWS (VFS)
-- Referencing Organizations from previous schema setup
-- ---------------------------------------------------------

INSERT INTO users (id, org_id, email, password_hash, role_permissions) VALUES
-- 1. BUYER: Tokyo Import Corp (Admin & Procurement)
(gen_random_uuid(), 'a1b2c3d4-0000-0000-0000-000000000001', 'tanaka.admin@tokyoimport.jp', 
 '$2b$12$securehash1', '{"role": "ADMIN", "actions": ["create_rfq", "sign_contract", "release_funds"]}'),

(gen_random_uuid(), 'a1b2c3d4-0000-0000-0000-000000000001', 'sato.procure@tokyoimport.jp', 
 '$2b$12$securehash2', '{"role": "PROCUREMENT", "actions": ["view_trades", "upload_documents"]}'),

-- 2. SELLER: Lanka Tea Exporters (Sales & Operations)
(gen_random_uuid(), 'a1b2c3d4-0000-0000-0000-000000000002', 'perera.sales@lankatea.lk', 
 '$2b$12$securehash3', '{"role": "SALES", "actions": ["submit_bid", "sign_contract", "update_shipment"]}'),

(gen_random_uuid(), 'a1b2c3d4-0000-0000-0000-000000000002', 'fernando.ops@lankatea.lk', 
 '$2b$12$securehash4', '{"role": "OPERATIONS", "actions": ["upload_bol", "trigger_inspection"]}'),

-- 3. BANK: Global Trade Bank (Escrow & Compliance)
(gen_random_uuid(), 'a1b2c3d4-0000-0000-0000-000000000003', 'lee.escrow@globaltrade.sg', 
 '$2b$12$securehash5', '{"role": "ESCROW_MANAGER", "actions": ["verify_deposit", "audit_ledger"]}'),

-- 4. INSPECTOR: SGS Lanka (Laboratory Tech)
(gen_random_uuid(), 'a1b2c3d4-0000-0000-0000-000000000004', 'jayawardena.lab@sgs.lk', 
 '$2b$12$securehash6', '{"role": "FIELD_INSPECTOR", "actions": ["upload_lab_results", "issue_certificate"]}');



### Key Structural Features:
*   **Decoupling via UUIDs:** All modules interact via unique identifiers, allowing **RabbitMQ** to route events (e.g., `trade.status.changed`) without services needing direct access to each other's full tables.
*   **State Guarding:** The `trade_status` ENUM ensures that the system cannot enter an invalid state, such as `COMPLETED` before `INSPECTION_PASSED`.
*   **AI Integration:** The `document_vault` table includes an `ai_extracted_data` JSONB column. This is where the **Python AI Worker** stores parsed data from Bills of Lading to be matched against the `rfqs.technical_specs`.
*   **Auditability:** The `audit_logs` table creates the "immutable ledger" required for B2B trust, capturing every transition and the actor responsible.