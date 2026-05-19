const pool = require('./db');

async function runMigration() {
    console.log("Running Cashier Dashboard Payments Migration...");
    const connection = await pool.getConnection();
    try {
        // 1. Modify payments columns and constraints
        console.log("Altering 'payments' table columns...");

        // Check columns first
        const [columns] = await connection.query("SHOW COLUMNS FROM payments");
        const columnNames = columns.map(c => c.Field);

        // Modify payment_mode and status
        await connection.query(`
            ALTER TABLE payments 
            MODIFY COLUMN payment_mode ENUM('Cash', 'Manual UPI', 'Card Swipe', 'Razorpay', 'UPI', 'Card', 'Wallet', 'Net Banking', 'Online') NOT NULL DEFAULT 'Cash'
        `);

        await connection.query(`
            ALTER TABLE payments 
            MODIFY COLUMN status ENUM('Success', 'Failed', 'Pending') NOT NULL DEFAULT 'Success'
        `);

        // Add payment_type
        if (!columnNames.includes('payment_type')) {
            await connection.query(`
                ALTER TABLE payments 
                ADD COLUMN payment_type ENUM('Online', 'Offline') NOT NULL DEFAULT 'Offline' AFTER payment_mode
            `);
            console.log("Added payment_type to payments");
        }

        // Add cashier_id
        if (!columnNames.includes('cashier_id')) {
            await connection.query(`
                ALTER TABLE payments 
                ADD COLUMN cashier_id INT NULL AFTER order_id
            `);
            console.log("Added cashier_id to payments");

            // Add foreign key constraint safely
            try {
                await connection.query(`
                    ALTER TABLE payments 
                    ADD CONSTRAINT fk_payments_cashier FOREIGN KEY (cashier_id) REFERENCES users(id) ON DELETE SET NULL
                `);
                console.log("Added foreign key constraint fk_payments_cashier");
            } catch (fkErr) {
                console.log("Note: Foreign key constraint might already exist or failed:", fkErr.message);
            }
        }

        console.log("✅ Cashier Payments Migration completed successfully!");
    } catch (err) {
        console.error("❌ Migration failed:", err.message);
    } finally {
        connection.release();
        process.exit();
    }
}

runMigration();
