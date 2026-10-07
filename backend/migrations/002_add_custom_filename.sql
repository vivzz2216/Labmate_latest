-- Migration: Add custom_filename column to uploads table
-- Created: 2025-10-13
-- Description: Add custom_filename column to store user-specified filename for code files

-- Add custom_filename column to uploads table
ALTER TABLE uploads ADD COLUMN custom_filename VARCHAR NULL;
