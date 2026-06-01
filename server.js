// require('dotenv').config();

// const express = require('express');
// const mysql = require('mysql2');
// const cors = require('cors');

// const app = express();

// // ១. ការកំណត់ CORS ឱ្យដើរជាមួយ Frontend (Netlify)
// // អ្នកអាចប្ដូរ '*' ទៅជា URL របស់ Netlify របស់អ្នកនៅពេលក្រោយដើម្បីសុវត្ថិភាពខ្ពស់ (ឧទាហរណ៍៖ 'https://your-app.netlify.app')
// app.use(cors({
//     origin: [
//         'https://pspmartonline.netlify.app', // លុបសញ្ញា / នៅខាងចុងចេញ
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
        'https://pspmartonline.netlify.app',
        'http://localhost:5173'
    ],
    methods: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH'],
    credentials: true
}));

app.use(express.json({ limit: '50mb' }));        // អោយ image base64 ឆ្លងកាត់បាន
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ២. Database Pool with SSL (Aiven Cloud)
const db = mysql.createPool({
    host:     process.env.DB_HOST,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port:     process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: { rejectUnauthorized: false }
});

// ៣. Auto-create tables on startup
db.getConnection((err, connection) => {
    if (err) {
        console.error('Database connection failed:', err.message);
        return;
    }
    console.log('✓ Connected to MySQL Database.');

    // ── products table (full schema) ──────────────────────────────────────
    // JSON columns store arrays/objects; LONGTEXT used for broad MySQL compat
    const createProducts = `
    CREATE TABLE IF NOT EXISTS products (
        id            VARCHAR(64)   PRIMARY KEY,          -- client-generated uid
        category      VARCHAR(100)  NOT NULL DEFAULT 'Other',

        -- parent / base model fields
        name          VARCHAR(255)  NOT NULL,
        price         DECIMAL(12,2) NOT NULL DEFAULT 0,
        stock         INT           DEFAULT NULL,         -- NULL = unlimited
        description   TEXT,
        image         LONGTEXT,                           -- cover image (base64 or URL)
        images        LONGTEXT,                           -- JSON array of image strings

        -- variant options on the parent  e.g. [{label:"Color", options:["Red","Blue"]}]
        variants      LONGTEXT,                           -- JSON array

        -- per-combo pricing on the parent  e.g. {"Color:Red|Storage:128GB":{price:9.99,stock:5}}
        variant_pricing LONGTEXT,                         -- JSON object

        -- child / sub-models  e.g. [{name,price,stock,description,images,variants,variantPricing}]
        child_models  LONGTEXT,                           -- JSON array

        created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
        updated_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );`;

    // ── khqr table ────────────────────────────────────────────────────────
    const createKhqr = `
    CREATE TABLE IF NOT EXISTS khqr (
        id         INT PRIMARY KEY DEFAULT 1,
        image      LONGTEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );`;

    connection.query(createProducts, (e1) => {
        if (e1) console.error('Error creating products table:', e1.message);
        else    console.log('✓ products table ready.');

        connection.query(createKhqr, (e2) => {
            if (e2) console.error('Error creating khqr table:', e2.message);
            else    console.log('✓ khqr table ready.');
            connection.release();
        });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Parse a JSON column coming out of MySQL (may already be object if using json type) */
function safeJson(val) {
    if (val === null || val === undefined) return null;
    if (typeof val === 'object') return val;
    try { return JSON.parse(val); } catch { return null; }
}

/** Stringify a value for storage; null stays null */
function toJson(val) {
    if (val === null || val === undefined) return null;
    if (typeof val === 'string') return val; // already serialised
    return JSON.stringify(val);
}

/** Hydrate a raw DB row into the shape ProductDetail.jsx expects */
function hydrateProduct(row) {
    if (!row) return null;
    return {
        id:             row.id,
        category:       row.category,
        name:           row.name,
        price:          Number(row.price),
        stock:          row.stock,                          // null = unlimited
        description:    row.description,
        image:          row.image,                          // cover (backward compat)
        images:         safeJson(row.images)   || [],
        variants:       safeJson(row.variants) || [],
        variantPricing: safeJson(row.variant_pricing) || null,
        childModels:    safeJson(row.child_models)    || null,
        created_at:     row.created_at,
        updated_at:     row.updated_at,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCTS API
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/products  — all products, newest first
app.get('/api/products', (req, res) => {
    db.query('SELECT * FROM products ORDER BY created_at DESC', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows.map(hydrateProduct));
    });
});

// GET /api/products/:id  — single product
app.get('/api/products/:id', (req, res) => {
    db.query('SELECT * FROM products WHERE id = ?', [req.params.id], (err, rows) => {
        if (err)          return res.status(500).json({ error: err.message });
        if (!rows.length) return res.status(404).json({ message: 'Product not found' });
        res.json(hydrateProduct(rows[0]));
    });
});

// POST /api/products  — create product
// Body matches exactly what ManageProducts.jsx sends via addProduct(...)
app.post('/api/products', (req, res) => {
    const {
        id,               // uid from client
        category,
        name,
        price,
        stock,
        description,
        image,            // cover / backward-compat
        images,           // array
        variants,
        variantPricing,
        childModels,
    } = req.body;

    if (!name || price === undefined) {
        return res.status(400).json({ error: 'name and price are required.' });
    }

    // Use client id if given, otherwise generate one server-side
    const productId = id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 6));

    // Resolve cover image: use explicit image field, fall back to first of images array
    const coverImage = image || (Array.isArray(images) && images[0]) || null;

    const sql = `
        INSERT INTO products
            (id, category, name, price, stock, description, image, images,
             variants, variant_pricing, child_models)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [
        productId,
        category  || 'Other',
        name.trim(),
        Number(price) || 0,
        stock !== undefined && stock !== '' ? Number(stock) : null,
        description || null,
        coverImage,
        toJson(images || []),
        toJson(variants || []),
        toJson(variantPricing || null),
        toJson(childModels  || null),
    ];

    db.query(sql, values, (err) => {
        if (err) return res.status(500).json({ error: err.message });

        // Return the full hydrated product so the frontend can update state
        db.query('SELECT * FROM products WHERE id = ?', [productId], (err2, rows) => {
            if (err2) return res.status(500).json({ error: err2.message });
            res.status(201).json({
                message: 'Product created successfully.',
                product: hydrateProduct(rows[0]),
            });
        });
    });
});

// PUT /api/products/:id  — full replacement update
app.put('/api/products/:id', (req, res) => {
    const { id } = req.params;
    const {
        category, name, price, stock, description,
        image, images, variants, variantPricing, childModels,
    } = req.body;

    const coverImage = image || (Array.isArray(images) && images[0]) || null;

    const sql = `
        UPDATE products SET
            category        = ?,
            name            = ?,
            price           = ?,
            stock           = ?,
            description     = ?,
            image           = ?,
            images          = ?,
            variants        = ?,
            variant_pricing = ?,
            child_models    = ?
        WHERE id = ?
    `;
    const values = [
        category || 'Other',
        (name || '').trim(),
        Number(price) || 0,
        stock !== undefined && stock !== '' ? Number(stock) : null,
        description || null,
        coverImage,
        toJson(images || []),
        toJson(variants || []),
        toJson(variantPricing || null),
        toJson(childModels  || null),
        id,
    ];

    db.query(sql, values, (err, result) => {
        if (err)                    return res.status(500).json({ error: err.message });
        if (!result.affectedRows)   return res.status(404).json({ message: 'Product not found.' });

        db.query('SELECT * FROM products WHERE id = ?', [id], (err2, rows) => {
            if (err2) return res.status(500).json({ error: err2.message });
            res.json({ message: 'Product updated successfully.', product: hydrateProduct(rows[0]) });
        });
    });
});

// PATCH /api/products/:id  — partial update (e.g. update stock only)
app.patch('/api/products/:id', (req, res) => {
    const { id } = req.params;
    const allowed = ['category','name','price','stock','description','image','images','variants','variant_pricing','child_models'];
    const dbMap   = { variantPricing:'variant_pricing', childModels:'child_models' };

    const fields = [];
    const values = [];

    Object.entries(req.body).forEach(([key, val]) => {
        const col = dbMap[key] || key;
        if (!allowed.includes(col)) return;
        const jsonCols = ['images','variants','variant_pricing','child_models'];
        fields.push(`${col} = ?`);
        values.push(jsonCols.includes(col) ? toJson(val) : val);
    });

    if (!fields.length) return res.status(400).json({ error: 'No valid fields to update.' });
    values.push(id);

    db.query(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`, values, (err, result) => {
        if (err)                  return res.status(500).json({ error: err.message });
        if (!result.affectedRows) return res.status(404).json({ message: 'Product not found.' });

        db.query('SELECT * FROM products WHERE id = ?', [id], (err2, rows) => {
            if (err2) return res.status(500).json({ error: err2.message });
            res.json({ message: 'Product patched successfully.', product: hydrateProduct(rows[0]) });
        });
    });
});

// DELETE /api/products/:id
app.delete('/api/products/:id', (req, res) => {
    db.query('DELETE FROM products WHERE id = ?', [req.params.id], (err, result) => {
        if (err)                  return res.status(500).json({ error: err.message });
        if (!result.affectedRows) return res.status(404).json({ message: 'Product not found.' });
        res.json({ message: 'Product deleted successfully.' });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// KHQR API  (payment QR image — single row, id=1)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/khqr
app.get('/api/khqr', (req, res) => {
    db.query('SELECT image FROM khqr WHERE id = 1', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ image: rows[0]?.image || null });
    });
});

// PUT /api/khqr  — upsert (insert or replace)
app.put('/api/khqr', (req, res) => {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: 'image is required.' });

    const sql = `
        INSERT INTO khqr (id, image) VALUES (1, ?)
        ON DUPLICATE KEY UPDATE image = VALUES(image)
    `;
    db.query(sql, [image], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'KHQR updated successfully.' });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Health check
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
    db.query('SELECT 1', (err) => {
        if (err) return res.status(503).json({ status: 'db_error', error: err.message });
        res.json({ status: 'ok' });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Start server
// ─────────────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✓ Server running on port ${PORT}`));









