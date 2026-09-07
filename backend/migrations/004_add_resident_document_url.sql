-- Migration: 004_add_resident_document_url.sql
-- Description: Adds document_url column to the residents table for storing verification documents (PDF, CNIC scans, Tenancy agreements).

ALTER TABLE residents 
ADD COLUMN IF NOT EXISTS document_url TEXT;

COMMENT ON COLUMN residents.document_url IS 'Public URL of uploaded resident verification documents (e.g. PDF Tenancy Agreement, CNIC copy)';
