-- Synoza MySQL setup
-- Run via: setup-mysql.ps1

CREATE DATABASE IF NOT EXISTS synoza
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'synoza_user'@'localhost' IDENTIFIED BY 'Synoza@2026';
GRANT ALL PRIVILEGES ON synoza.* TO 'synoza_user'@'localhost';
FLUSH PRIVILEGES;
