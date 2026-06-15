-- ============================================================
-- Spice Export Management System - PostgreSQL Database Schema
-- Generated: 2026-06-06
-- File: flow_createdb.sql
-- ============================================================

-- Drop tables if they exist (for clean setup)
DROP TABLE IF EXISTS communications_log CASCADE;
DROP TABLE IF EXISTS product_batches CASCADE;
DROP TABLE IF EXISTS shipments CASCADE;
DROP TABLE IF EXISTS buyers CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;

-- Drop custom types if they exist
DROP TYPE IF EXISTS qc_status_enum CASCADE;
DROP TYPE IF EXISTS logistics_stage_enum CASCADE;
DROP TYPE IF EXISTS interaction_type_enum CASCADE;

-- ============================================================
-- CUSTOM ENUM TYPES
-- ============================================================
CREATE TYPE qc_status_enum AS ENUM ('Pending Testing', 'Approved for Export', 'Rejected');
CREATE TYPE logistics_stage_enum AS ENUM ('Packing', 'Customs Clearance', 'At Port', 'Ocean Transit', 'Delivered');
CREATE TYPE interaction_type_enum AS ENUM ('Email', 'WhatsApp', 'Inquiry', 'Price Quotation', 'Sample Feedback');

-- ============================================================
-- 1. SUPPLIERS TABLE
-- ============================================================
CREATE TABLE suppliers (
    supplier_id VARCHAR(20) PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL,
    primary_contact_name VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    location_region VARCHAR(100),
    product_categories_supplied TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trigger function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for suppliers
CREATE TRIGGER update_suppliers_updated_at
    BEFORE UPDATE ON suppliers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 2. BUYERS TABLE
-- ============================================================
CREATE TABLE buyers (
    buyer_id VARCHAR(20) PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL,
    destination_country VARCHAR(100),
    contact_person_name VARCHAR(255),
    contact_phone VARCHAR(50),
    contact_email VARCHAR(255),
    preferred_product_grades TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trigger for buyers
CREATE TRIGGER update_buyers_updated_at
    BEFORE UPDATE ON buyers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 3. PRODUCT BATCHES TABLE (Grading & Quality Control)
-- ============================================================
CREATE TABLE product_batches (
    batch_id VARCHAR(30) PRIMARY KEY,
    supplier_id VARCHAR(20) NOT NULL,
    product_type VARCHAR(100),
    grade_quality_metric VARCHAR(50),
    moisture_percent NUMERIC(5,2),
    piperine_percent NUMERIC(5,2),
    volatile_oil_percent NUMERIC(5,2),
    quantity_received_kg NUMERIC(10,2) NOT NULL,
    qc_status qc_status_enum DEFAULT 'Pending Testing',
    shipment_id VARCHAR(20),
    received_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_batches_supplier
        FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Trigger for product_batches
CREATE TRIGGER update_product_batches_updated_at
    BEFORE UPDATE ON product_batches
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 4. SHIPMENTS TABLE (Logistics & Customs)
-- ============================================================
CREATE TABLE shipments (
    shipment_id VARCHAR(20) PRIMARY KEY,
    booking_invoice_no VARCHAR(50) NOT NULL,
    buyer_id VARCHAR(20) NOT NULL,
    logistics_stage logistics_stage_enum DEFAULT 'Packing',
    etd DATE,
    eta DATE,
    bl_number VARCHAR(50),
    documents_attached TEXT,
    total_quantity_kg NUMERIC(12,2),
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_shipments_buyer
        FOREIGN KEY (buyer_id) REFERENCES buyers(buyer_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Trigger for shipments
CREATE TRIGGER update_shipments_updated_at
    BEFORE UPDATE ON shipments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 5. COMMUNICATIONS LOG TABLE
-- ============================================================
CREATE TABLE communications_log (
    log_id VARCHAR(50) PRIMARY KEY,
    buyer_id VARCHAR(20) NOT NULL,
    interaction_date TIMESTAMP NOT NULL,
    interaction_type interaction_type_enum NOT NULL,
    summary_of_discussion TEXT,
    next_action_date DATE,
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_comm_log_buyer
        FOREIGN KEY (buyer_id) REFERENCES buyers(buyer_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
);

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================
CREATE INDEX idx_suppliers_region ON suppliers(location_region);
CREATE INDEX idx_batches_supplier ON product_batches(supplier_id);
CREATE INDEX idx_batches_status ON product_batches(qc_status);
CREATE INDEX idx_batches_shipment ON product_batches(shipment_id);
CREATE INDEX idx_shipments_buyer ON shipments(buyer_id);
CREATE INDEX idx_shipments_stage ON shipments(logistics_stage);
CREATE INDEX idx_shipments_etd ON shipments(etd);
CREATE INDEX idx_comm_log_buyer ON communications_log(buyer_id);
CREATE INDEX idx_comm_log_date ON communications_log(interaction_date);

-- ============================================================
-- SEED DATA (Sample Records)
-- ============================================================

-- Sample Suppliers
INSERT INTO suppliers (supplier_id, company_name, primary_contact_name, phone, email, location_region, product_categories_supplied) VALUES
('SUP-001', 'Kerala Spice Exports Pvt Ltd', 'Rajesh Nair', '+91-9876543210', 'rajesh@keralaspice.com', 'Kerala, India', 'Black Pepper, Cardamom, Turmeric'),
('SUP-002', 'Ceylon Cinnamon Co.', 'Amara Silva', '+94-112345678', 'amara@ceyloncinnamon.lk', 'Galle, Sri Lanka', 'Cinnamon, Cloves, Nutmeg'),
('SUP-003', 'Madagascar Vanilla & Spices', 'Jean Rakoto', '+261-321234567', 'jean@madagascarspices.mg', 'Antananarivo, Madagascar', 'Vanilla, Black Pepper, Cloves');

-- Sample Buyers
INSERT INTO buyers (buyer_id, company_name, destination_country, contact_person_name, contact_phone, contact_email, preferred_product_grades) VALUES
('BUY-001', 'Dubai Spice Trading LLC', 'UAE', 'Ahmed Al-Rashid', '+971-501234567', 'ahmed@dubaispice.ae', 'Grade 550 G/L, Grade 500 G/L'),
('BUY-002', 'Tokyo Flavor Imports Co.', 'Japan', 'Yuki Tanaka', '+81-3-12345678', 'yuki@tokyoflavor.jp', 'Alba, C5 Micro, M4'),
('BUY-003', 'Hamburg Spice GmbH', 'Germany', 'Klaus Mueller', '+49-40-1234567', 'klaus@hamburgspice.de', 'Grade 550 G/L, Alba');

-- Sample Product Batches
INSERT INTO product_batches (batch_id, supplier_id, product_type, grade_quality_metric, moisture_percent, piperine_percent, volatile_oil_percent, quantity_received_kg, qc_status, received_date, notes) VALUES
('BATCH-2026-001', 'SUP-001', 'Black Pepper', 'Grade 550 G/L', 11.50, 4.20, 3.80, 5000.00, 'Approved for Export', '2026-05-15', 'First batch of the season. Quality excellent.'),
('BATCH-2026-002', 'SUP-002', 'Cinnamon', 'Alba', 12.00, NULL, 2.50, 3000.00, 'Pending Testing', '2026-05-20', 'Awaiting lab results for volatile oil content.'),
('BATCH-2026-003', 'SUP-001', 'Black Pepper', 'Grade 500 G/L', 12.50, 3.80, 3.50, 4500.00, 'Approved for Export', '2026-05-25', 'Good color and aroma.'),
('BATCH-2026-004', 'SUP-003', 'Cloves', 'C5 Micro', 10.00, NULL, 18.00, 2000.00, 'Rejected', '2026-05-28', 'Moisture content slightly above acceptable limit.');

-- Sample Shipments
INSERT INTO shipments (shipment_id, booking_invoice_no, buyer_id, logistics_stage, etd, eta, bl_number, documents_attached, total_quantity_kg, remarks) VALUES
('SHP-001', 'INV-26001', 'BUY-001', 'Ocean Transit', '2026-06-01', '2026-06-15', 'BL-DXB-260601', 'Certificate of Origin, Phytosanitary Certificate, Invoice, BL', 8000.00, 'Container loaded at Kochi port.'),
('SHP-002', 'INV-26002', 'BUY-002', 'Customs Clearance', '2026-06-10', '2026-06-25', NULL, 'Certificate of Origin, Invoice', 3000.00, 'Awaiting customs approval at Colombo port.'),
('SHP-003', 'INV-26003', 'BUY-003', 'Packing', '2026-06-15', '2026-07-05', NULL, NULL, 4500.00, 'Scheduled for packing next week.');

-- Link batches to shipments
UPDATE product_batches SET shipment_id = 'SHP-001' WHERE batch_id IN ('BATCH-2026-001', 'BATCH-2026-003');
UPDATE product_batches SET shipment_id = 'SHP-002' WHERE batch_id = 'BATCH-2026-002';

-- Sample Communications Log
INSERT INTO communications_log (log_id, buyer_id, interaction_date, interaction_type, summary_of_discussion, next_action_date, created_by) VALUES
('2026-06-02 - BUY-001', 'BUY-001', '2026-06-02 10:30:00', 'Email', 'Discussed shipment INV-26001 status. Buyer confirmed receipt of BL copy and requested ETA update. Confirmed ocean transit on schedule.', '2026-06-10', 'Sales Manager'),
('2026-06-03 - BUY-002', 'BUY-002', '2026-06-03 14:15:00', 'WhatsApp', 'Buyer inquired about new batch of Alba cinnamon. Shared lab test results for BATCH-2026-002. Awaiting feedback on price quotation.', '2026-06-07', 'Sales Manager'),
('2026-06-05 - BUY-003', 'BUY-003', '2026-06-05 09:00:00', 'Inquiry', 'Buyer requested samples of Grade 550 G/L black pepper for quality check before placing bulk order. Samples dispatched via DHL.', '2026-06-12', 'Sales Manager');

-- ============================================================
-- END OF SCRIPT
-- ============================================================
