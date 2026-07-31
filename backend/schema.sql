-- Run this once against your MySQL server to set up the vault database.

CREATE DATABASE IF NOT EXISTS final_vault_db;
USE final_vault_db;



CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  identifier VARCHAR(190) NOT NULL UNIQUE,   -- Gmail address or phone number
  password_hash VARCHAR(255) NOT NULL,       -- bcrypt hash, never plain text
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vault_entries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(190) DEFAULT '',
  category VARCHAR(50) DEFAULT 'other',
  username VARCHAR(255) DEFAULT '',
  password VARCHAR(255) DEFAULT '',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
