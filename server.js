// 1. Put this at the absolute top of server.js
require('dotenv').config();

const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();

// 2. Paste your updated database configuration here
const db = mysql.createPool({
    host: process.env.DB_HOST,          
    user: process.env.DB_USER,          
    password: process.env.DB_PASSWORD,  
    database: process.env.DB_NAME,      
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// ... your API routes (app.get, app.post, etc.) go here ...

// 3. Update your app listen at the bottom of server.js
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Test connection
db.getConnection((err, connection) => {
    if (err) {
        console.error('Database connection failed: ' + err.message);
    } else {
        console.log('Connected to MySQL Database.');
        connection.release();
    }
});

// ---------------- API ENDPOINTS ----------------

// 1. GET: Fetch all products from the database
app.get('/api/products', (req, res) => {
    const sql = 'SELECT * FROM products ORDER BY id DESC';
    db.query(sql, (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});

// 2. POST: Insert a new product into the database
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

// 3. DELETE: Remove a product by ID
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

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});