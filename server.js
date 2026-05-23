// require('dotenv').config();

// const express = require('express');
// const mysql = require('mysql2');
// const cors = require('cors');

// const app = express();

// // ១. ការកំណត់ CORS ឱ្យដើរជាមួយ Frontend (Netlify)
// // អ្នកអាចប្ដូរ '*' ទៅជា URL របស់ Netlify របស់អ្នកនៅពេលក្រោយដើម្បីសុវត្ថិភាពខ្ពស់ (ឧទាហរណ៍៖ 'https://your-app.netlify.app')
// app.use(cors({
//     origin: [
//         'https://pspmarketonline.netlify.app', // លុបសញ្ញា / នៅខាងចុងចេញ
//         'http://localhost:5173'                // បន្ថែមនេះដើម្បីឱ្យអ្នកអាចតេស្តនៅលើម៉ាស៊ីនខ្លួនឯងបានដោយមិនលោត Error
//     ], 
//     methods: ['GET', 'POST', 'DELETE', 'PUT'],
//     credentials: true
// }));

// app.use(express.json());

// // ២. ការភ្ជាប់ទៅកាន់ Database Pool (បានបន្ថែម SSL សម្រាប់ Aiven Cloud)
// const db = mysql.createPool({
//     host: process.env.DB_HOST,          
//     user: process.env.DB_USER,          
//     password: process.env.DB_PASSWORD,  
//     database: process.env.DB_NAME,      
//     port: process.env.DB_PORT || 3306,
//     waitForConnections: true,
//     connectionLimit: 10,
//     queueLimit: 0,
//     // ចំណុចសំខាន់បំផុតសម្រាប់ Aiven Cloud គឺត្រង់នេះ 👇
//     ssl: {
//         rejectUnauthorized: false
//     }
// });

// // ៣. ពិនិត្យការភ្ជាប់ខ្សែ និងបង្កើត Table 'products' ដោយស្វ័យប្រវត្តិតែម្តង
// db.getConnection((err, connection) => {
//     if (err) {
//         console.error('Database connection failed: ' + err.message);
//     } else {
//         console.log('Connected to MySQL Database.');
        
//         // បើកការបង្កើតតារាង products បើមិនទាន់មាននៅក្នុង Aiven Cloud
//         const createTableQuery = `
//         CREATE TABLE IF NOT EXISTS products (
//             id INT AUTO_INCREMENT PRIMARY KEY,
//             name VARCHAR(255) NOT NULL,
//             price DECIMAL(10, 2) NOT NULL,
//             category VARCHAR(100) NOT NULL,
//             description TEXT,
//             image LONGTEXT,
//             created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
//         );`;

//         connection.query(createTableQuery, (tableErr) => {
//             if (tableErr) {
//                 console.error('Error creating table: ', tableErr.message);
//             } else {
//                 console.log('Products table checked/created successfully!');
//             }
//             connection.release(); // ផ្តាច់ការទាក់ទងបណ្តោះអាសន្នដើម្បីទុកឱ្យ API ប្រើ
//         });
//     }
// });

// // ------------------- API ENDPOINTS -------------------

// // ១. GET: ទាញយកផលិតផលទាំងអស់ពី Database
// app.get('/api/products', (req, res) => {
//     const sql = 'SELECT * FROM products ORDER BY id DESC';
//     db.query(sql, (err, results) => {
//         if (err) {
//             return res.status(500).json({ error: err.message });
//         }
//         res.json(results);
//     });
// });

// // ២. POST: បញ្ចូលផលិតផលថ្មីទៅក្នុង Database
// app.post('/api/products', (req, res) => {
//     const { name, price, category, description, image } = req.body;
    
//     if (!name || !price) {
//         return res.status(400).json({ error: 'Name and price are required' });
//     }

//     const sql = 'INSERT INTO products (name, price, category, description, image) VALUES (?, ?, ?, ?, ?)';
//     const values = [name, price, category, description, image];

//     db.query(sql, values, (err, result) => {
//         if (err) {
//             return res.status(500).json({ error: err.message });
//         }
//         res.status(201).json({ 
//             message: 'Product added successfully', 
//             id: result.insertId,
//             product: { id: result.insertId, name, price, category, description, image }
//         });
//     });
// });

