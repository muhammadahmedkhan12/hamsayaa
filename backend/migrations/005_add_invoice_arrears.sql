-- Migration: 005_add_invoice_arrears.sql
-- Description: Adds arrears column to invoices table to track previous unpaid/overdue cycle balances.

ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS arrears DECIMAL(10,2) DEFAULT 0.00;

COMMENT ON COLUMN invoices.arrears IS 'Outstanding unpaid dues balance carried forward from previous billing cycles';
