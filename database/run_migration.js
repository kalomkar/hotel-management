const pool = require('./db');

async function runMigration() {
    console.log("Running Razorpay Database Migration...");
    const connection = await pool.getConnection();
    try {
        // 1. Modify orders status
        console.log("Updating 'orders' table status column...");
        await connection.query(`
            ALTER TABLE orders 
            MODIFY COLUMN status ENUM('Pending', 'Confirmed', 'Preparing', 'Completed', 'Cancelled') DEFAULT 'Pending'
        `);

        // 2. Modify payments columns
        console.log("Updating 'payments' table columns...");
        await connection.query(`
            ALTER TABLE payments 
            MODIFY COLUMN payment_mode ENUM('Cash', 'UPI', 'Online', 'Card', 'Net Banking', 'Wallet') NOT NULL DEFAULT 'Cash'
        `);

        // Check if razorpay columns exist, if not add them
        const [columns] = await connection.query("SHOW COLUMNS FROM payments");
        const columnNames = columns.map(c => c.Field);

        if (!columnNames.includes('razorpay_order_id')) {
            await connection.query("ALTER TABLE payments ADD COLUMN razorpay_order_id VARCHAR(100) NULL AFTER status");
            console.log("Added razorpay_order_id to payments");
        }
        if (!columnNames.includes('razorpay_payment_id')) {
            await connection.query("ALTER TABLE payments ADD COLUMN razorpay_payment_id VARCHAR(100) NULL AFTER razorpay_order_id");
            console.log("Added razorpay_payment_id to payments");
        }
        if (!columnNames.includes('razorpay_signature')) {
            await connection.query("ALTER TABLE payments ADD COLUMN razorpay_signature VARCHAR(255) NULL AFTER razorpay_payment_id");
            console.log("Added razorpay_signature to payments");
        }

        // 3. Create online_payments table
        console.log("Creating 'online_payments' table...");
        await connection.query(`
            CREATE TABLE IF NOT EXISTS online_payments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                order_id INT NOT NULL,
                customer_name VARCHAR(100),
                customer_mobile VARCHAR(15),
                order_items TEXT,
                amount DECIMAL(10, 2) NOT NULL,
                razorpay_order_id VARCHAR(100) NOT NULL,
                razorpay_payment_id VARCHAR(100),
                razorpay_signature VARCHAR(255),
                payment_status ENUM('Pending', 'Success', 'Failed') DEFAULT 'Pending',
                payment_method VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
            )
        `);

        console.log("✅ Razorpay Database Migration completed successfully!");
    } catch (err) {
        console.error("❌ Migration failed:", err.message);
    } finally {
        connection.release();
        process.exit();
    }
}

runMigration();