// // ៣. DELETE: លុបផលិតផលតាម ID
// app.delete('/api/products/:id', (req, res) => {
//     const { id } = req.params;
//     const sql = 'DELETE FROM products WHERE id = ?';

//     db.query(sql, [id], (err, result) => {
//         if (err) {
//             return res.status(500).json({ error: err.message });
//         }
//         if (result.affectedRows === 0) {
//             return res.status(404).json({ message: 'Product not found' });
//         }
//         res.json({ message: 'Product deleted successfully' });
//     });
// });

// // ៤. ដំណើរការ Server ឱ្យស្តាប់ការហៅចូល
// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => {
//     console.log(`Server running on port ${PORT}`);
// });







































require('dotenv').config();

const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();

// ១. CORS Configuration
app.use(cors({
    origin: [
        'https://pspmarketonline.netlify.app',
        'http://localhost:5173'
    ], 
    methods: ['GET', 'POST', 'DELETE', 'PUT'],
    credentials: true
}));

app.use(express.json());

// ២. Database Pool (Aiven Cloud with SSL)
const db = mysql.createPool({
    host: process.env.DB_HOST,          
    user: process.env.DB_USER,          
    password: process.env.DB_PASSWORD,  
    database: process.env.DB_NAME,      
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: {
        rejectUnauthorized: false
    }
});

// ៣. Create tables on startup
db.getConnection((err, connection) => {
    if (err) {
        console.error('Database connection failed: ' + err.message);
    } else {
        console.log('Connected to MySQL Database.');

        // Products table
        connection.query(`
            CREATE TABLE IF NOT EXISTS products (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                price DECIMAL(10, 2) NOT NULL,
                category VARCHAR(100) NOT NULL,
                description TEXT,
                image LONGTEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `, (tableErr) => {
            if (tableErr) {
                console.error('Error creating products table:', tableErr.message);
            } else {
                console.log('Products table checked/created successfully!');
            }
        });

        // 🌟 Payment sessions table for auto-confirmation
        connection.query(`
            CREATE TABLE IF NOT EXISTS payment_sessions (
                session_id VARCHAR(100) PRIMARY KEY,
                amount DECIMAL(10, 2) NOT NULL,
                customer_name VARCHAR(255),
                status VARCHAR(20) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `, (tableErr) => {
            if (tableErr) {
                console.error('Error creating payment_sessions table:', tableErr.message);
            } else {
                console.log('Payment sessions table checked/created successfully!');
            }
            connection.release();
        });
    }
});


// ==========================================
//         PRODUCTS API ENDPOINTS
// ==========================================

// GET: Fetch all products
app.get('/api/products', (req, res) => {
    const sql = 'SELECT * FROM products ORDER BY id DESC';
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// POST: Add new product
app.post('/api/products', (req, res) => {
    const { name, price, category, description, image } = req.body;
    if (!name || !price) {
        return res.status(400).json({ error: 'Name and price are required' });
    }
    const sql = 'INSERT INTO products (name, price, category, description, image) VALUES (?, ?, ?, ?, ?)';
    db.query(sql, [name, price, category, description, image], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ 
            message: 'Product added successfully', 
            id: result.insertId,
            product: { id: result.insertId, name, price, category, description, image }
        });
    });
});

// DELETE: Remove product by ID
app.delete('/api/products/:id', (req, res) => {
    const { id } = req.params;
    db.query('DELETE FROM products WHERE id = ?', [id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Product not found' });
        res.json({ message: 'Product deleted successfully' });
    });
});


// ==========================================
//     🌟 PAYMENT SESSION API ENDPOINTS
// ==========================================

// POST: Frontend creates a new pending payment session when QR modal opens
app.post('/api/payments/create', (req, res) => {
    const { sessionId, amount, customerName } = req.body;

    if (!sessionId || !amount) {
        return res.status(400).json({ error: 'sessionId and amount are required' });
    }

    const sql = `
        INSERT INTO payment_sessions (session_id, amount, customer_name, status) 
        VALUES (?, ?, ?, 'pending')
        ON DUPLICATE KEY UPDATE status = 'pending', created_at = CURRENT_TIMESTAMP
    `;

    db.query(sql, [sessionId, amount, customerName], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        console.log(`[PAYMENT] Session created: ${sessionId} | Amount: $${amount} | Customer: ${customerName}`);
        res.json({ success: true, sessionId });
    });
});

