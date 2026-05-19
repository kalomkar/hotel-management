-- ============================================================
-- Razorpay Payment Integration - Database Migration
-- Run this in phpMyAdmin or MySQL CLI
-- Database: basaveshwar_hotel
-- ============================================================

USE basaveshwar_hotel;

-- ─────────────────────────────────────────────────────────────────
-- 1. Add "Confirmed" & "Online" options to existing tables
-- ─────────────────────────────────────────────────────────────────

-- Add 'Confirmed' status to orders table
ALTER TABLE orders
  MODIFY COLUMN status ENUM('Pending', 'Confirmed', 'Preparing', 'Completed', 'Cancelled') DEFAULT 'Pending';

-- Extend payments table with Razorpay fields
ALTER TABLE payments
  MODIFY COLUMN payment_mode ENUM('Cash', 'UPI', 'Online', 'Card', 'Net Banking', 'Wallet') NOT NULL DEFAULT 'Cash',
  ADD COLUMN IF NOT EXISTS razorpay_order_id   VARCHAR(100) NULL AFTER status,
  ADD COLUMN IF NOT EXISTS razorpay_payment_id VARCHAR(100) NULL AFTER razorpay_order_id,
  ADD COLUMN IF NOT EXISTS razorpay_signature  VARCHAR(255) NULL AFTER razorpay_payment_id;

-- ─────────────────────────────────────────────────────────────────
-- 2. Create online_payments table (full audit trail)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS online_payments (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    order_id            INT NOT NULL,
    customer_name       VARCHAR(100),
    customer_mobile     VARCHAR(15),
    order_items         TEXT,                              -- JSON snapshot
    amount              DECIMAL(10, 2) NOT NULL,
    razorpay_order_id   VARCHAR(100) NOT NULL,
    razorpay_payment_id VARCHAR(100),
    razorpay_signature  VARCHAR(255),
    payment_status      ENUM('Pending', 'Success', 'Failed') DEFAULT 'Pending',
    payment_method      VARCHAR(50),                       -- upi / card / netbanking / wallet
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- ─────────────────────────────────────────────────────────────────
-- 3. Verification: check structure
-- ─────────────────────────────────────────────────────────────────
-- DESCRIBE orders;
-- DESCRIBE payments;
-- DESCRIBE online_payments;

SELECT 'Migration complete!' AS status;
