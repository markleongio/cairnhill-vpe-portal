-- Migration: add is_active to pathways
-- Run this once against your existing database (this project has no
-- migration runner — schema.mysql.sql is only used to bootstrap a fresh
-- database, so existing deployments need this applied by hand, e.g.:
--   mysql -h <host> -u <user> -p <database> < db/migrations/001_pathways_is_active.sql
-- Safe to re-run: MySQL 8.0.29+ supports ADD COLUMN IF NOT EXISTS. If your
-- server is older than 8.0.29, drop the "IF NOT EXISTS" clause and only run
-- this once.

ALTER TABLE pathways
  ADD COLUMN IF NOT EXISTS is_active TINYINT NOT NULL DEFAULT 1 AFTER sort_order;
