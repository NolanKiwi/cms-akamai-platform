-- Initial database setup for local development
-- Production migrations managed via migration tool (e.g., db-migrate, Flyway)

CREATE DATABASE cms_test;
GRANT ALL PRIVILEGES ON DATABASE cms_test TO cms_admin;
GRANT ALL PRIVILEGES ON DATABASE cms TO cms_admin;
