require('dotenv').config();

const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();

// ១. ការកំណត់ CORS ឱ្យដើរជាមួយ Frontend (Netlify)
// អ្នកអាចប្ដូរ '*' ទៅជា URL របស់ Netlify របស់អ្នកនៅពេលក្រោយដើម្បីសុវត្ថិភាពខ្ពស់ (ឧទាហរណ៍៖ 'https://your-app.netlify.app')
app.use(cors({
    origin: [
        'https://pspmarketonline.netlify.app', // លុបសញ្ញា / នៅខាងចុងចេញ
        'http://localhost:5173'                // បន្ថែមនេះដើម្បីឱ្យអ្នកអាចតេស្តនៅលើម៉ាស៊ីនខ្លួនឯងបានដោយមិនលោត Error
    ], 
    methods: ['GET', 'POST', 'DELETE', 'PUT'],
    credentials: true
}));

app.use(express.json());

// ២. ការភ្ជាប់ទៅកាន់ Database Pool (បានបន្ថែម SSL សម្រាប់ Aiven Cloud)
const db = mysql.createPool({
    host: process.env.DB_HOST,          
    user: process.env.DB_USER,          
    password: process.env.DB_PASSWORD,  
    database: process.env.DB_NAME,      
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    // ចំណុចសំខាន់បំផុតសម្រាប់ Aiven Cloud គឺត្រង់នេះ 👇
    ssl: {
        rejectUnauthorized: false
    }
});

// ៣. ពិនិត្យការភ្ជាប់ខ្សែ និងបង្កើត Table 'products' ដោយស្វ័យប្រវត្តិតែម្តង
db.getConnection((err, connection) => {
    if (err) {
        console.error('Database connection failed: ' + err.message);
    } else {
        console.log('Connected to MySQL Database.');
        
        // បើកការបង្កើតតារាង products បើមិនទាន់មាននៅក្នុង Aiven Cloud
        const createTableQuery = `
        CREATE TABLE IF NOT EXISTS products (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            price DECIMAL(10, 2) NOT NULL,
            category VARCHAR(100) NOT NULL,
            description TEXT,
            image LONGTEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );`;

        connection.query(createTableQuery, (tableErr) => {
            if (tableErr) {
                console.error('Error creating table: ', tableErr.message);
            } else {
                console.log('Products table checked/created successfully!');
            }
            connection.release(); // ផ្តាច់ការទាក់ទងបណ្តោះអាសន្នដើម្បីទុកឱ្យ API ប្រើ
        });
    }
});

// ------------------- API ENDPOINTS -------------------

// ១. GET: ទាញយកផលិតផលទាំងអស់ពី Database
app.get('/api/products', (req, res) => {
    const sql = 'SELECT * FROM products ORDER BY id DESC';
    db.query(sql, (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});

// ២. POST: បញ្ចូលផលិតផលថ្មីទៅក្នុង Database
app.post('/api/products', (req, res) => {
    const { name, price, category, description, image } = req.body;
    
    if (!name || !price) {
        return res.status(400).json({ error: 'Name and price are required' });
    }

    const sql = 'INSERT INTO products (name, price, category, description, image) VALUES (?, ?, ?, ?, ?)';
    const values = [name, price, category, description, image];

    db.query(sql, values, (err, result) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ 
            message: 'Product added successfully', 
            id: result.insertId,
            product: { id: result.insertId, name, price, category, description, image }
        });
    });
});

// ៣. DELETE: លុបផលិតផលតាម ID
app.delete('/api/products/:id', (req, res) => {
    const { id } = req.params;
    const sql = 'DELETE FROM products WHERE id = ?';

    db.query(sql, [id], (err, result) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.json({ message: 'Product deleted successfully' });
    });
});

// ៤. ដំណើរការ Server ឱ្យស្តាប់ការហៅចូល
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});