// GET: Frontend polls this every 3 seconds to check payment status
app.get('/api/payments/status/:sessionId', (req, res) => {
    const { sessionId } = req.params;

    db.query('SELECT status FROM payment_sessions WHERE session_id = ?', [sessionId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!results.length) return res.json({ status: 'not_found' });
        res.json({ status: results[0].status });
    });
});

// POST: 🤖 Telegram bot calls this when bank payment arrives
// Body: { secret: "your_secret_key", sessionId: "pay_xxx" }
// 
// How to call from your Telegram bot:
//   await fetch('https://your-backend.railway.app/api/payments/confirm', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({ secret: process.env.CONFIRM_SECRET, sessionId: 'pay_xxx' })
//   });
app.post('/api/payments/confirm', (req, res) => {
    const { secret, sessionId } = req.body;

    // 🔒 Protect with secret key — set CONFIRM_SECRET in your .env file
    if (!secret || secret !== process.env.CONFIRM_SECRET) {
        console.warn(`[PAYMENT] Unauthorized confirm attempt for session: ${sessionId}`);
        return res.status(403).json({ error: 'Unauthorized' });
    }

    if (!sessionId) {
        return res.status(400).json({ error: 'sessionId is required' });
    }

    const sql = `
        UPDATE payment_sessions 
        SET status = 'paid' 
        WHERE session_id = ? AND status = 'pending'
    `;

    db.query(sql, [sessionId], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Session not found or already confirmed' });
        }
        console.log(`[PAYMENT] ✅ Confirmed: ${sessionId}`);
        res.json({ success: true, message: `Payment confirmed for session ${sessionId}` });
    });
});

// (Optional) GET: List all pending sessions — useful for admin dashboard
app.get('/api/payments/pending', (req, res) => {
    const secret = req.headers['x-admin-secret'];
    if (!secret || secret !== process.env.CONFIRM_SECRET) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    db.query(
        `SELECT * FROM payment_sessions WHERE status = 'pending' ORDER BY created_at DESC`,
        (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(results);
        }
    );
});


// ==========================================
//              START SERVER
// ==========================================

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// GET: Tap-to-confirm link from Telegram (no bot needed)
app.get('/api/payments/confirm-link', (req, res) => {
    const { secret, sessionId } = req.query;

    if (!secret || secret !== process.env.CONFIRM_SECRET) {
        return res.status(403).send('❌ Unauthorized');
    }

    if (!sessionId) {
        return res.status(400).send('❌ Missing sessionId');
    }

    const sql = `UPDATE payment_sessions SET status = 'paid' 
                 WHERE session_id = ? AND status = 'pending'`;

    db.query(sql, [sessionId], (err, result) => {
        if (err) return res.status(500).send('❌ Database error');
        if (result.affectedRows === 0) {
            return res.send('⚠️ Already confirmed or session not found');
        }
        console.log(`[PAYMENT] ✅ Confirmed via link: ${sessionId}`);
        // Simple success page that shows in Telegram browser
        res.send(`
            <html><body style="font-family:sans-serif;text-align:center;padding:40px">
                <h1>✅ Payment Confirmed!</h1>
                <p>Session: <b>${sessionId}</b></p>
                <p style="color:green;font-size:20px">Customer order is now processing.</p>
            </body></html>
        `);
    });
});

/*
==============================================
  🤖 TELEGRAM BOT INTEGRATION GUIDE
==============================================

When your Telegram bot receives a bank payment notification,
have it call /api/payments/confirm like this:

  // Bot listens for admin command: /confirm pay_1234567_5678
  bot.onText(/\/confirm (.+)/, async (msg, match) => {
    const sessionId = match[1].trim();
    
    const res = await fetch('https://your-backend.railway.app/api/payments/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: process.env.CONFIRM_SECRET,
        sessionId: sessionId
      })
    });
    
    const data = await res.json();
    if (data.success) {
      bot.sendMessage(msg.chat.id, `✅ Payment confirmed! Session: ${sessionId}`);
    } else {
      bot.sendMessage(msg.chat.id, `❌ Error: ${data.error}`);
    }
  });

  The Session ID is shown in the QR modal and also included
  in the Telegram order alert message automatically.

==============================================
  📄 .env FILE — Add this line:
==============================================

  CONFIRM_SECRET=your_super_secret_key_here

==============================================
*/





