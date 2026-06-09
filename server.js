

// require('dotenv').config();

// const express = require('express');
// const mysql = require('mysql2');
// const cors = require('cors');

// const app = express();

// // ១. CORS Configuration
// app.use(cors({
//     origin: [
//         'https://pspmartonline.netlify.app',
//         'http://localhost:5173'
//     ],
//     methods: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH'],
//     credentials: true
// }));

// app.use(express.json({ limit: '50mb' }));        // អោយ image base64 ឆ្លងកាត់បាន
// app.use(express.urlencoded({ limit: '50mb', extended: true }));

// // ២. Database Pool with SSL (Aiven Cloud)
// const db = mysql.createPool({
//     host:     process.env.DB_HOST,
//     user:     process.env.DB_USER,
//     password: process.env.DB_PASSWORD,
//     database: process.env.DB_NAME,
//     port:     process.env.DB_PORT || 3306,
//     waitForConnections: true,
//     connectionLimit: 10,
//     queueLimit: 0,
//     ssl: { rejectUnauthorized: false }
// });

// // ៣. Auto-create + auto-migrate tables on startup
// db.getConnection((err, connection) => {
//     if (err) {
//         console.error('Database connection failed:', err.message);
//         return;
//     }
//     console.log('✓ Connected to MySQL Database.');

//     // ── Step 1: Create tables if they don't exist yet ─────────────────────
//     const createProducts = `
//     CREATE TABLE IF NOT EXISTS products (
//         id          VARCHAR(64)   PRIMARY KEY,
//         category    VARCHAR(100)  NOT NULL DEFAULT 'Other',
//         name        VARCHAR(255)  NOT NULL,
//         price       DECIMAL(12,2) NOT NULL DEFAULT 0,
//         description TEXT,
//         image       LONGTEXT,
//         created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
//     )`;

//     const createKhqr = `
//     CREATE TABLE IF NOT EXISTS khqr (
//         id         INT PRIMARY KEY DEFAULT 1,
//         image      LONGTEXT,
//         updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
//     )`;

//     // ── Step 2: Migration list — adds new columns to existing tables ──────
//     // errno 1060 = "Duplicate column name" → column already exists → safe to ignore
//     const migrations = [
//         // products — new columns
//         `ALTER TABLE products ADD COLUMN stock            INT       DEFAULT NULL`,
//         `ALTER TABLE products ADD COLUMN images           LONGTEXT`,
//         `ALTER TABLE products ADD COLUMN variants         LONGTEXT`,
//         `ALTER TABLE products ADD COLUMN variant_pricing  LONGTEXT`,
//         `ALTER TABLE products ADD COLUMN child_models     LONGTEXT`,
//         `ALTER TABLE products ADD COLUMN updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
//         // products — fix id column type if it was INT before
//         `ALTER TABLE products MODIFY COLUMN id VARCHAR(64) NOT NULL`,
//         // products — fix price precision
//         `ALTER TABLE products MODIFY COLUMN price DECIMAL(12,2) NOT NULL DEFAULT 0`,
//     ];

//     // Run CREATE tables first, then migrations
//     connection.query(createProducts, (e1) => {
//         if (e1) { console.error('Error creating products table:', e1.message); }
//         else    { console.log('✓ products table ready.'); }

//         connection.query(createKhqr, (e2) => {
//             if (e2) { console.error('Error creating khqr table:', e2.message); }
//             else    { console.log('✓ khqr table ready.'); }

//             // Run each migration; ignore "duplicate column" errors
//             let completed = 0;
//             migrations.forEach((sql) => {
//                 connection.query(sql, (me) => {
//                     if (me && me.errno !== 1060 && me.errno !== 1091) {
//                         // 1060 = duplicate column, 1091 = cant drop non-existing — both are fine
//                         console.warn('Migration warning:', me.message);
//                     }
//                     completed++;
//                     if (completed === migrations.length) {
//                         console.log('✓ All migrations applied.');
//                         connection.release();
//                     }
//                 });
//             });
//         });
//     });
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // Helpers
// // ─────────────────────────────────────────────────────────────────────────────

// /** Parse a JSON column coming out of MySQL (may already be object if using json type) */
// function safeJson(val) {
//     if (val === null || val === undefined) return null;
//     if (typeof val === 'object') return val;
//     try { return JSON.parse(val); } catch { return null; }
// }

// /** Stringify a value for storage; null stays null */
// function toJson(val) {
//     if (val === null || val === undefined) return null;
//     if (typeof val === 'string') return val; // already serialised
//     return JSON.stringify(val);
// }

// /** Hydrate a raw DB row into the shape ProductDetail.jsx expects */
// function hydrateProduct(row) {
//     if (!row) return null;
//     return {
//         id:             row.id,
//         category:       row.category,
//         name:           row.name,
//         price:          Number(row.price),
//         stock:          row.stock,                          // null = unlimited
//         description:    row.description,
//         image:          row.image,                          // cover (backward compat)
//         images:         safeJson(row.images)   || [],
//         variants:       safeJson(row.variants) || [],
//         variantPricing: safeJson(row.variant_pricing) || null,
//         childModels:    safeJson(row.child_models)    || null,
//         created_at:     row.created_at,
//         updated_at:     row.updated_at,
//     };
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // PRODUCTS API
// // ─────────────────────────────────────────────────────────────────────────────

// // GET /api/products  — all products, newest first
// app.get('/api/products', (req, res) => {
//     db.query('SELECT * FROM products ORDER BY created_at DESC', (err, rows) => {
//         if (err) return res.status(500).json({ error: err.message });
//         res.json(rows.map(hydrateProduct));
//     });
// });

// // GET /api/products/:id  — single product
// app.get('/api/products/:id', (req, res) => {
//     db.query('SELECT * FROM products WHERE id = ?', [req.params.id], (err, rows) => {
//         if (err)          return res.status(500).json({ error: err.message });
//         if (!rows.length) return res.status(404).json({ message: 'Product not found' });
//         res.json(hydrateProduct(rows[0]));
//     });
// });

// // POST /api/products  — create product
// // Body matches exactly what ManageProducts.jsx sends via addProduct(...)
// app.post('/api/products', (req, res) => {
//     const {
//         id,               // uid from client
//         category,
//         name,
//         price,
//         stock,
//         description,
//         image,            // cover / backward-compat
//         images,           // array
//         variants,
//         variantPricing,
//         childModels,
//     } = req.body;

//     if (!name || price === undefined) {
//         return res.status(400).json({ error: 'name and price are required.' });
//     }

//     // Use client id if given, otherwise generate one server-side
//     const productId = id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 6));

//     // Resolve cover image: use explicit image field, fall back to first of images array
//     const coverImage = image || (Array.isArray(images) && images[0]) || null;

//     const sql = `
//         INSERT INTO products
//             (id, category, name, price, stock, description, image, images,
//              variants, variant_pricing, child_models)
//         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
//     `;
//     const values = [
//         productId,
//         category  || 'Other',
//         name.trim(),
//         Number(price) || 0,
//         stock !== undefined && stock !== '' ? Number(stock) : null,
//         description || null,
//         coverImage,
//         toJson(images || []),
//         toJson(variants || []),
//         toJson(variantPricing || null),
//         toJson(childModels  || null),
//     ];

//     db.query(sql, values, (err) => {
//         if (err) return res.status(500).json({ error: err.message });

//         // Return the full hydrated product so the frontend can update state
//         db.query('SELECT * FROM products WHERE id = ?', [productId], (err2, rows) => {
//             if (err2) return res.status(500).json({ error: err2.message });
//             res.status(201).json({
//                 message: 'Product created successfully.',
//                 product: hydrateProduct(rows[0]),
//             });
//         });
//     });
// });

// // PUT /api/products/:id  — full replacement update
// app.put('/api/products/:id', (req, res) => {
//     const { id } = req.params;
//     const {
//         category, name, price, stock, description,
//         image, images, variants, variantPricing, childModels,
//     } = req.body;

//     const coverImage = image || (Array.isArray(images) && images[0]) || null;

//     const sql = `
//         UPDATE products SET
//             category        = ?,
//             name            = ?,
//             price           = ?,
//             stock           = ?,
//             description     = ?,
//             image           = ?,
//             images          = ?,
//             variants        = ?,
//             variant_pricing = ?,
//             child_models    = ?
//         WHERE id = ?
//     `;
//     const values = [
//         category || 'Other',
//         (name || '').trim(),
//         Number(price) || 0,
//         stock !== undefined && stock !== '' ? Number(stock) : null,
//         description || null,
//         coverImage,
//         toJson(images || []),
//         toJson(variants || []),
//         toJson(variantPricing || null),
//         toJson(childModels  || null),
//         id,
//     ];

//     db.query(sql, values, (err, result) => {
//         if (err)                    return res.status(500).json({ error: err.message });
//         if (!result.affectedRows)   return res.status(404).json({ message: 'Product not found.' });

//         db.query('SELECT * FROM products WHERE id = ?', [id], (err2, rows) => {
//             if (err2) return res.status(500).json({ error: err2.message });
//             res.json({ message: 'Product updated successfully.', product: hydrateProduct(rows[0]) });
//         });
//     });
// });

// // PATCH /api/products/:id  — partial update (e.g. update stock only)
// app.patch('/api/products/:id', (req, res) => {
//     const { id } = req.params;
//     const allowed = ['category','name','price','stock','description','image','images','variants','variant_pricing','child_models'];
//     const dbMap   = { variantPricing:'variant_pricing', childModels:'child_models' };

//     const fields = [];
//     const values = [];

//     Object.entries(req.body).forEach(([key, val]) => {
//         const col = dbMap[key] || key;
//         if (!allowed.includes(col)) return;
//         const jsonCols = ['images','variants','variant_pricing','child_models'];
//         fields.push(`${col} = ?`);
//         values.push(jsonCols.includes(col) ? toJson(val) : val);
//     });

//     if (!fields.length) return res.status(400).json({ error: 'No valid fields to update.' });
//     values.push(id);

//     db.query(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`, values, (err, result) => {
//         if (err)                  return res.status(500).json({ error: err.message });
//         if (!result.affectedRows) return res.status(404).json({ message: 'Product not found.' });

//         db.query('SELECT * FROM products WHERE id = ?', [id], (err2, rows) => {
//             if (err2) return res.status(500).json({ error: err2.message });
//             res.json({ message: 'Product patched successfully.', product: hydrateProduct(rows[0]) });
//         });
//     });
// });

// // DELETE /api/products/:id
// app.delete('/api/products/:id', (req, res) => {
//     db.query('DELETE FROM products WHERE id = ?', [req.params.id], (err, result) => {
//         if (err)                  return res.status(500).json({ error: err.message });
//         if (!result.affectedRows) return res.status(404).json({ message: 'Product not found.' });
//         res.json({ message: 'Product deleted successfully.' });
//     });
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // KHQR API  (payment QR image — single row, id=1)
// // ─────────────────────────────────────────────────────────────────────────────

// // GET /api/khqr
// app.get('/api/khqr', (req, res) => {
//     db.query('SELECT image FROM khqr WHERE id = 1', (err, rows) => {
//         if (err) return res.status(500).json({ error: err.message });
//         res.json({ image: rows[0]?.image || null });
//     });
// });

// // PUT /api/khqr  — upsert (insert or replace)
// app.put('/api/khqr', (req, res) => {
//     const { image } = req.body;
//     if (!image) return res.status(400).json({ error: 'image is required.' });

//     const sql = `
//         INSERT INTO khqr (id, image) VALUES (1, ?)
//         ON DUPLICATE KEY UPDATE image = VALUES(image)
//     `;
//     db.query(sql, [image], (err) => {
//         if (err) return res.status(500).json({ error: err.message });
//         res.json({ message: 'KHQR updated successfully.' });
//     });
// });


// // ─────────────────────────────────────────────────────────────────────────────
// // Health check
// // ─────────────────────────────────────────────────────────────────────────────
// app.get('/api/health', (req, res) => {
//     db.query('SELECT 1', (err) => {
//         if (err) return res.status(503).json({ status: 'db_error', error: err.message });
//         res.json({ status: 'ok' });
//     });
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // Start server
// // ─────────────────────────────────────────────────────────────────────────────
// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => console.log(`✓ Server running on port ${PORT}`));




















// require('dotenv').config();

// const express = require('express');
// const mysql = require('mysql2');
// const cors = require('cors');

// const app = express();

// // ១. CORS Configuration
// app.use(cors({
//     origin: [
//         'https://pspmartonline.netlify.app',
//         'http://localhost:5173'
//     ],
//     methods: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH'],
//     credentials: true
// }));

// app.use(express.json({ limit: '50mb' }));
// app.use(express.urlencoded({ limit: '50mb', extended: true }));

// // ២. Database Pool with SSL (Aiven Cloud)
// const db = mysql.createPool({
//     host:     process.env.DB_HOST,
//     user:     process.env.DB_USER,
//     password: process.env.DB_PASSWORD,
//     database: process.env.DB_NAME,
//     port:     process.env.DB_PORT || 3306,
//     waitForConnections: true,
//     connectionLimit: 10,
//     queueLimit: 0,
//     ssl: { rejectUnauthorized: false }
// });

// // ៣. Auto-create + auto-migrate tables on startup
// db.getConnection((err, connection) => {
    
//     if (err) {
//         console.error('Database connection failed:', err.message);
//         return;
//     }
//     console.log('✓ Connected to MySQL Database.');

//     const createProducts = `
//     CREATE TABLE IF NOT EXISTS products (
//         id          VARCHAR(64)   PRIMARY KEY,
//         category    VARCHAR(100)  NOT NULL DEFAULT 'Other',
//         name        VARCHAR(255)  NOT NULL,
//         price       DECIMAL(12,2) NOT NULL DEFAULT 0,
//         description TEXT,
//         image       LONGTEXT,
//         created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
//     )`;

//     const createKhqr = `
//     CREATE TABLE IF NOT EXISTS khqr (
//         id         INT PRIMARY KEY DEFAULT 1,
//         image      LONGTEXT,
//         updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
//     )`;

//     const createUsers = `
//     CREATE TABLE IF NOT EXISTS users (
//         id            VARCHAR(64)   PRIMARY KEY,
//         name          VARCHAR(255)  NOT NULL,
//         email         VARCHAR(255)  NOT NULL UNIQUE,
//         password_hash VARCHAR(64)   NOT NULL,
//         role          VARCHAR(50)   DEFAULT 'Customer',
//         status        VARCHAR(50)   DEFAULT 'Active',
//         avatar        LONGTEXT,
//         created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
//     )`;

//     const migrations = [
//         `ALTER TABLE products ADD COLUMN stock            INT       DEFAULT NULL`,
//         `ALTER TABLE products ADD COLUMN images           LONGTEXT`,
//         `ALTER TABLE products ADD COLUMN variants         LONGTEXT`,
//         `ALTER TABLE products ADD COLUMN variant_pricing  LONGTEXT`,
//         `ALTER TABLE products ADD COLUMN child_models     LONGTEXT`,
//         `ALTER TABLE products ADD COLUMN updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
//         `ALTER TABLE products MODIFY COLUMN id VARCHAR(64) NOT NULL`,
//         `ALTER TABLE products MODIFY COLUMN price DECIMAL(12,2) NOT NULL DEFAULT 0`,
//     ];

//     connection.query(createProducts, (e1) => {
//         if (e1) console.error('Error creating products table:', e1.message);
//         else    console.log('✓ products table ready.');

//         connection.query(createKhqr, (e2) => {
//             if (e2) console.error('Error creating khqr table:', e2.message);
//             else    console.log('✓ khqr table ready.');

//             connection.query(createUsers, (e3) => {
//                 if (e3) console.error('Error creating users table:', e3.message);
//                 else    console.log('✓ users table ready.');

//                 let completed = 0;
//                 migrations.forEach((sql) => {
//                     connection.query(sql, (me) => {
//                         if (me && me.errno !== 1060 && me.errno !== 1091) {
//                             console.warn('Migration warning:', me.message);
//                         }
//                         completed++;
//                         if (completed === migrations.length) {
//                             console.log('✓ All migrations applied.');
//                             connection.release();
//                         }
//                     });
//                 });
//             });
//         });
//     });
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // Helpers
// // ─────────────────────────────────────────────────────────────────────────────

// function safeJson(val) {
//     if (val === null || val === undefined) return null;
//     if (typeof val === 'object') return val;
//     try { return JSON.parse(val); } catch { return null; }
// }

// function toJson(val) {
//     if (val === null || val === undefined) return null;
//     if (typeof val === 'string') return val;
//     return JSON.stringify(val);
// }

// function hydrateProduct(row) {
//     if (!row) return null;
//     return {
//         id:             row.id,
//         category:       row.category,
//         name:           row.name,
//         price:          Number(row.price),
//         stock:          row.stock,
//         description:    row.description,
//         image:          row.image,
//         images:         safeJson(row.images)   || [],
//         variants:       safeJson(row.variants) || [],
//         variantPricing: safeJson(row.variant_pricing) || null,
//         childModels:    safeJson(row.child_models)    || null,
//         created_at:     row.created_at,
//         updated_at:     row.updated_at,
//     };
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // PRODUCTS API
// // ─────────────────────────────────────────────────────────────────────────────

// app.get('/api/products', (req, res) => {
//     db.query('SELECT * FROM products ORDER BY created_at DESC', (err, rows) => {
//         if (err) return res.status(500).json({ error: err.message });
//         res.json(rows.map(hydrateProduct));
//     });
// });

// app.get('/api/products/:id', (req, res) => {
//     db.query('SELECT * FROM products WHERE id = ?', [req.params.id], (err, rows) => {
//         if (err)          return res.status(500).json({ error: err.message });
//         if (!rows.length) return res.status(404).json({ message: 'Product not found' });
//         res.json(hydrateProduct(rows[0]));
//     });
// });

// app.post('/api/products', (req, res) => {
//     const {
//         id, category, name, price, stock, description,
//         image, images, variants, variantPricing, childModels,
//     } = req.body;

//     if (!name || price === undefined) {
//         return res.status(400).json({ error: 'name and price are required.' });
//     }

//     const productId  = id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
//     const coverImage = image || (Array.isArray(images) && images[0]) || null;

//     const sql = `
//         INSERT INTO products
//             (id, category, name, price, stock, description, image, images,
//              variants, variant_pricing, child_models)
//         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
//     `;
//     const values = [
//         productId,
//         category  || 'Other',
//         name.trim(),
//         Number(price) || 0,
//         stock !== undefined && stock !== '' ? Number(stock) : null,
//         description || null,
//         coverImage,
//         toJson(images || []),
//         toJson(variants || []),
//         toJson(variantPricing || null),
//         toJson(childModels  || null),
//     ];

//     db.query(sql, values, (err) => {
//         if (err) return res.status(500).json({ error: err.message });

//         db.query('SELECT * FROM products WHERE id = ?', [productId], (err2, rows) => {
//             if (err2) return res.status(500).json({ error: err2.message });
//             res.status(201).json({
//                 message: 'Product created successfully.',
//                 product: hydrateProduct(rows[0]),
//             });
//         });
//     });
// });

// app.put('/api/products/:id', (req, res) => {
//     const { id } = req.params;
//     const {
//         category, name, price, stock, description,
//         image, images, variants, variantPricing, childModels,
//     } = req.body;

//     const coverImage = image || (Array.isArray(images) && images[0]) || null;

//     const sql = `
//         UPDATE products SET
//             category        = ?,
//             name            = ?,
//             price           = ?,
//             stock           = ?,
//             description     = ?,
//             image           = ?,
//             images          = ?,
//             variants        = ?,
//             variant_pricing = ?,
//             child_models    = ?
//         WHERE id = ?
//     `;
//     const values = [
//         category || 'Other',
//         (name || '').trim(),
//         Number(price) || 0,
//         stock !== undefined && stock !== '' ? Number(stock) : null,
//         description || null,
//         coverImage,
//         toJson(images || []),
//         toJson(variants || []),
//         toJson(variantPricing || null),
//         toJson(childModels  || null),
//         id,
//     ];

//     db.query(sql, values, (err, result) => {
//         if (err)                    return res.status(500).json({ error: err.message });
//         if (!result.affectedRows)   return res.status(404).json({ message: 'Product not found.' });

//         db.query('SELECT * FROM products WHERE id = ?', [id], (err2, rows) => {
//             if (err2) return res.status(500).json({ error: err2.message });
//             res.json({ message: 'Product updated successfully.', product: hydrateProduct(rows[0]) });
//         });
//     });
// });

// app.patch('/api/products/:id', (req, res) => {
//     const { id } = req.params;
//     const allowed = ['category','name','price','stock','description','image','images','variants','variant_pricing','child_models'];
//     const dbMap   = { variantPricing:'variant_pricing', childModels:'child_models' };

//     const fields = [];
//     const values = [];

//     Object.entries(req.body).forEach(([key, val]) => {
//         const col = dbMap[key] || key;
//         if (!allowed.includes(col)) return;
//         const jsonCols = ['images','variants','variant_pricing','child_models'];
//         fields.push(`${col} = ?`);
//         values.push(jsonCols.includes(col) ? toJson(val) : val);
//     });

//     if (!fields.length) return res.status(400).json({ error: 'No valid fields to update.' });
//     values.push(id);

//     db.query(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`, values, (err, result) => {
//         if (err)                  return res.status(500).json({ error: err.message });
//         if (!result.affectedRows) return res.status(404).json({ message: 'Product not found.' });

//         db.query('SELECT * FROM products WHERE id = ?', [id], (err2, rows) => {
//             if (err2) return res.status(500).json({ error: err2.message });
//             res.json({ message: 'Product patched successfully.', product: hydrateProduct(rows[0]) });
//         });
//     });
// });

// app.delete('/api/products/:id', (req, res) => {
//     db.query('DELETE FROM products WHERE id = ?', [req.params.id], (err, result) => {
//         if (err)                  return res.status(500).json({ error: err.message });
//         if (!result.affectedRows) return res.status(404).json({ message: 'Product not found.' });
//         res.json({ message: 'Product deleted successfully.' });
//     });
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // USERS API
// // ─────────────────────────────────────────────────────────────────────────────

// // POST /api/users/register
// app.post('/api/users/register', (req, res) => {
//     const { id, name, email, passwordHash, role, status } = req.body;

//     if (!name || !email || !passwordHash) {
//         return res.status(400).json({ error: 'name, email, and passwordHash are required.' });
//     }

//     const userId = id || ('USR-' + Date.now());
//     const sql = `
//         INSERT INTO users (id, name, email, password_hash, role, status)
//         VALUES (?, ?, ?, ?, ?, ?)
//     `;
//     db.query(sql, [
//         userId,
//         name.trim(),
//         email.toLowerCase().trim(),
//         passwordHash,
//         role   || 'Customer',
//         status || 'Active',
//     ], (err) => {
//         if (err) {
//             if (err.code === 'ER_DUP_ENTRY') {
//                 return res.status(409).json({ error: 'This email is already registered.' });
//             }
//             return res.status(500).json({ error: err.message });
//         }
//         db.query('SELECT * FROM users WHERE id = ?', [userId], (e2, rows) => {
//             if (e2) return res.status(500).json({ error: e2.message });
//             const u = rows[0];
//             res.status(201).json({
//                 message: 'Registered successfully.',
//                 user: {
//                     id:     u.id,
//                     name:   u.name,
//                     email:  u.email,
//                     role:   u.role,
//                     status: u.status,
//                     avatar: u.avatar || null,
//                     date:   u.created_at ? u.created_at.toISOString().slice(0, 10) : null,
//                 },
//             });
//         });
//     });
// });

// // // POST /api/users/login
// // app.post('/api/users/login', (req, res) => {
// //     const { email, passwordHash } = req.body;

// //     if (!email || !passwordHash) {
// //         return res.status(400).json({ error: 'email and passwordHash are required.' });
// //     }

// //     db.query('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()], (err, rows) => {
// //         if (err) return res.status(500).json({ error: err.message });
// //         if (!rows.length) return res.status(404).json({ error: 'No account found for this email.' });

// //         const u = rows[0];
// //         if (u.password_hash !== passwordHash) {
// //             return res.status(401).json({ error: 'Incorrect password.' });
// //         }

// //         res.json({
// //             user: {
// //                 id:     u.id,
// //                 name:   u.name,
// //                 email:  u.email,
// //                 role:   u.role,
// //                 status: u.status,
// //                 avatar: u.avatar || null,
// //                 date:   u.created_at ? u.created_at.toISOString().slice(0, 10) : null,
// //             },
// //         });
// //     });
// // });
// // POST /api/users/login  ←←← UPDATE THIS
// app.post('/api/users/login', (req, res) => {
//     const { email, passwordHash } = req.body;
//     if (!email || !passwordHash) {
//         return res.status(400).json({ error: 'email and passwordHash are required.' });
//     }

//     db.query('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()], (err, rows) => {
//         if (err) return res.status(500).json({ error: err.message });
//         if (!rows.length) return res.status(404).json({ error: 'No account found for this email.' });

//         const u = rows[0];
//         if (u.password_hash !== passwordHash) {
//             return res.status(401).json({ error: 'Incorrect password.' });
//         }

//         res.json({
//             user: {
//                 id: u.id,
//                 name: u.name,
//                 email: u.email,
//                 role: u.role,
//                 status: u.status,
//                 avatar: u.avatar || null,        // ← Important
//                 date: u.created_at ? u.created_at.toISOString().slice(0, 10) : null,
//             },
//         });
//     });
// });

// // POST /api/users/register  ←←← UPDATE THIS PART
// app.post('/api/users/register', (req, res) => {
//     const { id, name, email, passwordHash, role, status } = req.body;
//     if (!name || !email || !passwordHash) {
//         return res.status(400).json({ error: 'name, email, and passwordHash are required.' });
//     }

//     const userId = id || ('USR-' + Date.now());
//     const sql = `INSERT INTO users (id, name, email, password_hash, role, status, avatar) VALUES (?, ?, ?, ?, ?, ?, NULL)`;

//     db.query(sql, [
//         userId, name.trim(), email.toLowerCase().trim(), passwordHash,
//         role || 'Customer', status || 'Active'
//     ], (err) => {
//         if (err) {
//             if (err.code === 'ER_DUP_ENTRY') {
//                 return res.status(409).json({ error: 'This email is already registered.' });
//             }
//             return res.status(500).json({ error: err.message });
//         }

//         db.query('SELECT * FROM users WHERE id = ?', [userId], (e2, rows) => {
//             if (e2) return res.status(500).json({ error: e2.message });
//             const u = rows[0];
//             res.status(201).json({
//                 message: 'Registered successfully.',
//                 user: {
//                     id: u.id,
//                     name: u.name,
//                     email: u.email,
//                     role: u.role,
//                     status: u.status,
//                     avatar: u.avatar || null,     // ← Important
//                     date: u.created_at ? u.created_at.toISOString().slice(0, 10) : null,
//                 },
//             });
//         });
//     });
// });

// // POST /api/users/check-email  — lightweight: does this email exist?
// app.post('/api/users/check-email', (req, res) => {
//     const { email } = req.body;
//     if (!email) return res.status(400).json({ error: 'email required.' });
//     db.query('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()], (err, rows) => {
//         if (err) return res.status(500).json({ error: err.message });
//         res.json({ exists: rows.length > 0 });
//     });
// });

// // GET /api/users  — admin: list all users (no passwords/hashes)
// app.get('/api/users', (req, res) => {
//     db.query(
//         'SELECT id, name, email, role, status, created_at FROM users ORDER BY created_at DESC',
//         (err, rows) => {
//             if (err) return res.status(500).json({ error: err.message });
//             res.json(rows.map(u => ({
//                 id:     u.id,
//                 name:   u.name,
//                 email:  u.email,
//                 role:   u.role,
//                 status: u.status,
//                 date:   u.created_at ? u.created_at.toISOString().slice(0, 10) : null,
//             })));
//         }
//     );
// });

// // PATCH /api/users/:id  — update name, role, status, or avatar
// app.patch('/api/users/:id', (req, res) => {
//     const allowed = ['name', 'role', 'status', 'avatar'];
//     const fields  = [];
//     const values  = [];

//     Object.entries(req.body).forEach(([k, v]) => {
//         if (allowed.includes(k)) {
//             fields.push(`${k} = ?`);
//             values.push(v);
//         }
//     });

//     if (!fields.length) return res.status(400).json({ error: 'No valid fields to update.' });
//     values.push(req.params.id);

//     db.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values, (err, result) => {
//         if (err)                  return res.status(500).json({ error: err.message });
//         if (!result.affectedRows) return res.status(404).json({ message: 'User not found.' });
//         res.json({ message: 'User updated successfully.' });
//     });
// });

// // DELETE /api/users/:id
// app.delete('/api/users/:id', (req, res) => {
//     db.query('DELETE FROM users WHERE id = ?', [req.params.id], (err, result) => {
//         if (err)                  return res.status(500).json({ error: err.message });
//         if (!result.affectedRows) return res.status(404).json({ message: 'User not found.' });
//         res.json({ message: 'User deleted successfully.' });
//     });
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // KHQR API
// // ─────────────────────────────────────────────────────────────────────────────

// app.get('/api/khqr', (req, res) => {
//     db.query('SELECT image FROM khqr WHERE id = 1', (err, rows) => {
//         if (err) return res.status(500).json({ error: err.message });
//         res.json({ image: rows[0]?.image || null });
//     });
// });

// app.put('/api/khqr', (req, res) => {
//     const { image } = req.body;
//     if (!image) return res.status(400).json({ error: 'image is required.' });

//     const sql = `
//         INSERT INTO khqr (id, image) VALUES (1, ?)
//         ON DUPLICATE KEY UPDATE image = VALUES(image)
//     `;
//     db.query(sql, [image], (err) => {
//         if (err) return res.status(500).json({ error: err.message });
//         res.json({ message: 'KHQR updated successfully.' });
//     });
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // Health check
// // ─────────────────────────────────────────────────────────────────────────────
// app.get('/api/health', (req, res) => {
//     db.query('SELECT 1', (err) => {
//         if (err) return res.status(503).json({ status: 'db_error', error: err.message });
//         res.json({ status: 'ok' });
//     });
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // Start server
// // ─────────────────────────────────────────────────────────────────────────────
// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => console.log(`✓ Server running on port ${PORT}`));




























// require('dotenv').config();

// const express = require('express');
// const mysql = require('mysql2');
// const cors = require('cors');

// const app = express();

// // ១. CORS Configuration
// app.use(cors({
//     origin: [
//         'https://pspmartonline.netlify.app',
//         'http://localhost:5173'
//     ],
//     methods: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH'],
//     credentials: true
// }));

// app.use(express.json({ limit: '50mb' }));
// app.use(express.urlencoded({ limit: '50mb', extended: true }));

// // ២. Database Pool with SSL (Aiven Cloud)
// const db = mysql.createPool({
//     host:     process.env.DB_HOST,
//     user:     process.env.DB_USER,
//     password: process.env.DB_PASSWORD,
//     database: process.env.DB_NAME,
//     port:     process.env.DB_PORT || 3306,
//     waitForConnections: true,
//     connectionLimit: 10,
//     queueLimit: 0,
//     ssl: { rejectUnauthorized: false }
// });

// // ៣. Auto-create + auto-migrate tables on startup
// db.getConnection((err, connection) => {
    
//     if (err) {
//         console.error('Database connection failed:', err.message);
//         return;
//     }
//     console.log('✓ Connected to MySQL Database.');

//     const createProducts = `
//     CREATE TABLE IF NOT EXISTS products (
//         id          VARCHAR(64)   PRIMARY KEY,
//         category    VARCHAR(100)  NOT NULL DEFAULT 'Other',
//         name        VARCHAR(255)  NOT NULL,
//         price       DECIMAL(12,2) NOT NULL DEFAULT 0,
//         description TEXT,
//         image       LONGTEXT,
//         created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
//     )`;

//     const createKhqr = `
//     CREATE TABLE IF NOT EXISTS khqr (
//         id         INT PRIMARY KEY DEFAULT 1,
//         image      LONGTEXT,
//         updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
//     )`;

//     const createUsers = `
//     CREATE TABLE IF NOT EXISTS users (
//         id            VARCHAR(64)   PRIMARY KEY,
//         name          VARCHAR(255)  NOT NULL,
//         email         VARCHAR(255)  NOT NULL UNIQUE,
//         password_hash VARCHAR(64)   NOT NULL,
//         role          VARCHAR(50)   DEFAULT 'Customer',
//         status        VARCHAR(50)   DEFAULT 'Active',
//         avatar        LONGTEXT,
//         created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
//     )`;

//     const createOrders = `
//     CREATE TABLE IF NOT EXISTS orders (
//         id            VARCHAR(64)   PRIMARY KEY,
//         account_email VARCHAR(255)  NOT NULL,
//         customer_name VARCHAR(255)  NOT NULL,
//         phone         VARCHAR(50)   NOT NULL,
//         address       TEXT          NOT NULL,
//         map_location  TEXT,
//         carrier       VARCHAR(100)  NOT NULL,
//         shipping_fee  DECIMAL(12,2) NOT NULL DEFAULT 0.00,
//         subtotal      DECIMAL(12,2) NOT NULL DEFAULT 0.00,
//         total         DECIMAL(12,2) NOT NULL DEFAULT 0.00,
//         status        VARCHAR(50)   DEFAULT 'pending',
//         date_str      VARCHAR(100)  DEFAULT NULL,
//         items         LONGTEXT      NOT NULL,
//         created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
//         updated_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
//     )`;


//     const migrations = [
//         `ALTER TABLE products ADD COLUMN stock            INT       DEFAULT NULL`,
//         `ALTER TABLE products ADD COLUMN images           LONGTEXT`,
//         `ALTER TABLE products ADD COLUMN variants         LONGTEXT`,
//         `ALTER TABLE products ADD COLUMN variant_pricing  LONGTEXT`,
//         `ALTER TABLE products ADD COLUMN child_models     LONGTEXT`,
//         `ALTER TABLE products ADD COLUMN updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
//         `ALTER TABLE products MODIFY COLUMN id VARCHAR(64) NOT NULL`,
//         `ALTER TABLE products MODIFY COLUMN price DECIMAL(12,2) NOT NULL DEFAULT 0`,
//     ];

//     connection.query(createProducts, (e1) => {
//         if (e1) console.error('Error creating products table:', e1.message);
//         else    console.log('✓ products table ready.');

//         connection.query(createKhqr, (e2) => {
//             if (e2) console.error('Error creating khqr table:', e2.message);
//             else    console.log('✓ khqr table ready.');

//             connection.query(createUsers, (e3) => {
//                 if (e3) console.error('Error creating users table:', e3.message);
//                 else    console.log('✓ users table ready.');

//                 connection.query(createOrders, (e4) => {
//                     if (e4) console.error('Error creating orders table:', e4.message);
//                     else    console.log('✓ orders table ready.');

//                     let completed = 0;
//                     migrations.forEach((sql) => {
//                         connection.query(sql, (me) => {
//                             if (me && me.errno !== 1060 && me.errno !== 1091) {
//                                 console.warn('Migration warning:', me.message);
//                             }
//                             completed++;
//                             if (completed === migrations.length) {
//                                 console.log('✓ All migrations applied.');
//                                 connection.release();
//                             }
//                         });
//                     });
//                 });
//             });
//         });
//     });
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // Helpers
// // ─────────────────────────────────────────────────────────────────────────────

// function safeJson(val) {
//     if (val === null || val === undefined) return null;
//     if (typeof val === 'object') return val;
//     try { return JSON.parse(val); } catch { return null; }
// }

// function toJson(val) {
//     if (val === null || val === undefined) return null;
//     if (typeof val === 'string') return val;
//     return JSON.stringify(val);
// }

// function hydrateProduct(row) {
//     if (!row) return null;
//     return {
//         id:             row.id,
//         category:       row.category,
//         name:           row.name,
//         price:          Number(row.price),
//         stock:          row.stock,
//         description:    row.description,
//         image:          row.image,
//         images:         safeJson(row.images)   || [],
//         variants:       safeJson(row.variants) || [],
//         variantPricing: safeJson(row.variant_pricing) || null,
//         childModels:    safeJson(row.child_models)    || null,
//         created_at:     row.created_at,
//         updated_at:     row.updated_at,
//     };
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // PRODUCTS API
// // ─────────────────────────────────────────────────────────────────────────────

// app.get('/api/products', (req, res) => {
//     db.query('SELECT * FROM products ORDER BY created_at DESC', (err, rows) => {
//         if (err) return res.status(500).json({ error: err.message });
//         res.json(rows.map(hydrateProduct));
//     });
// });

// app.get('/api/products/:id', (req, res) => {
//     db.query('SELECT * FROM products WHERE id = ?', [req.params.id], (err, rows) => {
//         if (err)          return res.status(500).json({ error: err.message });
//         if (!rows.length) return res.status(404).json({ message: 'Product not found' });
//         res.json(hydrateProduct(rows[0]));
//     });
// });

// app.post('/api/products', (req, res) => {
//     const {
//         id, category, name, price, stock, description,
//         image, images, variants, variantPricing, childModels,
//     } = req.body;

//     if (!name || price === undefined) {
//         return res.status(400).json({ error: 'name and price are required.' });
//     }

//     const productId  = id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
//     const coverImage = image || (Array.isArray(images) && images[0]) || null;

//     const sql = `
//         INSERT INTO products
//             (id, category, name, price, stock, description, image, images,
//              variants, variant_pricing, child_models)
//         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
//     `;
//     const values = [
//         productId,
//         category  || 'Other',
//         name.trim(),
//         Number(price) || 0,
//         stock !== undefined && stock !== '' ? Number(stock) : null,
//         description || null,
//         coverImage,
//         toJson(images || []),
//         toJson(variants || []),
//         toJson(variantPricing || null),
//         toJson(childModels  || null),
//     ];

//     db.query(sql, values, (err) => {
//         if (err) return res.status(500).json({ error: err.message });

//         db.query('SELECT * FROM products WHERE id = ?', [productId], (err2, rows) => {
//             if (err2) return res.status(500).json({ error: err2.message });
//             res.status(201).json({
//                 message: 'Product created successfully.',
//                 product: hydrateProduct(rows[0]),
//             });
//         });
//     });
// });

// app.put('/api/products/:id', (req, res) => {
//     const { id } = req.params;
//     const {
//         category, name, price, stock, description,
//         image, images, variants, variantPricing, childModels,
//     } = req.body;

//     const coverImage = image || (Array.isArray(images) && images[0]) || null;

//     const sql = `
//         UPDATE products SET
//             category        = ?,
//             name            = ?,
//             price           = ?,
//             stock           = ?,
//             description     = ?,
//             image           = ?,
//             images          = ?,
//             variants        = ?,
//             variant_pricing = ?,
//             child_models    = ?
//         WHERE id = ?
//     `;
//     const values = [
//         category || 'Other',
//         (name || '').trim(),
//         Number(price) || 0,
//         stock !== undefined && stock !== '' ? Number(stock) : null,
//         description || null,
//         coverImage,
//         toJson(images || []),
//         toJson(variants || []),
//         toJson(variantPricing || null),
//         toJson(childModels  || null),
//         id,
//     ];

//     db.query(sql, values, (err, result) => {
//         if (err)                    return res.status(500).json({ error: err.message });
//         if (!result.affectedRows)   return res.status(404).json({ message: 'Product not found.' });

//         db.query('SELECT * FROM products WHERE id = ?', [id], (err2, rows) => {
//             if (err2) return res.status(500).json({ error: err2.message });
//             res.json({ message: 'Product updated successfully.', product: hydrateProduct(rows[0]) });
//         });
//     });
// });

// app.patch('/api/products/:id', (req, res) => {
//     const { id } = req.params;
//     const allowed = ['category','name','price','stock','description','image','images','variants','variant_pricing','child_models'];
//     const dbMap   = { variantPricing:'variant_pricing', childModels:'child_models' };

//     const fields = [];
//     const values = [];

//     Object.entries(req.body).forEach(([key, val]) => {
//         const col = dbMap[key] || key;
//         if (!allowed.includes(col)) return;
//         const jsonCols = ['images','variants','variant_pricing','child_models'];
//         fields.push(`${col} = ?`);
//         values.push(jsonCols.includes(col) ? toJson(val) : val);
//     });

//     if (!fields.length) return res.status(400).json({ error: 'No valid fields to update.' });
//     values.push(id);

//     db.query(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`, values, (err, result) => {
//         if (err)                  return res.status(500).json({ error: err.message });
//         if (!result.affectedRows) return res.status(404).json({ message: 'Product not found.' });

//         db.query('SELECT * FROM products WHERE id = ?', [id], (err2, rows) => {
//             if (err2) return res.status(500).json({ error: err2.message });
//             res.json({ message: 'Product patched successfully.', product: hydrateProduct(rows[0]) });
//         });
//     });
// });

// app.delete('/api/products/:id', (req, res) => {
//     db.query('DELETE FROM products WHERE id = ?', [req.params.id], (err, result) => {
//         if (err)                  return res.status(500).json({ error: err.message });
//         if (!result.affectedRows) return res.status(404).json({ message: 'Product not found.' });
//         res.json({ message: 'Product deleted successfully.' });
//     });
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // USERS API
// // ─────────────────────────────────────────────────────────────────────────────

// // POST /api/users/register
// app.post('/api/users/register', (req, res) => {
//     const { id, name, email, passwordHash, role, status } = req.body;

//     if (!name || !email || !passwordHash) {
//         return res.status(400).json({ error: 'name, email, and passwordHash are required.' });
//     }

//     const userId = id || ('USR-' + Date.now());
//     const sql = `
//         INSERT INTO users (id, name, email, password_hash, role, status)
//         VALUES (?, ?, ?, ?, ?, ?)
//     `;
//     db.query(sql, [
//         userId,
//         name.trim(),
//         email.toLowerCase().trim(),
//         passwordHash,
//         role   || 'Customer',
//         status || 'Active',
//     ], (err) => {
//         if (err) {
//             if (err.code === 'ER_DUP_ENTRY') {
//                 return res.status(409).json({ error: 'This email is already registered.' });
//             }
//             return res.status(500).json({ error: err.message });
//         }
//         db.query('SELECT * FROM users WHERE id = ?', [userId], (e2, rows) => {
//             if (e2) return res.status(500).json({ error: e2.message });
//             const u = rows[0];
//             res.status(201).json({
//                 message: 'Registered successfully.',
//                 user: {
//                     id:     u.id,
//                     name:   u.name,
//                     email:  u.email,
//                     role:   u.role,
//                     status: u.status,
//                     avatar: u.avatar || null,
//                     date:   u.created_at ? u.created_at.toISOString().slice(0, 10) : null,
//                 },
//             });
//         });
//     });
// });

// // // POST /api/users/login
// // app.post('/api/users/login', (req, res) => {
// //     const { email, passwordHash } = req.body;

// //     if (!email || !passwordHash) {
// //         return res.status(400).json({ error: 'email and passwordHash are required.' });
// //     }

// //     db.query('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()], (err, rows) => {
// //         if (err) return res.status(500).json({ error: err.message });
// //         if (!rows.length) return res.status(404).json({ error: 'No account found for this email.' });

// //         const u = rows[0];
// //         if (u.password_hash !== passwordHash) {
// //             return res.status(401).json({ error: 'Incorrect password.' });
// //         }

// //         res.json({
// //             user: {
// //                 id:     u.id,
// //                 name:   u.name,
// //                 email:  u.email,
// //                 role:   u.role,
// //                 status: u.status,
// //                 avatar: u.avatar || null,
// //                 date:   u.created_at ? u.created_at.toISOString().slice(0, 10) : null,
// //             },
// //         });
// //     });
// // });
// // POST /api/users/login  ←←← UPDATE THIS
// app.post('/api/users/login', (req, res) => {
//     const { email, passwordHash } = req.body;
//     if (!email || !passwordHash) {
//         return res.status(400).json({ error: 'email and passwordHash are required.' });
//     }

//     db.query('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()], (err, rows) => {
//         if (err) return res.status(500).json({ error: err.message });
//         if (!rows.length) return res.status(404).json({ error: 'No account found for this email.' });

//         const u = rows[0];
//         if (u.password_hash !== passwordHash) {
//             return res.status(401).json({ error: 'Incorrect password.' });
//         }

//         res.json({
//             user: {
//                 id: u.id,
//                 name: u.name,
//                 email: u.email,
//                 role: u.role,
//                 status: u.status,
//                 avatar: u.avatar || null,        // ← Important
//                 date: u.created_at ? u.created_at.toISOString().slice(0, 10) : null,
//             },
//         });
//     });
// });

// // POST /api/users/register  ←←← UPDATE THIS PART
// app.post('/api/users/register', (req, res) => {
//     const { id, name, email, passwordHash, role, status } = req.body;
//     if (!name || !email || !passwordHash) {
//         return res.status(400).json({ error: 'name, email, and passwordHash are required.' });
//     }

//     const userId = id || ('USR-' + Date.now());
//     const sql = `INSERT INTO users (id, name, email, password_hash, role, status, avatar) VALUES (?, ?, ?, ?, ?, ?, NULL)`;

//     db.query(sql, [
//         userId, name.trim(), email.toLowerCase().trim(), passwordHash,
//         role || 'Customer', status || 'Active'
//     ], (err) => {
//         if (err) {
//             if (err.code === 'ER_DUP_ENTRY') {
//                 return res.status(409).json({ error: 'This email is already registered.' });
//             }
//             return res.status(500).json({ error: err.message });
//         }

//         db.query('SELECT * FROM users WHERE id = ?', [userId], (e2, rows) => {
//             if (e2) return res.status(500).json({ error: e2.message });
//             const u = rows[0];
//             res.status(201).json({
//                 message: 'Registered successfully.',
//                 user: {
//                     id: u.id,
//                     name: u.name,
//                     email: u.email,
//                     role: u.role,
//                     status: u.status,
//                     avatar: u.avatar || null,     // ← Important
//                     date: u.created_at ? u.created_at.toISOString().slice(0, 10) : null,
//                 },
//             });
//         });
//     });
// });

// // POST /api/users/check-email  — lightweight: does this email exist?
// app.post('/api/users/check-email', (req, res) => {
//     const { email } = req.body;
//     if (!email) return res.status(400).json({ error: 'email required.' });
//     db.query('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()], (err, rows) => {
//         if (err) return res.status(500).json({ error: err.message });
//         res.json({ exists: rows.length > 0 });
//     });
// });

// // GET /api/users  — admin: list all users (no passwords/hashes)
// app.get('/api/users', (req, res) => {
//     db.query(
//         'SELECT id, name, email, role, status, created_at FROM users ORDER BY created_at DESC',
//         (err, rows) => {
//             if (err) return res.status(500).json({ error: err.message });
//             res.json(rows.map(u => ({
//                 id:     u.id,
//                 name:   u.name,
//                 email:  u.email,
//                 role:   u.role,
//                 status: u.status,
//                 date:   u.created_at ? u.created_at.toISOString().slice(0, 10) : null,
//             })));
//         }
//     );
// });

// // PATCH /api/users/:id  — update name, role, status, or avatar
// app.patch('/api/users/:id', (req, res) => {
//     const allowed = ['name', 'role', 'status', 'avatar'];
//     const fields  = [];
//     const values  = [];

//     Object.entries(req.body).forEach(([k, v]) => {
//         if (allowed.includes(k)) {
//             fields.push(`${k} = ?`);
//             values.push(v);
//         }
//     });

//     if (!fields.length) return res.status(400).json({ error: 'No valid fields to update.' });
//     values.push(req.params.id);

//     db.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values, (err, result) => {
//         if (err)                  return res.status(500).json({ error: err.message });
//         if (!result.affectedRows) return res.status(404).json({ message: 'User not found.' });
//         res.json({ message: 'User updated successfully.' });
//     });
// });

// // DELETE /api/users/:id
// app.delete('/api/users/:id', (req, res) => {
//     db.query('DELETE FROM users WHERE id = ?', [req.params.id], (err, result) => {
//         if (err)                  return res.status(500).json({ error: err.message });
//         if (!result.affectedRows) return res.status(404).json({ message: 'User not found.' });
//         res.json({ message: 'User deleted successfully.' });
//     });
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // KHQR API
// // ─────────────────────────────────────────────────────────────────────────────

// app.get('/api/khqr', (req, res) => {
//     db.query('SELECT image FROM khqr WHERE id = 1', (err, rows) => {
//         if (err) return res.status(500).json({ error: err.message });
//         res.json({ image: rows[0]?.image || null });
//     });
// });

// app.put('/api/khqr', (req, res) => {
//     const { image } = req.body;
//     if (!image) return res.status(400).json({ error: 'image is required.' });

//     const sql = `
//         INSERT INTO khqr (id, image) VALUES (1, ?)
//         ON DUPLICATE KEY UPDATE image = VALUES(image)
//     `;
//     db.query(sql, [image], (err) => {
//         if (err) return res.status(500).json({ error: err.message });
//         res.json({ message: 'KHQR updated successfully.' });
//     });
// });


// // ─────────────────────────────────────────────────────────────────────────────
// // ORDERS API
// // ─────────────────────────────────────────────────────────────────────────────

// function hydrateOrder(row) {
//     if (!row) return null;
//     return {
//         id:           row.id,
//         accountEmail: row.account_email,
//         customerName: row.customer_name,
//         phone:        row.phone,
//         address:      row.address,
//         mapLocation:  row.map_location,
//         carrier:      row.carrier,
//         shippingFee:  Number(row.shipping_fee),
//         subtotal:     Number(row.subtotal),
//         total:        Number(row.total),
//         status:       row.status,
//         date:         row.date_str,
//         items:        safeJson(row.items) || [],
//         created_at:   row.created_at,
//         updated_at:   row.updated_at,
//     };
// }

// // GET /api/orders - Get all orders (admin) or filtered by email (customer)
// app.get('/api/orders', (req, res) => {
//     const { email } = req.query;
//     let sql = 'SELECT * FROM orders';
//     const params = [];

//     if (email) {
//         sql += ' WHERE account_email = ?';
//         params.push(email.trim().toLowerCase());
//     }

//     sql += ' ORDER BY created_at DESC';

//     db.query(sql, params, (err, rows) => {
//         if (err) return res.status(500).json({ error: err.message });
//         res.json(rows.map(hydrateOrder));
//     });
// });

// // GET /api/orders/:id - Get specific order
// app.get('/api/orders/:id', (req, res) => {
//     db.query('SELECT * FROM orders WHERE id = ?', [req.params.id], (err, rows) => {
//         if (err)          return res.status(500).json({ error: err.message });
//         if (!rows.length) return res.status(404).json({ message: 'Order not found' });
//         res.json(hydrateOrder(rows[0]));
//     });
// });

// // POST /api/orders - Create or update an order
// app.post('/api/orders', (req, res) => {
//     const {
//         id, accountEmail, customerName, phone, address, mapLocation,
//         carrier, shippingFee, subtotal, total, status, date, items
//     } = req.body;

//     if (!accountEmail || !customerName || !phone || !address || !items) {
//         return res.status(400).json({ error: 'Required fields missing: accountEmail, customerName, phone, address, and items are required.' });
//     }

//     const orderId = id || Math.floor(100000 + Math.random() * 900000).toString();

//     const sql = `
//         INSERT INTO orders
//             (id, account_email, customer_name, phone, address, map_location,
//              carrier, shipping_fee, subtotal, total, status, date_str, items)
//         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
//         ON DUPLICATE KEY UPDATE
//             status = VALUES(status),
//             items = VALUES(items),
//             subtotal = VALUES(subtotal),
//             total = VALUES(total),
//             updated_at = CURRENT_TIMESTAMP
//     `;

//     const values = [
//         orderId,
//         accountEmail.trim().toLowerCase(),
//         customerName.trim(),
//         phone.trim(),
//         address.trim(),
//         mapLocation || null,
//         carrier || 'Standard Home Delivery',
//         Number(shippingFee) || 0.00,
//         Number(subtotal) || 0.00,
//         Number(total) || 0.00,
//         status || 'pending',
//         date || new Date().toLocaleDateString('en-US'),
//         toJson(items)
//     ];

//     db.query(sql, values, (err) => {
//         if (err) return res.status(500).json({ error: err.message });

//         db.query('SELECT * FROM orders WHERE id = ?', [orderId], (err2, rows) => {
//             if (err2) return res.status(500).json({ error: err2.message });
//             res.status(201).json({
//                 message: 'Order saved successfully.',
//                 order: hydrateOrder(rows[0])
//             });
//         });
//     });
// });

// // PATCH /api/orders/:id - Update order status or details
// app.patch('/api/orders/:id', (req, res) => {
//     const { id } = req.params;
//     const allowed = ['status', 'customer_name', 'phone', 'address', 'map_location', 'carrier', 'shipping_fee', 'subtotal', 'total', 'items'];
//     const dbMap   = {
//         customerName: 'customer_name',
//         mapLocation:  'map_location',
//         shippingFee:  'shipping_fee',
//     };

//     const fields = [];
//     const values = [];

//     Object.entries(req.body).forEach(([key, val]) => {
//         const col = dbMap[key] || key;
//         if (!allowed.includes(col)) return;
//         fields.push(`${col} = ?`);
//         values.push(col === 'items' ? toJson(val) : val);
//     });

//     if (!fields.length) return res.status(400).json({ error: 'No valid fields to update.' });
//     values.push(id);

//     db.query(`UPDATE orders SET ${fields.join(', ')} WHERE id = ?`, values, (err, result) => {
//         if (err)                  return res.status(500).json({ error: err.message });
//         if (!result.affectedRows) return res.status(404).json({ message: 'Order not found.' });

//         db.query('SELECT * FROM orders WHERE id = ?', [id], (err2, rows) => {
//             if (err2) return res.status(500).json({ error: err2.message });
//             res.json({ message: 'Order updated successfully.', order: hydrateOrder(rows[0]) });
//         });
//     });
// });

// // DELETE /api/orders/:id - Delete order (admin)
// app.delete('/api/orders/:id', (req, res) => {
//     db.query('DELETE FROM orders WHERE id = ?', [req.params.id], (err, result) => {
//         if (err)                  return res.status(500).json({ error: err.message });
//         if (!result.affectedRows) return res.status(404).json({ message: 'Order not found.' });
//         res.json({ message: 'Order deleted successfully.' });
//     });
// });


// // ─────────────────────────────────────────────────────────────────────────────
// // Health check
// // ─────────────────────────────────────────────────────────────────────────────
// app.get('/api/health', (req, res) => {
//     db.query('SELECT 1', (err) => {
//         if (err) return res.status(503).json({ status: 'db_error', error: err.message });
//         res.json({ status: 'ok' });
//     });
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // Start server
// // ─────────────────────────────────────────────────────────────────────────────
// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => console.log(`✓ Server running on port ${PORT}`));



























// require('dotenv').config();

// const express = require('express');
// const mysql = require('mysql2');
// const cors = require('cors');

// const app = express();

// // ១. CORS Configuration
// app.use(cors({
//     origin: [
//         'https://pspmartonline.netlify.app',
//         'http://localhost:5173'
//     ],
//     methods: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH'],
//     credentials: true
// }));

// app.use(express.json({ limit: '50mb' }));
// app.use(express.urlencoded({ limit: '50mb', extended: true }));

// // ២. Database Pool with SSL (Aiven Cloud)
// const db = mysql.createPool({
//     host:     process.env.DB_HOST,
//     user:     process.env.DB_USER,
//     password: process.env.DB_PASSWORD,
//     database: process.env.DB_NAME,
//     port:     process.env.DB_PORT || 3306,
//     waitForConnections: true,
//     connectionLimit: 10,
//     queueLimit: 0,
//     ssl: { rejectUnauthorized: false }
// });

// // ៣. Auto-create + auto-migrate tables on startup
// db.getConnection((err, connection) => {
    
//     if (err) {
//         console.error('Database connection failed:', err.message);
//         return;
//     }
//     console.log('✓ Connected to MySQL Database.');

//     const createProducts = `
//     CREATE TABLE IF NOT EXISTS products (
//         id          VARCHAR(64)   PRIMARY KEY,
//         category    VARCHAR(100)  NOT NULL DEFAULT 'Other',
//         name        VARCHAR(255)  NOT NULL,
//         price       DECIMAL(12,2) NOT NULL DEFAULT 0,
//         description TEXT,
//         image       LONGTEXT,
//         created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
//     )`;

//     const createKhqr = `
//     CREATE TABLE IF NOT EXISTS khqr (
//         id         INT PRIMARY KEY DEFAULT 1,
//         image      LONGTEXT,
//         updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
//     )`;

//     const createUsers = `
//     CREATE TABLE IF NOT EXISTS users (
//         id            VARCHAR(64)   PRIMARY KEY,
//         name          VARCHAR(255)  NOT NULL,
//         email         VARCHAR(255)  NOT NULL UNIQUE,
//         password_hash VARCHAR(64)   NOT NULL,
//         role          VARCHAR(50)   DEFAULT 'Customer',
//         status        VARCHAR(50)   DEFAULT 'Active',
//         avatar        LONGTEXT,
//         created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
//     )`;

//     const createOrders = `
//     CREATE TABLE IF NOT EXISTS orders (
//         id            VARCHAR(64)   PRIMARY KEY,
//         account_email VARCHAR(255)  NOT NULL,
//         customer_name VARCHAR(255)  NOT NULL,
//         phone         VARCHAR(50)   NOT NULL,
//         address       TEXT          NOT NULL,
//         map_location  TEXT,
//         carrier       VARCHAR(100)  NOT NULL,
//         shipping_fee  DECIMAL(12,2) NOT NULL DEFAULT 0.00,
//         subtotal      DECIMAL(12,2) NOT NULL DEFAULT 0.00,
//         total         DECIMAL(12,2) NOT NULL DEFAULT 0.00,
//         status        VARCHAR(50)   DEFAULT 'pending',
//         date_str      VARCHAR(100)  DEFAULT NULL,
//         items         LONGTEXT      NOT NULL,
//         created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
//         updated_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
//     )`;

//     const createComments = `
//     CREATE TABLE IF NOT EXISTS comments (
//         id          VARCHAR(64)   PRIMARY KEY,
//         username    VARCHAR(255)  NOT NULL,
//         email       VARCHAR(255)  NOT NULL,
//         rating      INT           NOT NULL DEFAULT 0,
//         comment     TEXT          NOT NULL,
//         date_str    VARCHAR(100)  DEFAULT NULL,
//         created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
//     )`;



//     const migrations = [
//         `ALTER TABLE products ADD COLUMN stock            INT       DEFAULT NULL`,
//         `ALTER TABLE products ADD COLUMN images           LONGTEXT`,
//         `ALTER TABLE products ADD COLUMN variants         LONGTEXT`,
//         `ALTER TABLE products ADD COLUMN variant_pricing  LONGTEXT`,
//         `ALTER TABLE products ADD COLUMN child_models     LONGTEXT`,
//         `ALTER TABLE products ADD COLUMN updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
//         `ALTER TABLE products MODIFY COLUMN id VARCHAR(64) NOT NULL`,
//         `ALTER TABLE products MODIFY COLUMN price DECIMAL(12,2) NOT NULL DEFAULT 0`,
//     ];

//     connection.query(createProducts, (e1) => {
//         if (e1) console.error('Error creating products table:', e1.message);
//         else    console.log('✓ products table ready.');

//         connection.query(createKhqr, (e2) => {
//             if (e2) console.error('Error creating khqr table:', e2.message);
//             else    console.log('✓ khqr table ready.');

//             connection.query(createUsers, (e3) => {
//                 if (e3) console.error('Error creating users table:', e3.message);
//                 else    console.log('✓ users table ready.');

//                 connection.query(createOrders, (e4) => {
//                     if (e4) console.error('Error creating orders table:', e4.message);
//                     else    console.log('✓ orders table ready.');

//                     connection.query(createComments, (e5) => {
//                         if (e5) console.error('Error creating comments table:', e5.message);
//                         else    console.log('✓ comments table ready.');

//                         let completed = 0;
//                         migrations.forEach((sql) => {
//                             connection.query(sql, (me) => {
//                                 if (me && me.errno !== 1060 && me.errno !== 1091) {
//                                     console.warn('Migration warning:', me.message);
//                                 }
//                                 completed++;
//                                 if (completed === migrations.length) {
//                                     console.log('✓ All migrations applied.');
//                                     connection.release();
//                                 }
//                             });
//                         });
//                     });
//                 });
//             });
//         });
//     });
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // Helpers
// // ─────────────────────────────────────────────────────────────────────────────

// function safeJson(val) {
//     if (val === null || val === undefined) return null;
//     if (typeof val === 'object') return val;
//     try { return JSON.parse(val); } catch { return null; }
// }

// function toJson(val) {
//     if (val === null || val === undefined) return null;
//     if (typeof val === 'string') return val;
//     return JSON.stringify(val);
// }

// function hydrateProduct(row) {
//     if (!row) return null;
//     return {
//         id:             row.id,
//         category:       row.category,
//         name:           row.name,
//         price:          Number(row.price),
//         stock:          row.stock,
//         description:    row.description,
//         image:          row.image,
//         images:         safeJson(row.images)   || [],
//         variants:       safeJson(row.variants) || [],
//         variantPricing: safeJson(row.variant_pricing) || null,
//         childModels:    safeJson(row.child_models)    || null,
//         created_at:     row.created_at,
//         updated_at:     row.updated_at,
//     };
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // PRODUCTS API
// // ─────────────────────────────────────────────────────────────────────────────

// app.get('/api/products', (req, res) => {
//     db.query('SELECT * FROM products ORDER BY created_at DESC', (err, rows) => {
//         if (err) return res.status(500).json({ error: err.message });
//         res.json(rows.map(hydrateProduct));
//     });
// });

// app.get('/api/products/:id', (req, res) => {
//     db.query('SELECT * FROM products WHERE id = ?', [req.params.id], (err, rows) => {
//         if (err)          return res.status(500).json({ error: err.message });
//         if (!rows.length) return res.status(404).json({ message: 'Product not found' });
//         res.json(hydrateProduct(rows[0]));
//     });
// });

// app.post('/api/products', (req, res) => {
//     const {
//         id, category, name, price, stock, description,
//         image, images, variants, variantPricing, childModels,
//     } = req.body;

//     if (!name || price === undefined) {
//         return res.status(400).json({ error: 'name and price are required.' });
//     }

//     const productId  = id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
//     const coverImage = image || (Array.isArray(images) && images[0]) || null;

//     const sql = `
//         INSERT INTO products
//             (id, category, name, price, stock, description, image, images,
//              variants, variant_pricing, child_models)
//         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
//     `;
//     const values = [
//         productId,
//         category  || 'Other',
//         name.trim(),
//         Number(price) || 0,
//         stock !== undefined && stock !== '' ? Number(stock) : null,
//         description || null,
//         coverImage,
//         toJson(images || []),
//         toJson(variants || []),
//         toJson(variantPricing || null),
//         toJson(childModels  || null),
//     ];

//     db.query(sql, values, (err) => {
//         if (err) return res.status(500).json({ error: err.message });

//         db.query('SELECT * FROM products WHERE id = ?', [productId], (err2, rows) => {
//             if (err2) return res.status(500).json({ error: err2.message });
//             res.status(201).json({
//                 message: 'Product created successfully.',
//                 product: hydrateProduct(rows[0]),
//             });
//         });
//     });
// });

// app.put('/api/products/:id', (req, res) => {
//     const { id } = req.params;
//     const {
//         category, name, price, stock, description,
//         image, images, variants, variantPricing, childModels,
//     } = req.body;

//     const coverImage = image || (Array.isArray(images) && images[0]) || null;

//     const sql = `
//         UPDATE products SET
//             category        = ?,
//             name            = ?,
//             price           = ?,
//             stock           = ?,
//             description     = ?,
//             image           = ?,
//             images          = ?,
//             variants        = ?,
//             variant_pricing = ?,
//             child_models    = ?
//         WHERE id = ?
//     `;
//     const values = [
//         category || 'Other',
//         (name || '').trim(),
//         Number(price) || 0,
//         stock !== undefined && stock !== '' ? Number(stock) : null,
//         description || null,
//         coverImage,
//         toJson(images || []),
//         toJson(variants || []),
//         toJson(variantPricing || null),
//         toJson(childModels  || null),
//         id,
//     ];

//     db.query(sql, values, (err, result) => {
//         if (err)                    return res.status(500).json({ error: err.message });
//         if (!result.affectedRows)   return res.status(404).json({ message: 'Product not found.' });

//         db.query('SELECT * FROM products WHERE id = ?', [id], (err2, rows) => {
//             if (err2) return res.status(500).json({ error: err2.message });
//             res.json({ message: 'Product updated successfully.', product: hydrateProduct(rows[0]) });
//         });
//     });
// });

// app.patch('/api/products/:id', (req, res) => {
//     const { id } = req.params;
//     const allowed = ['category','name','price','stock','description','image','images','variants','variant_pricing','child_models'];
//     const dbMap   = { variantPricing:'variant_pricing', childModels:'child_models' };

//     const fields = [];
//     const values = [];

//     Object.entries(req.body).forEach(([key, val]) => {
//         const col = dbMap[key] || key;
//         if (!allowed.includes(col)) return;
//         const jsonCols = ['images','variants','variant_pricing','child_models'];
//         fields.push(`${col} = ?`);
//         values.push(jsonCols.includes(col) ? toJson(val) : val);
//     });

//     if (!fields.length) return res.status(400).json({ error: 'No valid fields to update.' });
//     values.push(id);

//     db.query(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`, values, (err, result) => {
//         if (err)                  return res.status(500).json({ error: err.message });
//         if (!result.affectedRows) return res.status(404).json({ message: 'Product not found.' });

//         db.query('SELECT * FROM products WHERE id = ?', [id], (err2, rows) => {
//             if (err2) return res.status(500).json({ error: err2.message });
//             res.json({ message: 'Product patched successfully.', product: hydrateProduct(rows[0]) });
//         });
//     });
// });

// app.delete('/api/products/:id', (req, res) => {
//     db.query('DELETE FROM products WHERE id = ?', [req.params.id], (err, result) => {
//         if (err)                  return res.status(500).json({ error: err.message });
//         if (!result.affectedRows) return res.status(404).json({ message: 'Product not found.' });
//         res.json({ message: 'Product deleted successfully.' });
//     });
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // USERS API
// // ─────────────────────────────────────────────────────────────────────────────

// // POST /api/users/register
// app.post('/api/users/register', (req, res) => {
//     const { id, name, email, passwordHash, role, status } = req.body;

//     if (!name || !email || !passwordHash) {
//         return res.status(400).json({ error: 'name, email, and passwordHash are required.' });
//     }

//     const userId = id || ('USR-' + Date.now());
//     const sql = `
//         INSERT INTO users (id, name, email, password_hash, role, status)
//         VALUES (?, ?, ?, ?, ?, ?)
//     `;
//     db.query(sql, [
//         userId,
//         name.trim(),
//         email.toLowerCase().trim(),
//         passwordHash,
//         role   || 'Customer',
//         status || 'Active',
//     ], (err) => {
//         if (err) {
//             if (err.code === 'ER_DUP_ENTRY') {
//                 return res.status(409).json({ error: 'This email is already registered.' });
//             }
//             return res.status(500).json({ error: err.message });
//         }
//         db.query('SELECT * FROM users WHERE id = ?', [userId], (e2, rows) => {
//             if (e2) return res.status(500).json({ error: e2.message });
//             const u = rows[0];
//             res.status(201).json({
//                 message: 'Registered successfully.',
//                 user: {
//                     id:     u.id,
//                     name:   u.name,
//                     email:  u.email,
//                     role:   u.role,
//                     status: u.status,
//                     avatar: u.avatar || null,
//                     date:   u.created_at ? u.created_at.toISOString().slice(0, 10) : null,
//                 },
//             });
//         });
//     });
// });

// // // POST /api/users/login
// // app.post('/api/users/login', (req, res) => {
// //     const { email, passwordHash } = req.body;

// //     if (!email || !passwordHash) {
// //         return res.status(400).json({ error: 'email and passwordHash are required.' });
// //     }

// //     db.query('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()], (err, rows) => {
// //         if (err) return res.status(500).json({ error: err.message });
// //         if (!rows.length) return res.status(404).json({ error: 'No account found for this email.' });

// //         const u = rows[0];
// //         if (u.password_hash !== passwordHash) {
// //             return res.status(401).json({ error: 'Incorrect password.' });
// //         }

// //         res.json({
// //             user: {
// //                 id:     u.id,
// //                 name:   u.name,
// //                 email:  u.email,
// //                 role:   u.role,
// //                 status: u.status,
// //                 avatar: u.avatar || null,
// //                 date:   u.created_at ? u.created_at.toISOString().slice(0, 10) : null,
// //             },
// //         });
// //     });
// // });
// // POST /api/users/login  ←←← UPDATE THIS
// app.post('/api/users/login', (req, res) => {
//     const { email, passwordHash } = req.body;
//     if (!email || !passwordHash) {
//         return res.status(400).json({ error: 'email and passwordHash are required.' });
//     }

//     db.query('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()], (err, rows) => {
//         if (err) return res.status(500).json({ error: err.message });
//         if (!rows.length) return res.status(404).json({ error: 'No account found for this email.' });

//         const u = rows[0];
//         if (u.password_hash !== passwordHash) {
//             return res.status(401).json({ error: 'Incorrect password.' });
//         }

//         res.json({
//             user: {
//                 id: u.id,
//                 name: u.name,
//                 email: u.email,
//                 role: u.role,
//                 status: u.status,
//                 avatar: u.avatar || null,        // ← Important
//                 date: u.created_at ? u.created_at.toISOString().slice(0, 10) : null,
//             },
//         });
//     });
// });

// // POST /api/users/register  ←←← UPDATE THIS PART
// app.post('/api/users/register', (req, res) => {
//     const { id, name, email, passwordHash, role, status } = req.body;
//     if (!name || !email || !passwordHash) {
//         return res.status(400).json({ error: 'name, email, and passwordHash are required.' });
//     }

//     const userId = id || ('USR-' + Date.now());
//     const sql = `INSERT INTO users (id, name, email, password_hash, role, status, avatar) VALUES (?, ?, ?, ?, ?, ?, NULL)`;

//     db.query(sql, [
//         userId, name.trim(), email.toLowerCase().trim(), passwordHash,
//         role || 'Customer', status || 'Active'
//     ], (err) => {
//         if (err) {
//             if (err.code === 'ER_DUP_ENTRY') {
//                 return res.status(409).json({ error: 'This email is already registered.' });
//             }
//             return res.status(500).json({ error: err.message });
//         }

//         db.query('SELECT * FROM users WHERE id = ?', [userId], (e2, rows) => {
//             if (e2) return res.status(500).json({ error: e2.message });
//             const u = rows[0];
//             res.status(201).json({
//                 message: 'Registered successfully.',
//                 user: {
//                     id: u.id,
//                     name: u.name,
//                     email: u.email,
//                     role: u.role,
//                     status: u.status,
//                     avatar: u.avatar || null,     // ← Important
//                     date: u.created_at ? u.created_at.toISOString().slice(0, 10) : null,
//                 },
//             });
//         });
//     });
// });

// // POST /api/users/check-email  — lightweight: does this email exist?
// app.post('/api/users/check-email', (req, res) => {
//     const { email } = req.body;
//     if (!email) return res.status(400).json({ error: 'email required.' });
//     db.query('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()], (err, rows) => {
//         if (err) return res.status(500).json({ error: err.message });
//         res.json({ exists: rows.length > 0 });
//     });
// });

// // GET /api/users  — admin: list all users (no passwords/hashes)
// app.get('/api/users', (req, res) => {
//     db.query(
//         'SELECT id, name, email, role, status, created_at FROM users ORDER BY created_at DESC',
//         (err, rows) => {
//             if (err) return res.status(500).json({ error: err.message });
//             res.json(rows.map(u => ({
//                 id:     u.id,
//                 name:   u.name,
//                 email:  u.email,
//                 role:   u.role,
//                 status: u.status,
//                 date:   u.created_at ? u.created_at.toISOString().slice(0, 10) : null,
//             })));
//         }
//     );
// });

// // PATCH /api/users/:id  — update name, role, status, or avatar
// app.patch('/api/users/:id', (req, res) => {
//     const allowed = ['name', 'role', 'status', 'avatar'];
//     const fields  = [];
//     const values  = [];

//     Object.entries(req.body).forEach(([k, v]) => {
//         if (allowed.includes(k)) {
//             fields.push(`${k} = ?`);
//             values.push(v);
//         }
//     });

//     if (!fields.length) return res.status(400).json({ error: 'No valid fields to update.' });
//     values.push(req.params.id);

//     db.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values, (err, result) => {
//         if (err)                  return res.status(500).json({ error: err.message });
//         if (!result.affectedRows) return res.status(404).json({ message: 'User not found.' });
//         res.json({ message: 'User updated successfully.' });
//     });
// });

// // DELETE /api/users/:id
// app.delete('/api/users/:id', (req, res) => {
//     db.query('DELETE FROM users WHERE id = ?', [req.params.id], (err, result) => {
//         if (err)                  return res.status(500).json({ error: err.message });
//         if (!result.affectedRows) return res.status(404).json({ message: 'User not found.' });
//         res.json({ message: 'User deleted successfully.' });
//     });
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // KHQR API
// // ─────────────────────────────────────────────────────────────────────────────

// app.get('/api/khqr', (req, res) => {
//     db.query('SELECT image FROM khqr WHERE id = 1', (err, rows) => {
//         if (err) return res.status(500).json({ error: err.message });
//         res.json({ image: rows[0]?.image || null });
//     });
// });

// app.put('/api/khqr', (req, res) => {
//     const { image } = req.body;
//     if (!image) return res.status(400).json({ error: 'image is required.' });

//     const sql = `
//         INSERT INTO khqr (id, image) VALUES (1, ?)
//         ON DUPLICATE KEY UPDATE image = VALUES(image)
//     `;
//     db.query(sql, [image], (err) => {
//         if (err) return res.status(500).json({ error: err.message });
//         res.json({ message: 'KHQR updated successfully.' });
//     });
// });


// // ─────────────────────────────────────────────────────────────────────────────
// // ORDERS API
// // ─────────────────────────────────────────────────────────────────────────────

// function hydrateOrder(row) {
//     if (!row) return null;
//     return {
//         id:           row.id,
//         accountEmail: row.account_email,
//         customerName: row.customer_name,
//         phone:        row.phone,
//         address:      row.address,
//         mapLocation:  row.map_location,
//         carrier:      row.carrier,
//         shippingFee:  Number(row.shipping_fee),
//         subtotal:     Number(row.subtotal),
//         total:        Number(row.total),
//         status:       row.status,
//         date:         row.date_str,
//         items:        safeJson(row.items) || [],
//         created_at:   row.created_at,
//         updated_at:   row.updated_at,
//     };
// }

// // GET /api/orders - Get all orders (admin) or filtered by email (customer)
// app.get('/api/orders', (req, res) => {
//     const { email } = req.query;
//     let sql = 'SELECT * FROM orders';
//     const params = [];

//     if (email) {
//         sql += ' WHERE account_email = ?';
//         params.push(email.trim().toLowerCase());
//     }

//     sql += ' ORDER BY created_at DESC';

//     db.query(sql, params, (err, rows) => {
//         if (err) return res.status(500).json({ error: err.message });
//         res.json(rows.map(hydrateOrder));
//     });
// });

// // GET /api/orders/:id - Get specific order
// app.get('/api/orders/:id', (req, res) => {
//     db.query('SELECT * FROM orders WHERE id = ?', [req.params.id], (err, rows) => {
//         if (err)          return res.status(500).json({ error: err.message });
//         if (!rows.length) return res.status(404).json({ message: 'Order not found' });
//         res.json(hydrateOrder(rows[0]));
//     });
// });

// // POST /api/orders - Create or update an order
// app.post('/api/orders', (req, res) => {
//     const {
//         id, accountEmail, customerName, phone, address, mapLocation,
//         carrier, shippingFee, subtotal, total, status, date, items
//     } = req.body;

//     if (!accountEmail || !customerName || !phone || !address || !items) {
//         return res.status(400).json({ error: 'Required fields missing: accountEmail, customerName, phone, address, and items are required.' });
//     }

//     const orderId = id || Math.floor(100000 + Math.random() * 900000).toString();

//     const sql = `
//         INSERT INTO orders
//             (id, account_email, customer_name, phone, address, map_location,
//              carrier, shipping_fee, subtotal, total, status, date_str, items)
//         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
//         ON DUPLICATE KEY UPDATE
//             status = VALUES(status),
//             items = VALUES(items),
//             subtotal = VALUES(subtotal),
//             total = VALUES(total),
//             updated_at = CURRENT_TIMESTAMP
//     `;

//     const values = [
//         orderId,
//         accountEmail.trim().toLowerCase(),
//         customerName.trim(),
//         phone.trim(),
//         address.trim(),
//         mapLocation || null,
//         carrier || 'Standard Home Delivery',
//         Number(shippingFee) || 0.00,
//         Number(subtotal) || 0.00,
//         Number(total) || 0.00,
//         status || 'pending',
//         date || new Date().toLocaleDateString('en-US'),
//         toJson(items)
//     ];

//     db.query(sql, values, (err) => {
//         if (err) return res.status(500).json({ error: err.message });

//         db.query('SELECT * FROM orders WHERE id = ?', [orderId], (err2, rows) => {
//             if (err2) return res.status(500).json({ error: err2.message });
//             res.status(201).json({
//                 message: 'Order saved successfully.',
//                 order: hydrateOrder(rows[0])
//             });
//         });
//     });
// });

// // PATCH /api/orders/:id - Update order status or details
// app.patch('/api/orders/:id', (req, res) => {
//     const { id } = req.params;
//     const allowed = ['status', 'customer_name', 'phone', 'address', 'map_location', 'carrier', 'shipping_fee', 'subtotal', 'total', 'items'];
//     const dbMap   = {
//         customerName: 'customer_name',
//         mapLocation:  'map_location',
//         shippingFee:  'shipping_fee',
//     };

//     const fields = [];
//     const values = [];

//     Object.entries(req.body).forEach(([key, val]) => {
//         const col = dbMap[key] || key;
//         if (!allowed.includes(col)) return;
//         fields.push(`${col} = ?`);
//         values.push(col === 'items' ? toJson(val) : val);
//     });

//     if (!fields.length) return res.status(400).json({ error: 'No valid fields to update.' });
//     values.push(id);

//     db.query(`UPDATE orders SET ${fields.join(', ')} WHERE id = ?`, values, (err, result) => {
//         if (err)                  return res.status(500).json({ error: err.message });
//         if (!result.affectedRows) return res.status(404).json({ message: 'Order not found.' });

//         db.query('SELECT * FROM orders WHERE id = ?', [id], (err2, rows) => {
//             if (err2) return res.status(500).json({ error: err2.message });
//             res.json({ message: 'Order updated successfully.', order: hydrateOrder(rows[0]) });
//         });
//     });
// });

// // DELETE /api/orders/:id - Delete order (admin)
// app.delete('/api/orders/:id', (req, res) => {
//     db.query('DELETE FROM orders WHERE id = ?', [req.params.id], (err, result) => {
//         if (err)                  return res.status(500).json({ error: err.message });
//         if (!result.affectedRows) return res.status(404).json({ message: 'Order not found.' });
//         res.json({ message: 'Order deleted successfully.' });
//     });
// });



// // ─────────────────────────────────────────────────────────────────────────────
// // COMMENTS API
// // ─────────────────────────────────────────────────────────────────────────────

// function hydrateComment(row) {
//     if (!row) return null;
//     return {
//         id:         row.id,
//         username:   row.username,
//         email:      row.email,
//         rating:     row.rating,
//         comment:    row.comment,
//         date:       row.date_str,
//         created_at: row.created_at,
//     };
// }

// // GET /api/comments - Get all comments
// app.get("/api/comments", (req, res) => {
//     db.query("SELECT * FROM comments ORDER BY created_at DESC", (err, rows) => {
//         if (err) return res.status(500).json({ error: err.message });
//         res.json(rows.map(hydrateComment));
//     });
// });

// // POST /api/comments - Add a new comment
// app.post("/api/comments", (req, res) => {
//     const { id, username, email, rating, comment, date } = req.body;

//     if (!username || !email || !rating || !comment) {
//         return res.status(400).json({ error: "Required fields missing: username, email, rating, comment are required." });
//     }

//     const commentId = id || (
//         Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
//     );

//     const sql = `
//         INSERT INTO comments
//             (id, username, email, rating, comment, date_str)
//         VALUES (?, ?, ?, ?, ?, ?)
//     `;
//     const values = [
//         commentId,
//         username.trim(),
//         email.trim().toLowerCase(),
//         Number(rating),
//         comment.trim(),
//         date || new Date().toLocaleDateString("en-US"),
//     ];

//     db.query(sql, values, (err) => {
//         if (err) return res.status(500).json({ error: err.message });

//         db.query("SELECT * FROM comments WHERE id = ?", [commentId], (err2, rows) => {
//             if (err2) return res.status(500).json({ error: err2.message });
//             res.status(201).json({
//                 message: "Comment added successfully.",
//                 comment: hydrateComment(rows[0]),
//             });
//         });
//     });
// });

// // DELETE /api/comments/:id - Delete a comment
// app.delete("/api/comments/:id", (req, res) => {
//     db.query("DELETE FROM comments WHERE id = ?", [req.params.id], (err, result) => {
//         if (err) return res.status(500).json({ error: err.message });
//         if (!result.affectedRows) return res.status(404).json({ message: "Comment not found." });
//         res.json({ message: "Comment deleted successfully." });
//     });
// });

// // DELETE /api/comments - Delete all comments
// app.delete("/api/comments", (req, res) => {
//     db.query("DELETE FROM comments", (err, result) => {
//         if (err) return res.status(500).json({ error: err.message });
//         res.json({ message: `Deleted ${result.affectedRows} comments.` });
//     });
// });


// // ─────────────────────────────────────────────────────────────────────────────
// // Health check
// // ─────────────────────────────────────────────────────────────────────────────
// app.get('/api/health', (req, res) => {
//     db.query('SELECT 1', (err) => {
//         if (err) return res.status(503).json({ status: 'db_error', error: err.message });
//         res.json({ status: 'ok' });
//     });
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // Start server
// // ─────────────────────────────────────────────────────────────────────────────
// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => console.log(`✓ Server running on port ${PORT}`));






















// require('dotenv').config();

// const express = require('express');
// const mysql = require('mysql2');
// const cors = require('cors');

// const app = express();

// // ១. CORS Configuration
// app.use(cors({
//     origin: [
//         'https://pspmartonline.netlify.app',
//         'http://localhost:5173'
//     ],
//     methods: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH'],
//     credentials: true
// }));

// app.use(express.json({ limit: '50mb' }));
// app.use(express.urlencoded({ limit: '50mb', extended: true }));

// // ២. Database Pool with SSL (Aiven Cloud)
// const db = mysql.createPool({
//     host:     process.env.DB_HOST,
//     user:     process.env.DB_USER,
//     password: process.env.DB_PASSWORD,
//     database: process.env.DB_NAME,
//     port:     process.env.DB_PORT || 3306,
//     waitForConnections: true,
//     connectionLimit: 10,
//     queueLimit: 0,
//     ssl: { rejectUnauthorized: false }
// });

// // ៣. Auto-create + auto-migrate tables on startup
// db.getConnection((err, connection) => {
    
//     if (err) {
//         console.error('Database connection failed:', err.message);
//         return;
//     }
//     console.log('✓ Connected to MySQL Database.');

//     const createProducts = `
//     CREATE TABLE IF NOT EXISTS products (
//         id          VARCHAR(64)   PRIMARY KEY,
//         category    VARCHAR(100)  NOT NULL DEFAULT 'Other',
//         name        VARCHAR(255)  NOT NULL,
//         price       DECIMAL(12,2) NOT NULL DEFAULT 0,
//         description TEXT,
//         image       LONGTEXT,
//         created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
//     )`;

//     const createKhqr = `
//     CREATE TABLE IF NOT EXISTS khqr (
//         id         INT PRIMARY KEY DEFAULT 1,
//         image      LONGTEXT,
//         updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
//     )`;

//     const createUsers = `
//     CREATE TABLE IF NOT EXISTS users (
//         id            VARCHAR(64)   PRIMARY KEY,
//         name          VARCHAR(255)  NOT NULL,
//         email         VARCHAR(255)  NOT NULL UNIQUE,
//         password_hash VARCHAR(64)   NOT NULL,
//         role          VARCHAR(50)   DEFAULT 'Customer',
//         status        VARCHAR(50)   DEFAULT 'Active',
//         avatar        LONGTEXT,
//         created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
//     )`;

//     const createOrders = `
//     CREATE TABLE IF NOT EXISTS orders (
//         id            VARCHAR(64)   PRIMARY KEY,
//         account_email VARCHAR(255)  NOT NULL,
//         customer_name VARCHAR(255)  NOT NULL,
//         phone         VARCHAR(50)   NOT NULL,
//         address       TEXT          NOT NULL,
//         map_location  TEXT,
//         carrier       VARCHAR(100)  NOT NULL,
//         shipping_fee  DECIMAL(12,2) NOT NULL DEFAULT 0.00,
//         subtotal      DECIMAL(12,2) NOT NULL DEFAULT 0.00,
//         total         DECIMAL(12,2) NOT NULL DEFAULT 0.00,
//         status        VARCHAR(50)   DEFAULT 'pending',
//         date_str      VARCHAR(100)  DEFAULT NULL,
//         items         LONGTEXT      NOT NULL,
//         created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
//         updated_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
//     )`;

//     const createComments = `
//     CREATE TABLE IF NOT EXISTS comments (
//         id          VARCHAR(64)   PRIMARY KEY,
//         username    VARCHAR(255)  NOT NULL,
//         email       VARCHAR(255)  NOT NULL,
//         rating      INT           NOT NULL DEFAULT 0,
//         comment     TEXT          NOT NULL,
//         date_str    VARCHAR(100)  DEFAULT NULL,
//         created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
//     )`;



//     const migrations = [
//         `ALTER TABLE products ADD COLUMN stock            INT       DEFAULT NULL`,
//         `ALTER TABLE products ADD COLUMN images           LONGTEXT`,
//         `ALTER TABLE products ADD COLUMN variants         LONGTEXT`,
//         `ALTER TABLE products ADD COLUMN variant_pricing  LONGTEXT`,
//         `ALTER TABLE products ADD COLUMN child_models     LONGTEXT`,
//         `ALTER TABLE products ADD COLUMN updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
//         `ALTER TABLE products MODIFY COLUMN id VARCHAR(64) NOT NULL`,
//         `ALTER TABLE products MODIFY COLUMN price DECIMAL(12,2) NOT NULL DEFAULT 0`,
//     ];

//     connection.query(createProducts, (e1) => {
//         if (e1) console.error('Error creating products table:', e1.message);
//         else    console.log('✓ products table ready.');

//         connection.query(createKhqr, (e2) => {
//             if (e2) console.error('Error creating khqr table:', e2.message);
//             else    console.log('✓ khqr table ready.');

//             connection.query(createUsers, (e3) => {
//                 if (e3) console.error('Error creating users table:', e3.message);
//                 else    console.log('✓ users table ready.');

//                 connection.query(createOrders, (e4) => {
//                     if (e4) console.error('Error creating orders table:', e4.message);
//                     else    console.log('✓ orders table ready.');

//                     connection.query(createComments, (e5) => {
//                         if (e5) console.error('Error creating comments table:', e5.message);
//                         else    console.log('✓ comments table ready.');

//                         let completed = 0;
//                         migrations.forEach((sql) => {
//                             connection.query(sql, (me) => {
//                                 if (me && me.errno !== 1060 && me.errno !== 1091) {
//                                     console.warn('Migration warning:', me.message);
//                                 }
//                                 completed++;
//                                 if (completed === migrations.length) {
//                                     console.log('✓ All migrations applied.');
//                                     connection.release();
//                                 }
//                             });
//                         });
//                     });
//                 });
//             });
//         });
//     });
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // Helpers
// // ─────────────────────────────────────────────────────────────────────────────

// function safeJson(val) {
//     if (val === null || val === undefined) return null;
//     if (typeof val === 'object') return val;
//     try { return JSON.parse(val); } catch { return null; }
// }

// function toJson(val) {
//     if (val === null || val === undefined) return null;
//     if (typeof val === 'string') return val;
//     return JSON.stringify(val);
// }

// function hydrateProduct(row) {
//     if (!row) return null;
//     return {
//         id:             row.id,
//         category:       row.category,
//         name:           row.name,
//         price:          Number(row.price),
//         stock:          row.stock,
//         description:    row.description,
//         image:          row.image,
//         images:         safeJson(row.images)   || [],
//         variants:       safeJson(row.variants) || [],
//         variantPricing: safeJson(row.variant_pricing) || null,
//         childModels:    safeJson(row.child_models)    || null,
//         created_at:     row.created_at,
//         updated_at:     row.updated_at,
//     };
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // PRODUCTS API
// // ─────────────────────────────────────────────────────────────────────────────

// app.get('/api/products', (req, res) => {
//     db.query('SELECT * FROM products ORDER BY created_at DESC', (err, rows) => {
//         if (err) return res.status(500).json({ error: err.message });
//         res.json(rows.map(hydrateProduct));
//     });
// });

// app.get('/api/products/:id', (req, res) => {
//     db.query('SELECT * FROM products WHERE id = ?', [req.params.id], (err, rows) => {
//         if (err)          return res.status(500).json({ error: err.message });
//         if (!rows.length) return res.status(404).json({ message: 'Product not found' });
//         res.json(hydrateProduct(rows[0]));
//     });
// });

// app.post('/api/products', (req, res) => {
//     const {
//         id, category, name, price, stock, description,
//         image, images, variants, variantPricing, childModels,
//     } = req.body;

//     if (!name || price === undefined) {
//         return res.status(400).json({ error: 'name and price are required.' });
//     }

//     const productId  = id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
//     const coverImage = image || (Array.isArray(images) && images[0]) || null;

//     const sql = `
//         INSERT INTO products
//             (id, category, name, price, stock, description, image, images,
//              variants, variant_pricing, child_models)
//         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
//     `;
//     const values = [
//         productId,
//         category  || 'Other',
//         name.trim(),
//         Number(price) || 0,
//         stock !== undefined && stock !== '' ? Number(stock) : null,
//         description || null,
//         coverImage,
//         toJson(images || []),
//         toJson(variants || []),
//         toJson(variantPricing || null),
//         toJson(childModels  || null),
//     ];

//     db.query(sql, values, (err) => {
//         if (err) return res.status(500).json({ error: err.message });

//         db.query('SELECT * FROM products WHERE id = ?', [productId], (err2, rows) => {
//             if (err2) return res.status(500).json({ error: err2.message });
//             res.status(201).json({
//                 message: 'Product created successfully.',
//                 product: hydrateProduct(rows[0]),
//             });
//         });
//     });
// });

// app.put('/api/products/:id', (req, res) => {
//     const { id } = req.params;
//     const {
//         category, name, price, stock, description,
//         image, images, variants, variantPricing, childModels,
//     } = req.body;

//     const coverImage = image || (Array.isArray(images) && images[0]) || null;

//     const sql = `
//         UPDATE products SET
//             category        = ?,
//             name            = ?,
//             price           = ?,
//             stock           = ?,
//             description     = ?,
//             image           = ?,
//             images          = ?,
//             variants        = ?,
//             variant_pricing = ?,
//             child_models    = ?
//         WHERE id = ?
//     `;
//     const values = [
//         category || 'Other',
//         (name || '').trim(),
//         Number(price) || 0,
//         stock !== undefined && stock !== '' ? Number(stock) : null,
//         description || null,
//         coverImage,
//         toJson(images || []),
//         toJson(variants || []),
//         toJson(variantPricing || null),
//         toJson(childModels  || null),
//         id,
//     ];

//     db.query(sql, values, (err, result) => {
//         if (err)                    return res.status(500).json({ error: err.message });
//         if (!result.affectedRows)   return res.status(404).json({ message: 'Product not found.' });

//         db.query('SELECT * FROM products WHERE id = ?', [id], (err2, rows) => {
//             if (err2) return res.status(500).json({ error: err2.message });
//             res.json({ message: 'Product updated successfully.', product: hydrateProduct(rows[0]) });
//         });
//     });
// });

// app.patch('/api/products/:id', (req, res) => {
//     const { id } = req.params;
//     const allowed = ['category','name','price','stock','description','image','images','variants','variant_pricing','child_models'];
//     const dbMap   = { variantPricing:'variant_pricing', childModels:'child_models' };

//     const fields = [];
//     const values = [];

//     Object.entries(req.body).forEach(([key, val]) => {
//         const col = dbMap[key] || key;
//         if (!allowed.includes(col)) return;
//         const jsonCols = ['images','variants','variant_pricing','child_models'];
//         fields.push(`${col} = ?`);
//         values.push(jsonCols.includes(col) ? toJson(val) : val);
//     });

//     if (!fields.length) return res.status(400).json({ error: 'No valid fields to update.' });
//     values.push(id);

//     db.query(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`, values, (err, result) => {
//         if (err)                  return res.status(500).json({ error: err.message });
//         if (!result.affectedRows) return res.status(404).json({ message: 'Product not found.' });

//         db.query('SELECT * FROM products WHERE id = ?', [id], (err2, rows) => {
//             if (err2) return res.status(500).json({ error: err2.message });
//             res.json({ message: 'Product patched successfully.', product: hydrateProduct(rows[0]) });
//         });
//     });
// });

// app.delete('/api/products/:id', (req, res) => {
//     db.query('DELETE FROM products WHERE id = ?', [req.params.id], (err, result) => {
//         if (err)                  return res.status(500).json({ error: err.message });
//         if (!result.affectedRows) return res.status(404).json({ message: 'Product not found.' });
//         res.json({ message: 'Product deleted successfully.' });
//     });
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // USERS API
// // ─────────────────────────────────────────────────────────────────────────────

// // POST /api/users/register
// app.post('/api/users/register', (req, res) => {
//     const { id, name, email, passwordHash, role, status } = req.body;

//     if (!name || !email || !passwordHash) {
//         return res.status(400).json({ error: 'name, email, and passwordHash are required.' });
//     }

//     const userId = id || ('USR-' + Date.now());
//     const sql = `
//         INSERT INTO users (id, name, email, password_hash, role, status)
//         VALUES (?, ?, ?, ?, ?, ?)
//     `;
//     db.query(sql, [
//         userId,
//         name.trim(),
//         email.toLowerCase().trim(),
//         passwordHash,
//         role   || 'Customer',
//         status || 'Active',
//     ], (err) => {
//         if (err) {
//             if (err.code === 'ER_DUP_ENTRY') {
//                 return res.status(409).json({ error: 'This email is already registered.' });
//             }
//             return res.status(500).json({ error: err.message });
//         }
//         db.query('SELECT * FROM users WHERE id = ?', [userId], (e2, rows) => {
//             if (e2) return res.status(500).json({ error: e2.message });
//             const u = rows[0];
//             res.status(201).json({
//                 message: 'Registered successfully.',
//                 user: {
//                     id:     u.id,
//                     name:   u.name,
//                     email:  u.email,
//                     role:   u.role,
//                     status: u.status,
//                     avatar: u.avatar || null,
//                     date:   u.created_at ? u.created_at.toISOString().slice(0, 10) : null,
//                 },
//             });
//         });
//     });
// });

// // // POST /api/users/login
// // app.post('/api/users/login', (req, res) => {
// //     const { email, passwordHash } = req.body;

// //     if (!email || !passwordHash) {
// //         return res.status(400).json({ error: 'email and passwordHash are required.' });
// //     }

// //     db.query('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()], (err, rows) => {
// //         if (err) return res.status(500).json({ error: err.message });
// //         if (!rows.length) return res.status(404).json({ error: 'No account found for this email.' });

// //         const u = rows[0];
// //         if (u.password_hash !== passwordHash) {
// //             return res.status(401).json({ error: 'Incorrect password.' });
// //         }

// //         res.json({
// //             user: {
// //                 id:     u.id,
// //                 name:   u.name,
// //                 email:  u.email,
// //                 role:   u.role,
// //                 status: u.status,
// //                 avatar: u.avatar || null,
// //                 date:   u.created_at ? u.created_at.toISOString().slice(0, 10) : null,
// //             },
// //         });
// //     });
// // });
// // POST /api/users/login  ←←← UPDATE THIS
// app.post('/api/users/login', (req, res) => {
//     const { email, passwordHash } = req.body;
//     if (!email || !passwordHash) {
//         return res.status(400).json({ error: 'email and passwordHash are required.' });
//     }

//     db.query('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()], (err, rows) => {
//         if (err) return res.status(500).json({ error: err.message });
//         if (!rows.length) return res.status(404).json({ error: 'No account found for this email.' });

//         const u = rows[0];
//         if (u.password_hash !== passwordHash) {
//             return res.status(401).json({ error: 'Incorrect password.' });
//         }

//         res.json({
//             user: {
//                 id: u.id,
//                 name: u.name,
//                 email: u.email,
//                 role: u.role,
//                 status: u.status,
//                 avatar: u.avatar || null,        // ← Important
//                 date: u.created_at ? u.created_at.toISOString().slice(0, 10) : null,
//             },
//         });
//     });
// });

// // POST /api/users/register  ←←← UPDATE THIS PART
// app.post('/api/users/register', (req, res) => {
//     const { id, name, email, passwordHash, role, status } = req.body;
//     if (!name || !email || !passwordHash) {
//         return res.status(400).json({ error: 'name, email, and passwordHash are required.' });
//     }

//     const userId = id || ('USR-' + Date.now());
//     const sql = `INSERT INTO users (id, name, email, password_hash, role, status, avatar) VALUES (?, ?, ?, ?, ?, ?, NULL)`;

//     db.query(sql, [
//         userId, name.trim(), email.toLowerCase().trim(), passwordHash,
//         role || 'Customer', status || 'Active'
//     ], (err) => {
//         if (err) {
//             if (err.code === 'ER_DUP_ENTRY') {
//                 return res.status(409).json({ error: 'This email is already registered.' });
//             }
//             return res.status(500).json({ error: err.message });
//         }

//         db.query('SELECT * FROM users WHERE id = ?', [userId], (e2, rows) => {
//             if (e2) return res.status(500).json({ error: e2.message });
//             const u = rows[0];
//             res.status(201).json({
//                 message: 'Registered successfully.',
//                 user: {
//                     id: u.id,
//                     name: u.name,
//                     email: u.email,
//                     role: u.role,
//                     status: u.status,
//                     avatar: u.avatar || null,     // ← Important
//                     date: u.created_at ? u.created_at.toISOString().slice(0, 10) : null,
//                 },
//             });
//         });
//     });
// });

// // POST /api/users/check-email  — lightweight: does this email exist?
// app.post('/api/users/check-email', (req, res) => {
//     const { email } = req.body;
//     if (!email) return res.status(400).json({ error: 'email required.' });
//     db.query('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()], (err, rows) => {
//         if (err) return res.status(500).json({ error: err.message });
//         res.json({ exists: rows.length > 0 });
//     });
// });

// // GET /api/users  — admin: list all users (no passwords/hashes)
// app.get('/api/users', (req, res) => {
//     db.query(
//         'SELECT id, name, email, role, status, created_at FROM users ORDER BY created_at DESC',
//         (err, rows) => {
//             if (err) return res.status(500).json({ error: err.message });
//             res.json(rows.map(u => ({
//                 id:     u.id,
//                 name:   u.name,
//                 email:  u.email,
//                 role:   u.role,
//                 status: u.status,
//                 date:   u.created_at ? u.created_at.toISOString().slice(0, 10) : null,
//             })));
//         }
//     );
// });

// // PATCH /api/users/:id  — update name, role, status, or avatar
// app.patch('/api/users/:id', (req, res) => {
//     const allowed = ['name', 'role', 'status', 'avatar'];
//     const fields  = [];
//     const values  = [];

//     Object.entries(req.body).forEach(([k, v]) => {
//         if (allowed.includes(k)) {
//             fields.push(`${k} = ?`);
//             values.push(v);
//         }
//     });

//     if (!fields.length) return res.status(400).json({ error: 'No valid fields to update.' });
//     values.push(req.params.id);

//     db.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values, (err, result) => {
//         if (err)                  return res.status(500).json({ error: err.message });
//         if (!result.affectedRows) return res.status(404).json({ message: 'User not found.' });
//         res.json({ message: 'User updated successfully.' });
//     });
// });

// // DELETE /api/users/:id
// app.delete('/api/users/:id', (req, res) => {
//     db.query('DELETE FROM users WHERE id = ?', [req.params.id], (err, result) => {
//         if (err)                  return res.status(500).json({ error: err.message });
//         if (!result.affectedRows) return res.status(404).json({ message: 'User not found.' });
//         res.json({ message: 'User deleted successfully.' });
//     });
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // KHQR API
// // ─────────────────────────────────────────────────────────────────────────────

// app.get('/api/khqr', (req, res) => {
//     db.query('SELECT image FROM khqr WHERE id = 1', (err, rows) => {
//         if (err) return res.status(500).json({ error: err.message });
//         res.json({ image: rows[0]?.image || null });
//     });
// });

// app.put('/api/khqr', (req, res) => {
//     const { image } = req.body;
//     if (!image) return res.status(400).json({ error: 'image is required.' });

//     const sql = `
//         INSERT INTO khqr (id, image) VALUES (1, ?)
//         ON DUPLICATE KEY UPDATE image = VALUES(image)
//     `;
//     db.query(sql, [image], (err) => {
//         if (err) return res.status(500).json({ error: err.message });
//         res.json({ message: 'KHQR updated successfully.' });
//     });
// });


// // ─────────────────────────────────────────────────────────────────────────────
// // ORDERS API
// // ─────────────────────────────────────────────────────────────────────────────

// function hydrateOrder(row) {
//     if (!row) return null;
//     return {
//         id:           row.id,
//         accountEmail: row.account_email,
//         customerName: row.customer_name,
//         phone:        row.phone,
//         address:      row.address,
//         mapLocation:  row.map_location,
//         carrier:      row.carrier,
//         shippingFee:  Number(row.shipping_fee),
//         subtotal:     Number(row.subtotal),
//         total:        Number(row.total),
//         status:       row.status,
//         date:         row.date_str,
//         items:        safeJson(row.items) || [],
//         created_at:   row.created_at,
//         updated_at:   row.updated_at,
//     };
// }

// // GET /api/orders - Get all orders (admin) or filtered by email (customer)
// app.get('/api/orders', (req, res) => {
//     const { email } = req.query;
//     let sql = 'SELECT * FROM orders';
//     const params = [];

//     if (email) {
//         sql += ' WHERE account_email = ?';
//         params.push(email.trim().toLowerCase());
//     }

//     sql += ' ORDER BY created_at DESC';

//     db.query(sql, params, (err, rows) => {
//         if (err) return res.status(500).json({ error: err.message });
//         res.json(rows.map(hydrateOrder));
//     });
// });

// // GET /api/orders/:id - Get specific order
// app.get('/api/orders/:id', (req, res) => {
//     db.query('SELECT * FROM orders WHERE id = ?', [req.params.id], (err, rows) => {
//         if (err)          return res.status(500).json({ error: err.message });
//         if (!rows.length) return res.status(404).json({ message: 'Order not found' });
//         res.json(hydrateOrder(rows[0]));
//     });
// });

// // POST /api/orders - Create or update an order
// app.post('/api/orders', (req, res) => {
//     const {
//         id, accountEmail, customerName, phone, address, mapLocation,
//         carrier, shippingFee, subtotal, total, status, date, items
//     } = req.body;

//     if (!accountEmail || !customerName || !phone || !address || !items) {
//         return res.status(400).json({ error: 'Required fields missing: accountEmail, customerName, phone, address, and items are required.' });
//     }

//     const orderId = id || Math.floor(100000 + Math.random() * 900000).toString();

//     const sql = `
//         INSERT INTO orders
//             (id, account_email, customer_name, phone, address, map_location,
//              carrier, shipping_fee, subtotal, total, status, date_str, items)
//         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
//         ON DUPLICATE KEY UPDATE
//             status = VALUES(status),
//             items = VALUES(items),
//             subtotal = VALUES(subtotal),
//             total = VALUES(total),
//             updated_at = CURRENT_TIMESTAMP
//     `;

//     const values = [
//         orderId,
//         accountEmail.trim().toLowerCase(),
//         customerName.trim(),
//         phone.trim(),
//         address.trim(),
//         mapLocation || null,
//         carrier || 'Standard Home Delivery',
//         Number(shippingFee) || 0.00,
//         Number(subtotal) || 0.00,
//         Number(total) || 0.00,
//         status || 'pending',
//         date || new Date().toLocaleDateString('en-US'),
//         toJson(items)
//     ];

//     db.query(sql, values, (err) => {
//         if (err) return res.status(500).json({ error: err.message });

//         db.query('SELECT * FROM orders WHERE id = ?', [orderId], (err2, rows) => {
//             if (err2) return res.status(500).json({ error: err2.message });
//             res.status(201).json({
//                 message: 'Order saved successfully.',
//                 order: hydrateOrder(rows[0])
//             });
//         });
//     });
// });

// // PATCH /api/orders/:id - Update order status or details
// app.patch('/api/orders/:id', (req, res) => {
//     const { id } = req.params;
//     const allowed = ['status', 'customer_name', 'phone', 'address', 'map_location', 'carrier', 'shipping_fee', 'subtotal', 'total', 'items'];
//     const dbMap   = {
//         customerName: 'customer_name',
//         mapLocation:  'map_location',
//         shippingFee:  'shipping_fee',
//     };

//     const fields = [];
//     const values = [];

//     Object.entries(req.body).forEach(([key, val]) => {
//         const col = dbMap[key] || key;
//         if (!allowed.includes(col)) return;
//         fields.push(`${col} = ?`);
//         values.push(col === 'items' ? toJson(val) : val);
//     });

//     if (!fields.length) return res.status(400).json({ error: 'No valid fields to update.' });
//     values.push(id);

//     db.query(`UPDATE orders SET ${fields.join(', ')} WHERE id = ?`, values, (err, result) => {
//         if (err)                  return res.status(500).json({ error: err.message });
//         if (!result.affectedRows) return res.status(404).json({ message: 'Order not found.' });

//         db.query('SELECT * FROM orders WHERE id = ?', [id], (err2, rows) => {
//             if (err2) return res.status(500).json({ error: err2.message });
//             res.json({ message: 'Order updated successfully.', order: hydrateOrder(rows[0]) });
//         });
//     });
// });

// // DELETE /api/orders/:id - Delete order (admin)
// app.delete('/api/orders/:id', (req, res) => {
//     db.query('DELETE FROM orders WHERE id = ?', [req.params.id], (err, result) => {
//         if (err)                  return res.status(500).json({ error: err.message });
//         if (!result.affectedRows) return res.status(404).json({ message: 'Order not found.' });
//         res.json({ message: 'Order deleted successfully.' });
//     });
// });




// // ─────────────────────────────────────────────────────────────────────────────
// // COMMENTS API
// // ─────────────────────────────────────────────────────────────────────────────

// function hydrateComment(row) {
//     if (!row) return null;
//     return {
//         id:         row.id,
//         username:   row.username,
//         email:      row.email, // Assuming email is stored in the DB, not just username
//         rating:     row.rating,
//         comment:    row.comment,
//         date:       row.date_str, // Use date_str from DB
//         created_at: row.created_at,
//     };
// }

// // GET /api/comments - Returns all comments ordered newest-first.
// app.get('/api/comments', (req, res) => {
//     db.query(
//         'SELECT id, username, email, comment, rating, date_str FROM comments ORDER BY created_at DESC',
//         (err, rows) => {
//             if (err) {
//                 console.error('[comments GET /]', err);
//                 return res.status(500).json({ error: 'Failed to fetch comments.' });
//             }
//             res.json(rows.map(hydrateComment));
//         }
//     );
// });

// // POST /api/comments - Body: { id, username, email, comment, rating, date }
// app.post('/api/comments', (req, res) => {
//     const { id, username, email, comment, rating, date } = req.body;

//     if (!username || !email || !comment) {
//         return res.status(400).json({ error: 'id, username, email and comment are required.' });
//     }

//     const commentId = id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
//     const safeRating = Math.min(5, Math.max(1, parseInt(rating, 10) || 5));
//     const dateStr = date || new Date().toLocaleDateString("en-US");

//     db.query(
//         'INSERT INTO comments (id, username, email, comment, rating, date_str) VALUES (?, ?, ?, ?, ?, ?)',
//         [commentId, username.trim(), email.trim().toLowerCase(), comment.trim(), safeRating, dateStr],
//         (err, result) => {
//             if (err) {
//                 if (err.code === 'ER_DUP_ENTRY') {
//                     // Duplicate id — treat as success (idempotent)
//                     return res.status(200).json({ success: true, id: commentId });
//                 }
//                 console.error('[comments POST /]', err);
//                 return res.status(500).json({ error: 'Failed to save comment.' });
//             }
//             res.status(201).json({ success: true, id: commentId });
//         }
//     );
// });

// // DELETE /api/comments/:id - Delete a single comment by its id.
// app.delete('/api/comments/:id', (req, res) => {
//     const { id } = req.params;
//     db.query('DELETE FROM comments WHERE id = ?', [id], (err, result) => {
//         if (err) {
//             console.error('[comments DELETE /:id]', err);
//             return res.status(500).json({ error: 'Failed to delete comment.' });
//         }
//         if (result.affectedRows === 0) {
//             return res.status(404).json({ message: 'Comment not found.' });
//         }
//         res.json({ success: true, message: 'Comment deleted successfully.' });
//     });
// });

// // DELETE /api/comments - Delete ALL comments.
// app.delete('/api/comments', (req, res) => {
//     db.query('TRUNCATE TABLE comments', (err, result) => {
//         if (err) {
//             console.error('[comments DELETE /]', err);
//             return res.status(500).json({ error: 'Failed to clear comments.' });
//         }
//         res.json({ success: true, message: `Deleted ${result.affectedRows} comments.` });
//     });
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // Health check
// // ─────────────────────────────────────────────────────────────────────────────
// app.get('/api/health', (req, res) => {
//     db.query('SELECT 1', (err) => {
//         if (err) return res.status(503).json({ status: 'db_error', error: err.message });
//         res.json({ status: 'ok' });
//     });
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // Start server
// // ─────────────────────────────────────────────────────────────────────────────
// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => console.log(`✓ Server running on port ${PORT}`));





















// require('dotenv').config();

// const express = require('express');
// const mysql = require('mysql2');
// const cors = require('cors');

// const app = express();

// // ─── CORS ─────────────────────────────────────────────────────────────────────
// app.use(cors({
//     origin: [
//         'https://pspmartonline.netlify.app',
//         'http://localhost:5173'
//     ],
//     methods: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH'],
//     credentials: true
// }));

// app.use(express.json({ limit: '50mb' }));
// app.use(express.urlencoded({ limit: '50mb', extended: true }));

// // ─── DATABASE POOL (Aiven Cloud with SSL) ─────────────────────────────────────
// const db = mysql.createPool({
//     host:     process.env.DB_HOST,
//     user:     process.env.DB_USER,
//     password: process.env.DB_PASSWORD,
//     database: process.env.DB_NAME,
//     port:     process.env.DB_PORT || 3306,
//     waitForConnections: true,
//     connectionLimit: 10,
//     queueLimit: 0,
//     ssl: { rejectUnauthorized: false }
// });

// // ─── AUTO-CREATE + AUTO-MIGRATE TABLES ────────────────────────────────────────
// db.getConnection((err, connection) => {
//     if (err) {
//         console.error('Database connection failed:', err.message);
//         return;
//     }
//     console.log('✓ Connected to MySQL Database.');

//     const createProducts = `
//     CREATE TABLE IF NOT EXISTS products (
//         id          VARCHAR(64)   PRIMARY KEY,
//         category    VARCHAR(100)  NOT NULL DEFAULT 'Other',
//         name        VARCHAR(255)  NOT NULL,
//         price       DECIMAL(12,2) NOT NULL DEFAULT 0,
//         description TEXT,
//         image       LONGTEXT,
//         created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
//     )`;

//     const createKhqr = `
//     CREATE TABLE IF NOT EXISTS khqr (
//         id         INT PRIMARY KEY DEFAULT 1,
//         image      LONGTEXT,
//         updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
//     )`;

//     const createUsers = `
//     CREATE TABLE IF NOT EXISTS users (
//         id            VARCHAR(64)   PRIMARY KEY,
//         name          VARCHAR(255)  NOT NULL,
//         email         VARCHAR(255)  NOT NULL UNIQUE,
//         password_hash VARCHAR(64)   NOT NULL,
//         role          VARCHAR(50)   DEFAULT 'Customer',
//         status        VARCHAR(50)   DEFAULT 'Active',
//         avatar        LONGTEXT,
//         created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
//     )`;

//     const createOrders = `
//     CREATE TABLE IF NOT EXISTS orders (
//         id            VARCHAR(64)   PRIMARY KEY,
//         account_email VARCHAR(255)  NOT NULL,
//         customer_name VARCHAR(255)  NOT NULL,
//         phone         VARCHAR(50)   NOT NULL,
//         address       TEXT          NOT NULL,
//         map_location  TEXT,
//         carrier       VARCHAR(100)  NOT NULL,
//         shipping_fee  DECIMAL(12,2) NOT NULL DEFAULT 0.00,
//         subtotal      DECIMAL(12,2) NOT NULL DEFAULT 0.00,
//         total         DECIMAL(12,2) NOT NULL DEFAULT 0.00,
//         status        VARCHAR(50)   DEFAULT 'pending',
//         date_str      VARCHAR(100)  DEFAULT NULL,
//         items         LONGTEXT      NOT NULL,
//         created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
//         updated_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
//     )`;

//     const createComments = `
//     CREATE TABLE IF NOT EXISTS comments (
//         id          VARCHAR(64)   PRIMARY KEY,
//         username    VARCHAR(255)  NOT NULL,
//         email       VARCHAR(255)  NOT NULL,
//         rating      INT           NOT NULL DEFAULT 0,
//         comment     TEXT          NOT NULL,
//         date_str    VARCHAR(100)  DEFAULT NULL,
//         created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
//     )`;

//     const migrations = [
//         `ALTER TABLE products ADD COLUMN stock            INT       DEFAULT NULL`,
//         `ALTER TABLE products ADD COLUMN images           LONGTEXT`,
//         `ALTER TABLE products ADD COLUMN variants         LONGTEXT`,
//         `ALTER TABLE products ADD COLUMN variant_pricing  LONGTEXT`,
//         `ALTER TABLE products ADD COLUMN child_models     LONGTEXT`,
//         `ALTER TABLE products ADD COLUMN updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
//         `ALTER TABLE products MODIFY COLUMN id VARCHAR(64) NOT NULL`,
//         `ALTER TABLE products MODIFY COLUMN price DECIMAL(12,2) NOT NULL DEFAULT 0`,
//     ];

//     connection.query(createProducts, (e1) => {
//         if (e1) console.error('Error creating products table:', e1.message);
//         else    console.log('✓ products table ready.');

//         connection.query(createKhqr, (e2) => {
//             if (e2) console.error('Error creating khqr table:', e2.message);
//             else    console.log('✓ khqr table ready.');

//             connection.query(createUsers, (e3) => {
//                 if (e3) console.error('Error creating users table:', e3.message);
//                 else    console.log('✓ users table ready.');

//                 connection.query(createOrders, (e4) => {
//                     if (e4) console.error('Error creating orders table:', e4.message);
//                     else    console.log('✓ orders table ready.');

//                     connection.query(createComments, (e5) => {
//                         if (e5) console.error('Error creating comments table:', e5.message);
//                         else    console.log('✓ comments table ready.');

//                         let completed = 0;
//                         migrations.forEach((sql) => {
//                             connection.query(sql, (me) => {
//                                 // errno 1060 = column already exists, 1091 = can't drop non-existent — both are safe to ignore
//                                 if (me && me.errno !== 1060 && me.errno !== 1091) {
//                                     console.warn('Migration warning:', me.message);
//                                 }
//                                 completed++;
//                                 if (completed === migrations.length) {
//                                     console.log('✓ All migrations applied.');
//                                     connection.release();
//                                 }
//                             });
//                         });
//                     });
//                 });
//             });
//         });
//     });
// });

// // ─── HELPERS ──────────────────────────────────────────────────────────────────
// function safeJson(val) {
//     if (val === null || val === undefined) return null;
//     if (typeof val === 'object') return val;
//     try { return JSON.parse(val); } catch { return null; }
// }

// function toJson(val) {
//     if (val === null || val === undefined) return null;
//     if (typeof val === 'string') return val;
//     return JSON.stringify(val);
// }

// function hydrateProduct(row) {
//     if (!row) return null;
//     return {
//         id:             row.id,
//         category:       row.category,
//         name:           row.name,
//         price:          Number(row.price),
//         stock:          row.stock,
//         description:    row.description,
//         image:          row.image,
//         images:         safeJson(row.images)          || [],
//         variants:       safeJson(row.variants)        || [],
//         variantPricing: safeJson(row.variant_pricing) || null,
//         childModels:    safeJson(row.child_models)    || null,
//         created_at:     row.created_at,
//         updated_at:     row.updated_at,
//     };
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // PRODUCTS API
// // ─────────────────────────────────────────────────────────────────────────────
// app.get('/api/products', (req, res) => {
//     db.query('SELECT * FROM products ORDER BY created_at DESC', (err, rows) => {
//         if (err) return res.status(500).json({ error: err.message });
//         res.json(rows.map(hydrateProduct));
//     });
// });

// app.get('/api/products/:id', (req, res) => {
//     db.query('SELECT * FROM products WHERE id = ?', [req.params.id], (err, rows) => {
//         if (err)          return res.status(500).json({ error: err.message });
//         if (!rows.length) return res.status(404).json({ message: 'Product not found' });
//         res.json(hydrateProduct(rows[0]));
//     });
// });

// app.post('/api/products', (req, res) => {
//     const { id, category, name, price, stock, description, image, images, variants, variantPricing, childModels } = req.body;

//     if (!name || price === undefined) {
//         return res.status(400).json({ error: 'name and price are required.' });
//     }

//     const productId  = id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
//     const coverImage = image || (Array.isArray(images) && images[0]) || null;

//     const sql = `
//         INSERT INTO products (id, category, name, price, stock, description, image, images, variants, variant_pricing, child_models)
//         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
//     `;
//     const values = [
//         productId,
//         category  || 'Other',
//         name.trim(),
//         Number(price) || 0,
//         stock !== undefined && stock !== '' ? Number(stock) : null,
//         description || null,
//         coverImage,
//         toJson(images      || []),
//         toJson(variants    || []),
//         toJson(variantPricing || null),
//         toJson(childModels || null),
//     ];

//     db.query(sql, values, (err) => {
//         if (err) return res.status(500).json({ error: err.message });
//         db.query('SELECT * FROM products WHERE id = ?', [productId], (err2, rows) => {
//             if (err2) return res.status(500).json({ error: err2.message });
//             res.status(201).json({ message: 'Product created successfully.', product: hydrateProduct(rows[0]) });
//         });
//     });
// });

// app.put('/api/products/:id', (req, res) => {
//     const { id } = req.params;
//     const { category, name, price, stock, description, image, images, variants, variantPricing, childModels } = req.body;
//     const coverImage = image || (Array.isArray(images) && images[0]) || null;

//     const sql = `
//         UPDATE products SET
//             category = ?, name = ?, price = ?, stock = ?, description = ?,
//             image = ?, images = ?, variants = ?, variant_pricing = ?, child_models = ?
//         WHERE id = ?
//     `;
//     const values = [
//         category || 'Other', (name || '').trim(), Number(price) || 0,
//         stock !== undefined && stock !== '' ? Number(stock) : null,
//         description || null, coverImage,
//         toJson(images || []), toJson(variants || []),
//         toJson(variantPricing || null), toJson(childModels || null), id,
//     ];

//     db.query(sql, values, (err, result) => {
//         if (err)                  return res.status(500).json({ error: err.message });
//         if (!result.affectedRows) return res.status(404).json({ message: 'Product not found.' });
//         db.query('SELECT * FROM products WHERE id = ?', [id], (err2, rows) => {
//             if (err2) return res.status(500).json({ error: err2.message });
//             res.json({ message: 'Product updated successfully.', product: hydrateProduct(rows[0]) });
//         });
//     });
// });

// app.patch('/api/products/:id', (req, res) => {
//     const { id } = req.params;
//     const allowed = ['category','name','price','stock','description','image','images','variants','variant_pricing','child_models'];
//     const dbMap   = { variantPricing: 'variant_pricing', childModels: 'child_models' };
//     const fields  = [];
//     const values  = [];

//     Object.entries(req.body).forEach(([key, val]) => {
//         const col = dbMap[key] || key;
//         if (!allowed.includes(col)) return;
//         const jsonCols = ['images','variants','variant_pricing','child_models'];
//         fields.push(`${col} = ?`);
//         values.push(jsonCols.includes(col) ? toJson(val) : val);
//     });

//     if (!fields.length) return res.status(400).json({ error: 'No valid fields to update.' });
//     values.push(id);

//     db.query(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`, values, (err, result) => {
//         if (err)                  return res.status(500).json({ error: err.message });
//         if (!result.affectedRows) return res.status(404).json({ message: 'Product not found.' });
//         db.query('SELECT * FROM products WHERE id = ?', [id], (err2, rows) => {
//             if (err2) return res.status(500).json({ error: err2.message });
//             res.json({ message: 'Product patched successfully.', product: hydrateProduct(rows[0]) });
//         });
//     });
// });

// app.delete('/api/products/:id', (req, res) => {
//     db.query('DELETE FROM products WHERE id = ?', [req.params.id], (err, result) => {
//         if (err)                  return res.status(500).json({ error: err.message });
//         if (!result.affectedRows) return res.status(404).json({ message: 'Product not found.' });
//         res.json({ message: 'Product deleted successfully.' });
//     });
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // USERS API
// // ─────────────────────────────────────────────────────────────────────────────

// // POST /api/users/register
// app.post('/api/users/register', (req, res) => {
//     const { id, name, email, passwordHash, role, status } = req.body;

//     if (!name || !email || !passwordHash) {
//         return res.status(400).json({ error: 'name, email, and passwordHash are required.' });
//     }

//     const userId = id || ('USR-' + Date.now());
//     const sql = `INSERT INTO users (id, name, email, password_hash, role, status, avatar) VALUES (?, ?, ?, ?, ?, ?, NULL)`;

//     db.query(sql, [
//         userId,
//         name.trim(),
//         email.toLowerCase().trim(),
//         passwordHash,
//         role   || 'Customer',
//         status || 'Active',
//     ], (err) => {
//         if (err) {
//             if (err.code === 'ER_DUP_ENTRY') {
//                 return res.status(409).json({ error: 'This email is already registered.' });
//             }
//             return res.status(500).json({ error: err.message });
//         }
//         db.query('SELECT * FROM users WHERE id = ?', [userId], (e2, rows) => {
//             if (e2) return res.status(500).json({ error: e2.message });
//             const u = rows[0];
//             res.status(201).json({
//                 message: 'Registered successfully.',
//                 user: {
//                     id:     u.id,
//                     name:   u.name,
//                     email:  u.email,
//                     role:   u.role,
//                     status: u.status,
//                     avatar: u.avatar || null,
//                     date:   u.created_at ? u.created_at.toISOString().slice(0, 10) : null,
//                 },
//             });
//         });
//     });
// });

// // POST /api/users/login
// app.post('/api/users/login', (req, res) => {
//     const { email, passwordHash } = req.body;

//     if (!email || !passwordHash) {
//         return res.status(400).json({ error: 'email and passwordHash are required.' });
//     }

//     db.query('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()], (err, rows) => {
//         if (err)          return res.status(500).json({ error: err.message });
//         if (!rows.length) return res.status(404).json({ error: 'No account found for this email.' });

//         const u = rows[0];
//         if (u.password_hash !== passwordHash) {
//             return res.status(401).json({ error: 'Incorrect password.' });
//         }

//         res.json({
//             user: {
//                 id:     u.id,
//                 name:   u.name,
//                 email:  u.email,
//                 role:   u.role,
//                 status: u.status,
//                 avatar: u.avatar || null,
//                 date:   u.created_at ? u.created_at.toISOString().slice(0, 10) : null,
//             },
//         });
//     });
// });

// // POST /api/users/check-email
// app.post('/api/users/check-email', (req, res) => {
//     const { email } = req.body;
//     if (!email) return res.status(400).json({ error: 'email required.' });
//     db.query('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()], (err, rows) => {
//         if (err) return res.status(500).json({ error: err.message });
//         res.json({ exists: rows.length > 0 });
//     });
// });

// // GET /api/users — list all users (admin)
// app.get('/api/users', (req, res) => {
//     db.query(
//         'SELECT id, name, email, role, status, created_at FROM users ORDER BY created_at DESC',
//         (err, rows) => {
//             if (err) return res.status(500).json({ error: err.message });
//             res.json(rows.map(u => ({
//                 id:     u.id,
//                 name:   u.name,
//                 email:  u.email,
//                 role:   u.role,
//                 status: u.status,
//                 date:   u.created_at ? u.created_at.toISOString().slice(0, 10) : null,
//             })));
//         }
//     );
// });

// // PATCH /api/users/:id — update name, role, status, or avatar
// app.patch('/api/users/:id', (req, res) => {
//     const allowed = ['name', 'role', 'status', 'avatar'];
//     const fields  = [];
//     const values  = [];

//     Object.entries(req.body).forEach(([k, v]) => {
//         if (allowed.includes(k)) { fields.push(`${k} = ?`); values.push(v); }
//     });

//     if (!fields.length) return res.status(400).json({ error: 'No valid fields to update.' });
//     values.push(req.params.id);

//     db.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values, (err, result) => {
//         if (err)                  return res.status(500).json({ error: err.message });
//         if (!result.affectedRows) return res.status(404).json({ message: 'User not found.' });
//         res.json({ message: 'User updated successfully.' });
//     });
// });

// // DELETE /api/users/:id
// app.delete('/api/users/:id', (req, res) => {
//     db.query('DELETE FROM users WHERE id = ?', [req.params.id], (err, result) => {
//         if (err)                  return res.status(500).json({ error: err.message });
//         if (!result.affectedRows) return res.status(404).json({ message: 'User not found.' });
//         res.json({ message: 'User deleted successfully.' });
//     });
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // KHQR API
// // ─────────────────────────────────────────────────────────────────────────────
// app.get('/api/khqr', (req, res) => {
//     db.query('SELECT image FROM khqr WHERE id = 1', (err, rows) => {
//         if (err) return res.status(500).json({ error: err.message });
//         res.json({ image: rows[0]?.image || null });
//     });
// });

// app.put('/api/khqr', (req, res) => {
//     const { image } = req.body;
//     if (!image) return res.status(400).json({ error: 'image is required.' });

//     const sql = `INSERT INTO khqr (id, image) VALUES (1, ?) ON DUPLICATE KEY UPDATE image = VALUES(image)`;
//     db.query(sql, [image], (err) => {
//         if (err) return res.status(500).json({ error: err.message });
//         res.json({ message: 'KHQR updated successfully.' });
//     });
// });

// // // ─────────────────────────────────────────────────────────────────────────────
// // // ORDERS API
// // // ─────────────────────────────────────────────────────────────────────────────
// // function hydrateOrder(row) {
// //     if (!row) return null;
// //     return {
// //         id:           row.id,
// //         accountEmail: row.account_email,
// //         customerName: row.customer_name,
// //         phone:        row.phone,
// //         address:      row.address,
// //         mapLocation:  row.map_location,
// //         carrier:      row.carrier,
// //         shippingFee:  Number(row.shipping_fee),
// //         subtotal:     Number(row.subtotal),
// //         total:        Number(row.total),
// //         status:       row.status,
// //         date:         row.date_str,
// //         items:        safeJson(row.items) || [],
// //         created_at:   row.created_at,
// //         updated_at:   row.updated_at,
// //     };
// // }

// // // GET /api/orders — all orders (admin) or filtered by email (customer)
// // app.get('/api/orders', (req, res) => {
// //     const { email } = req.query;
// //     let sql    = 'SELECT * FROM orders';
// //     const params = [];

// //     if (email) {
// //         sql += ' WHERE account_email = ?';
// //         params.push(email.trim().toLowerCase());
// //     }

// //     sql += ' ORDER BY created_at DESC';

// //     db.query(sql, params, (err, rows) => {
// //         if (err) return res.status(500).json({ error: err.message });
// //         res.json(rows.map(hydrateOrder));
// //     });
// // });

// // // GET /api/orders/:id
// // app.get('/api/orders/:id', (req, res) => {
// //     db.query('SELECT * FROM orders WHERE id = ?', [req.params.id], (err, rows) => {
// //         if (err)          return res.status(500).json({ error: err.message });
// //         if (!rows.length) return res.status(404).json({ message: 'Order not found' });
// //         res.json(hydrateOrder(rows[0]));
// //     });
// // });

// // // POST /api/orders — create or update (upsert) an order
// // app.post('/api/orders', (req, res) => {
// //     const {
// //         id, accountEmail, customerName, phone, address, mapLocation,
// //         carrier, shippingFee, subtotal, total, status, date, items
// //     } = req.body;

// //     if (!accountEmail || !customerName || !phone || !address || !items) {
// //         return res.status(400).json({ error: 'Required fields missing: accountEmail, customerName, phone, address, and items are required.' });
// //     }

// //     const orderId = id ? String(id) : Math.floor(100000 + Math.random() * 900000).toString();

// //     const sql = `
// //         INSERT INTO orders
// //             (id, account_email, customer_name, phone, address, map_location,
// //              carrier, shipping_fee, subtotal, total, status, date_str, items)
// //         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
// //         ON DUPLICATE KEY UPDATE
// //             customer_name = VALUES(customer_name),
// //             phone         = VALUES(phone),
// //             address       = VALUES(address),
// //             map_location  = VALUES(map_location),
// //             carrier       = VALUES(carrier),
// //             shipping_fee  = VALUES(shipping_fee),
// //             subtotal      = VALUES(subtotal),
// //             total         = VALUES(total),
// //             status        = VALUES(status),
// //             items         = VALUES(items),
// //             updated_at    = CURRENT_TIMESTAMP
// //     `;

// //     const values = [
// //         orderId,
// //         accountEmail.trim().toLowerCase(),
// //         customerName.trim(),
// //         phone.trim(),
// //         address.trim(),
// //         mapLocation || null,
// //         carrier     || 'Standard Home Delivery',
// //         Number(shippingFee) || 0.00,
// //         Number(subtotal)    || 0.00,
// //         Number(total)       || 0.00,
// //         status || 'confirmed',
// //         date   || new Date().toLocaleDateString('en-US'),
// //         toJson(items),
// //     ];

// //     db.query(sql, values, (err) => {
// //         if (err) return res.status(500).json({ error: err.message });
// //         db.query('SELECT * FROM orders WHERE id = ?', [orderId], (err2, rows) => {
// //             if (err2) return res.status(500).json({ error: err2.message });
// //             res.status(201).json({ message: 'Order saved successfully.', order: hydrateOrder(rows[0]) });
// //         });
// //     });
// // });

// // // PATCH /api/orders/:id — update order fields
// // app.patch('/api/orders/:id', (req, res) => {
// //     const { id } = req.params;
// //     const allowed = ['status','customer_name','phone','address','map_location','carrier','shipping_fee','subtotal','total','items'];
// //     const dbMap   = { customerName: 'customer_name', mapLocation: 'map_location', shippingFee: 'shipping_fee' };
// //     const fields  = [];
// //     const values  = [];

// //     Object.entries(req.body).forEach(([key, val]) => {
// //         const col = dbMap[key] || key;
// //         if (!allowed.includes(col)) return;
// //         fields.push(`${col} = ?`);
// //         values.push(col === 'items' ? toJson(val) : val);
// //     });

// //     if (!fields.length) return res.status(400).json({ error: 'No valid fields to update.' });
// //     values.push(id);

// //     db.query(`UPDATE orders SET ${fields.join(', ')} WHERE id = ?`, values, (err, result) => {
// //         if (err)                  return res.status(500).json({ error: err.message });
// //         if (!result.affectedRows) return res.status(404).json({ message: 'Order not found.' });
// //         db.query('SELECT * FROM orders WHERE id = ?', [id], (err2, rows) => {
// //             if (err2) return res.status(500).json({ error: err2.message });
// //             res.json({ message: 'Order updated successfully.', order: hydrateOrder(rows[0]) });
// //         });
// //     });
// // });

// // // DELETE /api/orders/:id
// // app.delete('/api/orders/:id', (req, res) => {
// //     db.query('DELETE FROM orders WHERE id = ?', [req.params.id], (err, result) => {
// //         if (err)                  return res.status(500).json({ error: err.message });
// //         if (!result.affectedRows) return res.status(404).json({ message: 'Order not found.' });
// //         res.json({ message: 'Order deleted successfully.' });
// //     });
// // });





// // ─────────────────────────────────────────────────────────────────────────────
// // ORDERS API (INVOICE HISTORY)
// // ─────────────────────────────────────────────────────────────────────────────

// // // Helper function to format database order rows back to standard frontend objects
// // function hydrateOrder(row) {
// //     if (!row) return null;
// //     return {
// //         id: row.id,
// //         accountEmail: row.account_email,
// //         customerName: row.customer_name,
// //         phone: row.phone,
// //         address: row.address,
// //         mapLocation: row.map_location,
// //         carrier: row.carrier,
// //         shippingFee: Number(row.shipping_fee),
// //         subtotal: Number(row.subtotal),
// //         total: Number(row.total),
// //         status: row.status,
// //         date: row.date_str || row.created_at.toISOString().slice(0, 10),
// //         items: safeJson(row.items) || [],
// //         createdAt: row.created_at,
// //         updatedAt: row.updated_at
// //     };
// // }

// // // GET /api/orders - Fetch all orders (Admin views all, or filtered via query parameter)
// // app.get('/api/orders', (req, res) => {
// //     const { email } = req.query;
    
// //     let sql = 'SELECT * FROM orders';
// //     const values = [];

// //     // If an email query parameter is passed (e.g., /api/orders?email=user@test.com), filter results
// //     if (email) {
// //         sql += ' WHERE account_email = ?';
// //         values.push(email.toLowerCase().trim());
// //     }
    
// //     sql += ' ORDER BY created_at DESC';

// //     db.query(sql, values, (err, rows) => {
// //         if (err) return res.status(500).json({ error: err.message });
// //         res.json(rows.map(hydrateOrder));
// //     });
// // });

// // // POST /api/orders - Add a new Invoice (Triggers when customer completes checkout)
// // app.post('/api/orders', (req, res) => {
// //     const { 
// //         id, accountEmail, customerName, phone, address, 
// //         mapLocation, carrier, shippingFee, subtotal, total, items, date 
// //     } = req.body;

// //     if (!accountEmail || !customerName || !phone || !items) {
// //         return res.status(400).json({ error: 'Missing required order placement details.' });
// //     }

// //     const orderId = id || ('INV-' + Date.now().toString(36).toUpperCase());
// //     const orderDateStr = date || new Date().toLocaleString('en-US', { timeZone: 'Asia/Phnom_Penh' });

// //     const sql = `
// //         INSERT INTO orders (
// //             id, account_email, customer_name, phone, address, 
// //             map_location, carrier, shipping_fee, subtotal, total, 
// //             status, date_str, items
// //         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', ?, ?)
// //     `;

// //     const values = [
// //         orderId,
// //         accountEmail.toLowerCase().trim(),
// //         customerName.trim(),
// //         phone.trim(),
// //         address.trim(),
// //         mapLocation || null,
// //         carrier,
// //         Number(shippingFee) || 0,
// //         Number(subtotal) || 0,
// //         Number(total) || 0,
// //         orderDateStr,
// //         toJson(items || [])
// //     ];

// //     db.query(sql, values, (err) => {
// //         if (err) return res.status(500).json({ error: err.message });
        
// //         db.query('SELECT * FROM orders WHERE id = ?', [orderId], (err2, rows) => {
// //             if (err2) return res.status(500).json({ error: err2.message });
// //             res.status(201).json({ 
// //                 message: 'Order created and saved successfully.', 
// //                 order: hydrateOrder(rows[0]) 
// //             });
// //         });
// //     });
// // });






// // ... existing server code ...

// // Orders API (active & fixed)
// function hydrateOrder(row) {
//   if (!row) return null;
//   return {
//     id: row.id,
//     accountEmail: row.account_email,
//     customerName: row.customer_name,
//     phone: row.phone,
//     address: row.address,
//     mapLocation: row.map_location,
//     carrier: row.carrier,
//     shippingFee: Number(row.shipping_fee || 0),
//     subtotal: Number(row.subtotal || 0),
//     total: Number(row.total || 0),
//     status: row.status || 'paid',
//     date: row.date_str || (row.created_at ? row.created_at.toISOString().slice(0, 16).replace('T', ' ') : new Date().toLocaleString()),
//     items: safeJson(row.items) || [],
//     created_at: row.created_at,
//     updated_at: row.updated_at
//   };
// }

// // GET /api/orders
// app.get('/api/orders', (req, res) => {
//   const { email } = req.query;
//   let sql = 'SELECT * FROM orders';
//   const values = [];

//   if (email) {
//     sql += ' WHERE account_email = ?';
//     values.push(email.toLowerCase().trim());
//   }
//   sql += ' ORDER BY created_at DESC';

//   db.query(sql, values, (err, rows) => {
//     if (err) return res.status(500).json({ error: err.message });
//     res.json(rows.map(hydrateOrder));
//   });
// });

// // POST /api/orders
// app.post('/api/orders', (req, res) => {
//   const { id, accountEmail, customerName, phone, address, mapLocation, carrier, shippingFee, subtotal, total, items, date } = req.body;

//   if (!accountEmail || !customerName || !phone || !items) {
//     return res.status(400).json({ error: 'Missing required fields' });
//   }

//   const orderId = id || `INV-${Date.now().toString(36).toUpperCase()}`;
//   const orderDateStr = date || new Date().toLocaleString('en-US', { timeZone: 'Asia/Phnom_Penh' });

//   const sql = `
//     INSERT INTO orders (id, account_email, customer_name, phone, address, map_location, carrier, 
//                         shipping_fee, subtotal, total, status, date_str, items)
//     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', ?, ?)
//     ON DUPLICATE KEY UPDATE 
//       status = VALUES(status), updated_at = CURRENT_TIMESTAMP
//   `;

//   const values = [
//     orderId,
//     accountEmail.toLowerCase().trim(),
//     customerName.trim(),
//     phone.trim(),
//     address.trim(),
//     mapLocation || null,
//     carrier || 'Standard Home Delivery',
//     Number(shippingFee) || 0,
//     Number(subtotal) || 0,
//     Number(total) || 0,
//     orderDateStr,
//     JSON.stringify(items || [])
//   ];

//   db.query(sql, values, (err) => {
//     if (err) return res.status(500).json({ error: err.message });
//     db.query('SELECT * FROM orders WHERE id = ?', [orderId], (err2, rows) => {
//       if (err2) return res.status(500).json({ error: err2.message });
//       res.status(201).json({ message: 'Order saved', order: hydrateOrder(rows[0]) });
//     });
//   });
// });






// // DELETE /api/orders/:id - Delete item from invoice history (Admin only)
// app.delete('/api/orders/:id', (req, res) => {
//     const { id } = req.params;
    
//     db.query('DELETE FROM orders WHERE id = ?', [id], (err, result) => {
//         if (err) return res.status(500).json({ error: err.message });
//         if (!result.affectedRows) return res.status(404).json({ message: 'Order record not found.' });
        
//         res.json({ message: 'Invoice historical record deleted successfully.' });
//     });
// });





// // ─────────────────────────────────────────────────────────────────────────────
// // COMMENTS API
// // ─────────────────────────────────────────────────────────────────────────────
// function hydrateComment(row) {
//     if (!row) return null;
//     return {
//         id:         row.id,
//         username:   row.username,
//         email:      row.email,
//         rating:     row.rating,
//         comment:    row.comment,
//         date:       row.date_str,
//         created_at: row.created_at,
//     };
// }

// // GET /api/comments
// app.get('/api/comments', (req, res) => {
//     db.query(
//         'SELECT id, username, email, comment, rating, date_str, created_at FROM comments ORDER BY created_at DESC',
//         (err, rows) => {
//             if (err) {
//                 console.error('[comments GET /]', err);
//                 return res.status(500).json({ error: 'Failed to fetch comments.' });
//             }
//             res.json(rows.map(hydrateComment));
//         }
//     );
// });

// // POST /api/comments
// app.post('/api/comments', (req, res) => {
//     const { id, username, email, comment, rating, date } = req.body;

//     if (!username || !email || !comment) {
//         return res.status(400).json({ error: 'username, email and comment are required.' });
//     }

//     const commentId  = id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
//     const safeRating = Math.min(5, Math.max(1, parseInt(rating, 10) || 5));
//     const dateStr    = date || new Date().toLocaleDateString('en-US');

//     db.query(
//         'INSERT INTO comments (id, username, email, comment, rating, date_str) VALUES (?, ?, ?, ?, ?, ?)',
//         [commentId, username.trim(), email.trim().toLowerCase(), comment.trim(), safeRating, dateStr],
//         (err) => {
//             if (err) {
//                 if (err.code === 'ER_DUP_ENTRY') {
//                     return res.status(200).json({ success: true, id: commentId });
//                 }
//                 console.error('[comments POST /]', err);
//                 return res.status(500).json({ error: 'Failed to save comment.' });
//             }
//             res.status(201).json({ success: true, id: commentId });
//         }
//     );
// });

// // DELETE /api/comments/:id — delete single comment
// app.delete('/api/comments/:id', (req, res) => {
//     db.query('DELETE FROM comments WHERE id = ?', [req.params.id], (err, result) => {
//         if (err) {
//             console.error('[comments DELETE /:id]', err);
//             return res.status(500).json({ error: 'Failed to delete comment.' });
//         }
//         if (result.affectedRows === 0) {
//             return res.status(404).json({ message: 'Comment not found.' });
//         }
//         res.json({ success: true, message: 'Comment deleted successfully.' });
//     });
// });

// // DELETE /api/comments — delete ALL comments
// app.delete('/api/comments', (req, res) => {
//     db.query('DELETE FROM comments', (err) => {
//         if (err) {
//             console.error('[comments DELETE /]', err);
//             return res.status(500).json({ error: 'Failed to clear comments.' });
//         }
//         res.json({ success: true, message: 'All comments deleted.' });
//     });
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // HEALTH CHECK
// // ─────────────────────────────────────────────────────────────────────────────
// app.get('/api/health', (req, res) => {
//     db.query('SELECT 1', (err) => {
//         if (err) return res.status(503).json({ status: 'db_error', error: err.message });
//         res.json({ status: 'ok' });
//     });
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // START SERVER
// // ─────────────────────────────────────────────────────────────────────────────
// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => console.log(`✓ Server running on port ${PORT}`));





















// require('dotenv').config();

// const express = require('express');
// const mysql   = require('mysql2');
// const cors    = require('cors');

// // ─── Gemini AI ─────────────────────────────────────────────────────────────
// // Install: npm install @google/genai
// const { GoogleGenAI } = require('@google/genai');
// const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// const app = express();

// // ─── CORS ───────────────────────────────────────────────────────────────────
// app.use(cors({
//     origin: [
//         'https://pspmartonline.netlify.app',
//         'http://localhost:5173'
//     ],
//     methods: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH'],
//     credentials: true
// }));

// app.use(express.json({ limit: '50mb' }));
// app.use(express.urlencoded({ limit: '50mb', extended: true }));

// // ─── DATABASE POOL (Aiven Cloud with SSL) ───────────────────────────────────
// const db = mysql.createPool({
//     host:     process.env.DB_HOST,
//     user:     process.env.DB_USER,
//     password: process.env.DB_PASSWORD,
//     database: process.env.DB_NAME,
//     port:     process.env.DB_PORT || 3306,
//     waitForConnections: true,
//     connectionLimit: 10,
//     queueLimit: 0,
//     ssl: { rejectUnauthorized: false }
// });

// // ─── AUTO-CREATE + AUTO-MIGRATE TABLES ──────────────────────────────────────
// db.getConnection((err, connection) => {
//     if (err) {
//         console.error('Database connection failed:', err.message);
//         return;
//     }
//     console.log('✓ Connected to MySQL Database.');

//     const createProducts = `
//     CREATE TABLE IF NOT EXISTS products (
//         id          VARCHAR(64)   PRIMARY KEY,
//         category    VARCHAR(100)  NOT NULL DEFAULT 'Other',
//         name        VARCHAR(255)  NOT NULL,
//         price       DECIMAL(12,2) NOT NULL DEFAULT 0,
//         description TEXT,
//         image       LONGTEXT,
//         created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
//     )`;

//     const createKhqr = `
//     CREATE TABLE IF NOT EXISTS khqr (
//         id         INT PRIMARY KEY DEFAULT 1,
//         image      LONGTEXT,
//         updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
//     )`;

//     const createUsers = `
//     CREATE TABLE IF NOT EXISTS users (
//         id            VARCHAR(64)   PRIMARY KEY,
//         name          VARCHAR(255)  NOT NULL,
//         email         VARCHAR(255)  NOT NULL UNIQUE,
//         password_hash VARCHAR(64)   NOT NULL,
//         role          VARCHAR(50)   DEFAULT 'Customer',
//         status        VARCHAR(50)   DEFAULT 'Active',
//         avatar        LONGTEXT,
//         created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
//     )`;

//     const createOrders = `
//     CREATE TABLE IF NOT EXISTS orders (
//         id            VARCHAR(64)   PRIMARY KEY,
//         account_email VARCHAR(255)  NOT NULL,
//         customer_name VARCHAR(255)  NOT NULL,
//         phone         VARCHAR(50)   NOT NULL,
//         address       TEXT          NOT NULL,
//         map_location  TEXT,
//         carrier       VARCHAR(100)  NOT NULL,
//         shipping_fee  DECIMAL(12,2) NOT NULL DEFAULT 0.00,
//         subtotal      DECIMAL(12,2) NOT NULL DEFAULT 0.00,
//         total         DECIMAL(12,2) NOT NULL DEFAULT 0.00,
//         status        VARCHAR(50)   DEFAULT 'pending',
//         date_str      VARCHAR(100)  DEFAULT NULL,
//         items         LONGTEXT      NOT NULL,
//         created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
//         updated_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
//     )`;

//     const createComments = `
//     CREATE TABLE IF NOT EXISTS comments (
//         id          VARCHAR(64)   PRIMARY KEY,
//         username    VARCHAR(255)  NOT NULL,
//         email       VARCHAR(255)  NOT NULL,
//         rating      INT           NOT NULL DEFAULT 0,
//         comment     TEXT          NOT NULL,
//         date_str    VARCHAR(100)  DEFAULT NULL,
//         created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
//     )`;

//     const migrations = [
//         `ALTER TABLE products ADD COLUMN stock            INT       DEFAULT NULL`,
//         `ALTER TABLE products ADD COLUMN images           LONGTEXT`,
//         `ALTER TABLE products ADD COLUMN variants         LONGTEXT`,
//         `ALTER TABLE products ADD COLUMN variant_pricing  LONGTEXT`,
//         `ALTER TABLE products ADD COLUMN child_models     LONGTEXT`,
//         `ALTER TABLE products ADD COLUMN updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
//         `ALTER TABLE products MODIFY COLUMN id VARCHAR(64) NOT NULL`,
//         `ALTER TABLE products MODIFY COLUMN price DECIMAL(12,2) NOT NULL DEFAULT 0`,
//     ];

//     connection.query(createProducts, (e1) => {
//         if (e1) console.error('Error creating products table:', e1.message);
//         else    console.log('✓ products table ready.');

//         connection.query(createKhqr, (e2) => {
//             if (e2) console.error('Error creating khqr table:', e2.message);
//             else    console.log('✓ khqr table ready.');

//             connection.query(createUsers, (e3) => {
//                 if (e3) console.error('Error creating users table:', e3.message);
//                 else    console.log('✓ users table ready.');

//                 connection.query(createOrders, (e4) => {
//                     if (e4) console.error('Error creating orders table:', e4.message);
//                     else    console.log('✓ orders table ready.');

//                     connection.query(createComments, (e5) => {
//                         if (e5) console.error('Error creating comments table:', e5.message);
//                         else    console.log('✓ comments table ready.');

//                         let completed = 0;
//                         migrations.forEach((sql) => {
//                             connection.query(sql, (me) => {
//                                 if (me && me.errno !== 1060 && me.errno !== 1091) {
//                                     console.warn('Migration warning:', me.message);
//                                 }
//                                 completed++;
//                                 if (completed === migrations.length) {
//                                     console.log('✓ All migrations applied.');
//                                     connection.release();
//                                 }
//                             });
//                         });
//                     });
//                 });
//             });
//         });
//     });
// });

// // ─── HELPERS ────────────────────────────────────────────────────────────────
// function safeJson(val) {
//     if (val === null || val === undefined) return null;
//     if (typeof val === 'object') return val;
//     try { return JSON.parse(val); } catch { return null; }
// }

// function toJson(val) {
//     if (val === null || val === undefined) return null;
//     if (typeof val === 'string') return val;
//     return JSON.stringify(val);
// }

// function hydrateProduct(row) {
//     if (!row) return null;
//     return {
//         id:             row.id,
//         category:       row.category,
//         name:           row.name,
//         price:          Number(row.price),
//         stock:          row.stock,
//         description:    row.description,
//         image:          row.image,
//         images:         safeJson(row.images)          || [],
//         variants:       safeJson(row.variants)        || [],
//         variantPricing: safeJson(row.variant_pricing) || null,
//         childModels:    safeJson(row.child_models)    || null,
//         created_at:     row.created_at,
//         updated_at:     row.updated_at,
//     };
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // GEMINI AI CHAT API
// // ─────────────────────────────────────────────────────────────────────────────
// const chatSystemInstruction = `
// You are PSP Assistant, the official and exclusive AI customer support agent for PSP MARKET (also known as PSP Mart).
// PSP MARKET is a trusted and growing online retail marketplace proudly based in the Kingdom of Cambodia.

// ════════════════════════════════════════
//   YOUR IDENTITY & ROLE
// ════════════════════════════════════════
// - Full Name        : PSP Assistant
// - Store Name       : PSP MARKET (PSP Mart)
// - Country          : Kingdom of Cambodia
// - Website          : https://pspmartonline.netlify.app
// - Your Role        : Official AI Customer Support Agent & Shopping Guide
// - You represent    : PSP MARKET brand in every conversation
// - You are NOT      : a general AI, not ChatGPT, not Gemini — you are PSP Assistant only

// If anyone asks "Who are you?" or "What AI is this?", always reply:
//   "I am PSP Assistant, the official AI support agent for PSP MARKET. I am here to help you shop smarter! 😊"

// ════════════════════════════════════════
//   YOUR PERSONALITY & TONE
// ════════════════════════════════════════
// - Warm, friendly, and welcoming like a real store staff member
// - Professional but never robotic or cold
// - Patient and calm — even with frustrated or angry customers
// - Positive energy in every reply
// - Use light emojis occasionally to feel human (👋 😊 🛍️ ✅ 📦) but never overdo it
// - Keep answers SHORT and CLEAR — no walls of text
// - Break information into bullet points when listing multiple things
// - Never be dismissive, sarcastic, or impatient

// ════════════════════════════════════════
//   LANGUAGE RULES
// ════════════════════════════════════════
// - If the customer writes in KHMER (ភាសាខ្មែរ) → reply fully in Khmer
// - If the customer writes in ENGLISH → reply fully in English
// - If the customer MIXES both languages → match their dominant language
// - NEVER switch language mid-conversation unless the customer switches first
// - Always match the customer's energy — if they are casual, be casual; if formal, be formal
// - Khmer customers are very important — treat them with extra warmth and respect

// ════════════════════════════════════════
//   GREETING — START OF EVERY CONVERSATION
// ════════════════════════════════════════
// Always greet warmly when a conversation begins:

// English:
//   "Hello! 👋 Welcome to PSP MARKET — Cambodia's trusted online store!
//    I'm PSP Assistant, your personal shopping support. How can I help you today? 🛍️"

// Khmer:
//   "សួស្តី! 👋 សូមស្វាគមន៍មកកាន់ PSP MARKET — ហាងអនឡាញដែលអ្នកទុកចិត្តបានក្នុងប្រទេសកម្ពុជា!
//    ខ្ញុំជា PSP Assistant សូមរីករាយជួយអ្នក។ តើខ្ញុំអាចជួយអ្វីបានខ្លះថ្ងៃនេះ? 🛍️"

// ════════════════════════════════════════
//   WHAT YOU HELP WITH — FULL GUIDE
// ════════════════════════════════════════

// ──────────────────────────────────────
//   1. PRODUCTS & CATALOG
// ──────────────────────────────────────
// - Help customers search and find products by name, category, or use case
// - Explain product variants: sizes, colors, models, combos
// - Explain multi-image galleries and zoom features on product pages
// - If exact product details (price, stock) are unknown, say:
//     "For the most accurate and up-to-date product details, please visit our website or contact our support team."
// - Never guess or make up product names, prices, or stock numbers
// - Categories available may include: Electronics, Accessories, Clothing, and more

// ──────────────────────────────────────
//   2. HOW TO PLACE AN ORDER
// ──────────────────────────────────────
// Step-by-step guide when a customer asks how to order:
//   Step 1 → Browse products on https://pspmartonline.netlify.app
//   Step 2 → Select your product, choose variant/size/color if needed
//   Step 3 → Click "Add to Cart" or "Buy Now"
//   Step 4 → Go to your Cart and review your items
//   Step 5 → Fill in your delivery details (name, phone, address)
//   Step 6 → Choose your delivery carrier and see shipping fee
//   Step 7 → Scan the Bakong KHQR code to complete payment
//   Step 8 → Your order is confirmed! You will receive an order ID (e.g. INV-XXXXXX)

// ──────────────────────────────────────
//   3. ORDER STATUS & TRACKING
// ──────────────────────────────────────
// - Order status flow: Pending → Confirmed → Shipped → Delivered
// - To check order status, ask: "Could you please provide your Order ID (starts with INV-) or your registered email?"
// - Customers can log in to their account on our website to view all their orders
// - If an order seems stuck or incorrect, collect details and escalate to support

// ──────────────────────────────────────
//   4. PAYMENT — BAKONG KHQR
// ──────────────────────────────────────
// - PSP MARKET uses Bakong KHQR (National Bank of Cambodia payment system)
// - Payment is made by scanning the QR code shown at checkout
// - Payments are processed instantly and securely
// - If payment fails:
//     → Ask the customer to check their Bakong app balance
//     → Ask them to try scanning again
//     → If still failing: "Please contact our support team with your Order ID and we will assist you immediately."
// - We do NOT currently accept cash on delivery or credit card directly

// ──────────────────────────────────────
//   5. DELIVERY & SHIPPING
// ──────────────────────────────────────
// - PSP MARKET delivers across Cambodia via Standard Home Delivery
// - Shipping fee is calculated at checkout based on the carrier selected
// - Delivery time varies depending on the customer's location
// - For remote areas, delivery may take longer than urban areas
// - If a customer asks about delivery to a specific province, say:
//     "We deliver across Cambodia! Shipping fees and times vary by location. Please check at checkout for your exact shipping fee."

// ──────────────────────────────────────
//   6. ACCOUNT & REGISTRATION
// ──────────────────────────────────────
// - Customers register with: Full Name, Email, Password
// - After registration, role is set to: Customer (default)
// - Login uses: Email + Password
// - Common login issues:
//     → Wrong password: Ask them to re-enter carefully (case-sensitive)
//     → Email not found: They may not have registered yet
//     → Account locked/inactive: Escalate to admin support
// - Profile features: customers can update avatar, view order history, manage their account

// ──────────────────────────────────────
//   7. RETURNS, REFUNDS & COMPLAINTS
// ──────────────────────────────────────
// When a customer has a complaint, return request, or refund inquiry:
//   1. Stay calm and empathetic: "I'm sorry to hear that! Let me help you resolve this."
//   2. Collect these details:
//        - Full name
//        - Registered email
//        - Order ID (INV-XXXXXX)
//        - Description of the issue
//        - Photo of item if damaged (ask them to send via support email)
//   3. Then say: "Thank you for providing those details. Our support team will review your case and contact you as soon as possible."
// - Return/refund policies are handled by the PSP MARKET support team

// ──────────────────────────────────────
//   8. PROMOTIONS & DISCOUNTS
// ──────────────────────────────────────
// - If you are unaware of current promotions, say:
//     "Please visit our website or follow our official updates for the latest deals and promotions! 🎉"
// - Never make up or promise discounts you are not sure about

// ──────────────────────────────────────
//   9. ADMIN & DASHBOARD (for staff only)
// ──────────────────────────────────────
// - PSP MARKET has an admin dashboard for managing products, orders, users, analytics
// - If a customer accidentally asks admin-related questions, politely redirect:
//     "That section is for our internal team. Is there anything else I can help you with as a customer? 😊"

// ──────────────────────────────────────
//   10. TELEGRAM ORDER NOTIFICATIONS
// ──────────────────────────────────────
// - PSP MARKET uses a Telegram Bot to notify admins of new orders
// - This is an internal system — do not discuss technical details with customers
// - If a customer asks about order confirmation notifications, say:
//     "Our team is notified of every order and will process yours as quickly as possible! ✅"

// ════════════════════════════════════════
//   STRICT RULES — NEVER BREAK THESE
// ════════════════════════════════════════
// 1. NEVER make up product names, prices, stock levels, or order details
// 2. NEVER share any other customer's data, orders, or personal information
// 3. NEVER reveal internal system details (database, server, API keys, Telegram bot details)
// 4. NEVER pretend to be a human if sincerely asked — say: "I am PSP Assistant, an AI support agent for PSP MARKET."
// 5. NEVER go off-topic. If asked about unrelated topics (politics, other stores, general knowledge), say:
//      "I'm here specifically to help you with PSP MARKET. Is there anything about our store I can assist with? 😊"
// 6. NEVER be rude, sarcastic, or dismissive — even with difficult customers
// 7. NEVER promise refunds, discounts, or free shipping unless you are certain it is a store policy
// 8. If you truly cannot answer something, ALWAYS say:
//      "I'm not able to answer that right now. Please contact our support team or leave your email and we will get back to you as soon as possible."

// ════════════════════════════════════════
//   CLOSING — END OF CONVERSATION
// ════════════════════════════════════════
// Always close conversations warmly:

// English:
//   "Thank you for choosing PSP MARKET! 😊 We appreciate your support.
//    If you need anything else, don't hesitate to ask. Have a wonderful day! 🛍️"

// Khmer:
//   "អរគុណដែលបានជ្រើសរើស PSP MARKET! 😊 យើងខ្ញុំពេញចិត្តនឹងការគាំទ្ររបស់អ្នក។
//    បើមានអ្វីត្រូវការជំនួយទៀត សូមសួរបានគ្រប់ពេល។ សូមឱ្យមានថ្ងៃដ៏មានសុភមង្គល! 🛍️"

// ════════════════════════════════════════
//   FALLBACK — WHEN UNSURE
// ════════════════════════════════════════
// If you are ever unsure about any answer, always fall back to:
//   "For the most accurate information, please visit https://pspmartonline.netlify.app
//    or contact our support team directly. We are always happy to help! 😊"
// `;

// app.post('/api/chat', async (req, res) => {
//     try {
//         const { message } = req.body;

//         if (!message || !message.trim()) {
//             return res.status(400).json({ error: 'message is required.' });
//         }

//         const response = await ai.models.generateContent({
//             model: 'gemini-flash-lite-latest',
//             contents: message,
//             config: {
//                 systemInstruction: chatSystemInstruction
//             }
//         });

//         res.json({ reply: response.text });
//     } catch (error) {
//         console.error('[chat POST /api/chat]', error);
//         res.status(500).json({ error: 'The server is currently busy. Please wait a moment and try again.' });
//     }
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // PRODUCTS API
// // ─────────────────────────────────────────────────────────────────────────────
// app.get('/api/products', (req, res) => {
//     db.query('SELECT * FROM products ORDER BY created_at DESC', (err, rows) => {
//         if (err) return res.status(500).json({ error: err.message });
//         res.json(rows.map(hydrateProduct));
//     });
// });

// app.get('/api/products/:id', (req, res) => {
//     db.query('SELECT * FROM products WHERE id = ?', [req.params.id], (err, rows) => {
//         if (err)          return res.status(500).json({ error: err.message });
//         if (!rows.length) return res.status(404).json({ message: 'Product not found' });
//         res.json(hydrateProduct(rows[0]));
//     });
// });

// app.post('/api/products', (req, res) => {
//     const { id, category, name, price, stock, description, image, images, variants, variantPricing, childModels } = req.body;

//     if (!name || price === undefined) {
//         return res.status(400).json({ error: 'name and price are required.' });
//     }

//     const productId  = id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
//     const coverImage = image || (Array.isArray(images) && images[0]) || null;

//     const sql = `
//         INSERT INTO products (id, category, name, price, stock, description, image, images, variants, variant_pricing, child_models)
//         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
//     `;
//     const values = [
//         productId,
//         category  || 'Other',
//         name.trim(),
//         Number(price) || 0,
//         stock !== undefined && stock !== '' ? Number(stock) : null,
//         description || null,
//         coverImage,
//         toJson(images      || []),
//         toJson(variants    || []),
//         toJson(variantPricing || null),
//         toJson(childModels || null),
//     ];

//     db.query(sql, values, (err) => {
//         if (err) return res.status(500).json({ error: err.message });
//         db.query('SELECT * FROM products WHERE id = ?', [productId], (err2, rows) => {
//             if (err2) return res.status(500).json({ error: err2.message });
//             res.status(201).json({ message: 'Product created successfully.', product: hydrateProduct(rows[0]) });
//         });
//     });
// });

// app.put('/api/products/:id', (req, res) => {
//     const { id } = req.params;
//     const { category, name, price, stock, description, image, images, variants, variantPricing, childModels } = req.body;
//     const coverImage = image || (Array.isArray(images) && images[0]) || null;

//     const sql = `
//         UPDATE products SET
//             category = ?, name = ?, price = ?, stock = ?, description = ?,
//             image = ?, images = ?, variants = ?, variant_pricing = ?, child_models = ?
//         WHERE id = ?
//     `;
//     const values = [
//         category || 'Other', (name || '').trim(), Number(price) || 0,
//         stock !== undefined && stock !== '' ? Number(stock) : null,
//         description || null, coverImage,
//         toJson(images || []), toJson(variants || []),
//         toJson(variantPricing || null), toJson(childModels || null), id,
//     ];

//     db.query(sql, values, (err, result) => {
//         if (err)                  return res.status(500).json({ error: err.message });
//         if (!result.affectedRows) return res.status(404).json({ message: 'Product not found.' });
//         db.query('SELECT * FROM products WHERE id = ?', [id], (err2, rows) => {
//             if (err2) return res.status(500).json({ error: err2.message });
//             res.json({ message: 'Product updated successfully.', product: hydrateProduct(rows[0]) });
//         });
//     });
// });

// app.patch('/api/products/:id', (req, res) => {
//     const { id } = req.params;
//     const allowed = ['category','name','price','stock','description','image','images','variants','variant_pricing','child_models'];
//     const dbMap   = { variantPricing: 'variant_pricing', childModels: 'child_models' };
//     const fields  = [];
//     const values  = [];

//     Object.entries(req.body).forEach(([key, val]) => {
//         const col = dbMap[key] || key;
//         if (!allowed.includes(col)) return;
//         const jsonCols = ['images','variants','variant_pricing','child_models'];
//         fields.push(`${col} = ?`);
//         values.push(jsonCols.includes(col) ? toJson(val) : val);
//     });

//     if (!fields.length) return res.status(400).json({ error: 'No valid fields to update.' });
//     values.push(id);

//     db.query(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`, values, (err, result) => {
//         if (err)                  return res.status(500).json({ error: err.message });
//         if (!result.affectedRows) return res.status(404).json({ message: 'Product not found.' });
//         db.query('SELECT * FROM products WHERE id = ?', [id], (err2, rows) => {
//             if (err2) return res.status(500).json({ error: err2.message });
//             res.json({ message: 'Product patched successfully.', product: hydrateProduct(rows[0]) });
//         });
//     });
// });

// app.delete('/api/products/:id', (req, res) => {
//     db.query('DELETE FROM products WHERE id = ?', [req.params.id], (err, result) => {
//         if (err)                  return res.status(500).json({ error: err.message });
//         if (!result.affectedRows) return res.status(404).json({ message: 'Product not found.' });
//         res.json({ message: 'Product deleted successfully.' });
//     });
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // USERS API
// // ─────────────────────────────────────────────────────────────────────────────
// app.post('/api/users/register', (req, res) => {
//     const { id, name, email, passwordHash, role, status } = req.body;

//     if (!name || !email || !passwordHash) {
//         return res.status(400).json({ error: 'name, email, and passwordHash are required.' });
//     }

//     const userId = id || ('USR-' + Date.now());
//     const sql = `INSERT INTO users (id, name, email, password_hash, role, status, avatar) VALUES (?, ?, ?, ?, ?, ?, NULL)`;

//     db.query(sql, [
//         userId,
//         name.trim(),
//         email.toLowerCase().trim(),
//         passwordHash,
//         role   || 'Customer',
//         status || 'Active',
//     ], (err) => {
//         if (err) {
//             if (err.code === 'ER_DUP_ENTRY') {
//                 return res.status(409).json({ error: 'This email is already registered.' });
//             }
//             return res.status(500).json({ error: err.message });
//         }
//         db.query('SELECT * FROM users WHERE id = ?', [userId], (e2, rows) => {
//             if (e2) return res.status(500).json({ error: e2.message });
//             const u = rows[0];
//             res.status(201).json({
//                 message: 'Registered successfully.',
//                 user: {
//                     id:     u.id,
//                     name:   u.name,
//                     email:  u.email,
//                     role:   u.role,
//                     status: u.status,
//                     avatar: u.avatar || null,
//                     date:   u.created_at ? u.created_at.toISOString().slice(0, 10) : null,
//                 },
//             });
//         });
//     });
// });

// app.post('/api/users/login', (req, res) => {
//     const { email, passwordHash } = req.body;

//     if (!email || !passwordHash) {
//         return res.status(400).json({ error: 'email and passwordHash are required.' });
//     }

//     db.query('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()], (err, rows) => {
//         if (err)          return res.status(500).json({ error: err.message });
//         if (!rows.length) return res.status(404).json({ error: 'No account found for this email.' });

//         const u = rows[0];
//         if (u.password_hash !== passwordHash) {
//             return res.status(401).json({ error: 'Incorrect password.' });
//         }

//         res.json({
//             user: {
//                 id:     u.id,
//                 name:   u.name,
//                 email:  u.email,
//                 role:   u.role,
//                 status: u.status,
//                 avatar: u.avatar || null,
//                 date:   u.created_at ? u.created_at.toISOString().slice(0, 10) : null,
//             },
//         });
//     });
// });

// app.post('/api/users/check-email', (req, res) => {
//     const { email } = req.body;
//     if (!email) return res.status(400).json({ error: 'email required.' });
//     db.query('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()], (err, rows) => {
//         if (err) return res.status(500).json({ error: err.message });
//         res.json({ exists: rows.length > 0 });
//     });
// });

// app.get('/api/users', (req, res) => {
//     db.query(
//         'SELECT id, name, email, role, status, created_at FROM users ORDER BY created_at DESC',
//         (err, rows) => {
//             if (err) return res.status(500).json({ error: err.message });
//             res.json(rows.map(u => ({
//                 id:     u.id,
//                 name:   u.name,
//                 email:  u.email,
//                 role:   u.role,
//                 status: u.status,
//                 date:   u.created_at ? u.created_at.toISOString().slice(0, 10) : null,
//             })));
//         }
//     );
// });

// app.patch('/api/users/:id', (req, res) => {
//     const allowed = ['name', 'role', 'status', 'avatar'];
//     const fields  = [];
//     const values  = [];

//     Object.entries(req.body).forEach(([k, v]) => {
//         if (allowed.includes(k)) { fields.push(`${k} = ?`); values.push(v); }
//     });

//     if (!fields.length) return res.status(400).json({ error: 'No valid fields to update.' });
//     values.push(req.params.id);

//     db.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values, (err, result) => {
//         if (err)                  return res.status(500).json({ error: err.message });
//         if (!result.affectedRows) return res.status(404).json({ message: 'User not found.' });
//         res.json({ message: 'User updated successfully.' });
//     });
// });

// app.delete('/api/users/:id', (req, res) => {
//     db.query('DELETE FROM users WHERE id = ?', [req.params.id], (err, result) => {
//         if (err)                  return res.status(500).json({ error: err.message });
//         if (!result.affectedRows) return res.status(404).json({ message: 'User not found.' });
//         res.json({ message: 'User deleted successfully.' });
//     });
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // KHQR API
// // ─────────────────────────────────────────────────────────────────────────────
// app.get('/api/khqr', (req, res) => {
//     db.query('SELECT image FROM khqr WHERE id = 1', (err, rows) => {
//         if (err) return res.status(500).json({ error: err.message });
//         res.json({ image: rows[0]?.image || null });
//     });
// });

// app.put('/api/khqr', (req, res) => {
//     const { image } = req.body;
//     if (!image) return res.status(400).json({ error: 'image is required.' });

//     const sql = `INSERT INTO khqr (id, image) VALUES (1, ?) ON DUPLICATE KEY UPDATE image = VALUES(image)`;
//     db.query(sql, [image], (err) => {
//         if (err) return res.status(500).json({ error: err.message });
//         res.json({ message: 'KHQR updated successfully.' });
//     });
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // ORDERS API
// // ─────────────────────────────────────────────────────────────────────────────
// function hydrateOrder(row) {
//     if (!row) return null;
//     return {
//         id:           row.id,
//         accountEmail: row.account_email,
//         customerName: row.customer_name,
//         phone:        row.phone,
//         address:      row.address,
//         mapLocation:  row.map_location,
//         carrier:      row.carrier,
//         shippingFee:  Number(row.shipping_fee || 0),
//         subtotal:     Number(row.subtotal || 0),
//         total:        Number(row.total || 0),
//         status:       row.status || 'paid',
//         date:         row.date_str || (row.created_at ? row.created_at.toISOString().slice(0, 16).replace('T', ' ') : new Date().toLocaleString()),
//         items:        safeJson(row.items) || [],
//         created_at:   row.created_at,
//         updated_at:   row.updated_at,
//     };
// }

// app.get('/api/orders', (req, res) => {
//     const { email } = req.query;
//     let sql = 'SELECT * FROM orders';
//     const values = [];

//     if (email) {
//         sql += ' WHERE account_email = ?';
//         values.push(email.toLowerCase().trim());
//     }
//     sql += ' ORDER BY created_at DESC';

//     db.query(sql, values, (err, rows) => {
//         if (err) return res.status(500).json({ error: err.message });
//         res.json(rows.map(hydrateOrder));
//     });
// });

// app.post('/api/orders', (req, res) => {
//     const { id, accountEmail, customerName, phone, address, mapLocation, carrier, shippingFee, subtotal, total, items, date } = req.body;

//     if (!accountEmail || !customerName || !phone || !items) {
//         return res.status(400).json({ error: 'Missing required fields' });
//     }

//     const orderId      = id || `INV-${Date.now().toString(36).toUpperCase()}`;
//     const orderDateStr = date || new Date().toLocaleString('en-US', { timeZone: 'Asia/Phnom_Penh' });

//     const sql = `
//         INSERT INTO orders (id, account_email, customer_name, phone, address, map_location, carrier,
//                             shipping_fee, subtotal, total, status, date_str, items)
//         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', ?, ?)
//         ON DUPLICATE KEY UPDATE
//             status = VALUES(status), updated_at = CURRENT_TIMESTAMP
//     `;

//     const values = [
//         orderId,
//         accountEmail.toLowerCase().trim(),
//         customerName.trim(),
//         phone.trim(),
//         address.trim(),
//         mapLocation || null,
//         carrier || 'Standard Home Delivery',
//         Number(shippingFee) || 0,
//         Number(subtotal)    || 0,
//         Number(total)       || 0,
//         orderDateStr,
//         JSON.stringify(items || []),
//     ];

//     db.query(sql, values, (err) => {
//         if (err) return res.status(500).json({ error: err.message });
//         db.query('SELECT * FROM orders WHERE id = ?', [orderId], (err2, rows) => {
//             if (err2) return res.status(500).json({ error: err2.message });
//             res.status(201).json({ message: 'Order saved', order: hydrateOrder(rows[0]) });
//         });
//     });
// });

// app.delete('/api/orders/:id', (req, res) => {
//     db.query('DELETE FROM orders WHERE id = ?', [req.params.id], (err, result) => {
//         if (err)                  return res.status(500).json({ error: err.message });
//         if (!result.affectedRows) return res.status(404).json({ message: 'Order record not found.' });
//         res.json({ message: 'Invoice historical record deleted successfully.' });
//     });
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // COMMENTS API
// // ─────────────────────────────────────────────────────────────────────────────
// function hydrateComment(row) {
//     if (!row) return null;
//     return {
//         id:         row.id,
//         username:   row.username,
//         email:      row.email,
//         rating:     row.rating,
//         comment:    row.comment,
//         date:       row.date_str,
//         created_at: row.created_at,
//     };
// }

// app.get('/api/comments', (req, res) => {
//     db.query(
//         'SELECT id, username, email, comment, rating, date_str, created_at FROM comments ORDER BY created_at DESC',
//         (err, rows) => {
//             if (err) {
//                 console.error('[comments GET /]', err);
//                 return res.status(500).json({ error: 'Failed to fetch comments.' });
//             }
//             res.json(rows.map(hydrateComment));
//         }
//     );
// });

// app.post('/api/comments', (req, res) => {
//     const { id, username, email, comment, rating, date } = req.body;

//     if (!username || !email || !comment) {
//         return res.status(400).json({ error: 'username, email and comment are required.' });
//     }

//     const commentId  = id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
//     const safeRating = Math.min(5, Math.max(1, parseInt(rating, 10) || 5));
//     const dateStr    = date || new Date().toLocaleDateString('en-US');

//     db.query(
//         'INSERT INTO comments (id, username, email, comment, rating, date_str) VALUES (?, ?, ?, ?, ?, ?)',
//         [commentId, username.trim(), email.trim().toLowerCase(), comment.trim(), safeRating, dateStr],
//         (err) => {
//             if (err) {
//                 if (err.code === 'ER_DUP_ENTRY') {
//                     return res.status(200).json({ success: true, id: commentId });
//                 }
//                 console.error('[comments POST /]', err);
//                 return res.status(500).json({ error: 'Failed to save comment.' });
//             }
//             res.status(201).json({ success: true, id: commentId });
//         }
//     );
// });

// app.delete('/api/comments/:id', (req, res) => {
//     db.query('DELETE FROM comments WHERE id = ?', [req.params.id], (err, result) => {
//         if (err) {
//             console.error('[comments DELETE /:id]', err);
//             return res.status(500).json({ error: 'Failed to delete comment.' });
//         }
//         if (result.affectedRows === 0) {
//             return res.status(404).json({ message: 'Comment not found.' });
//         }
//         res.json({ success: true, message: 'Comment deleted successfully.' });
//     });
// });

// app.delete('/api/comments', (req, res) => {
//     db.query('DELETE FROM comments', (err) => {
//         if (err) {
//             console.error('[comments DELETE /]', err);
//             return res.status(500).json({ error: 'Failed to clear comments.' });
//         }
//         res.json({ success: true, message: 'All comments deleted.' });
//     });
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // INVOICE IMAGES API
// // Store payment screenshot images per order
// // ─────────────────────────────────────────────────────────────────────────────
// db.getConnection((err, connection) => {
//     if (err) return;
//     const createInvoiceImages = `
//     CREATE TABLE IF NOT EXISTS invoice_images (
//         id           VARCHAR(64)   PRIMARY KEY,
//         order_id     VARCHAR(64)   NOT NULL,
//         account_email VARCHAR(255) NOT NULL,
//         image        LONGTEXT      NOT NULL,
//         uploaded_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
//     )`;
//     connection.query(createInvoiceImages, (e) => {
//         if (e) console.error('Error creating invoice_images table:', e.message);
//         else   console.log('✓ invoice_images table ready.');
//         connection.release();
//     });
// });

// // Upload invoice image for an order
// app.post('/api/invoice-images', (req, res) => {
//     const { orderId, accountEmail, image } = req.body;

//     if (!orderId || !accountEmail || !image) {
//         return res.status(400).json({ error: 'orderId, accountEmail, and image are required.' });
//     }

//     const id = 'IMG-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

//     const sql = `
//         INSERT INTO invoice_images (id, order_id, account_email, image)
//         VALUES (?, ?, ?, ?)
//         ON DUPLICATE KEY UPDATE image = VALUES(image), uploaded_at = CURRENT_TIMESTAMP
//     `;

//     db.query(sql, [id, orderId, accountEmail.toLowerCase().trim(), image], (err) => {
//         if (err) return res.status(500).json({ error: err.message });
//         res.status(201).json({ success: true, id, message: 'Invoice image saved.' });
//     });
// });

// // Get invoice images — by email (customer view) or all (admin view)
// app.get('/api/invoice-images', (req, res) => {
//     const { email } = req.query;
//     let sql = 'SELECT * FROM invoice_images';
//     const values = [];

//     if (email) {
//         sql += ' WHERE account_email = ?';
//         values.push(email.toLowerCase().trim());
//     }
//     sql += ' ORDER BY uploaded_at DESC';

//     db.query(sql, values, (err, rows) => {
//         if (err) return res.status(500).json({ error: err.message });
//         res.json(rows.map(r => ({
//             id:           r.id,
//             orderId:      r.order_id,
//             accountEmail: r.account_email,
//             image:        r.image,
//             uploadedAt:   r.uploaded_at,
//         })));
//     });
// });

// // Get invoice image by order ID
// app.get('/api/invoice-images/:orderId', (req, res) => {
//     db.query(
//         'SELECT * FROM invoice_images WHERE order_id = ?',
//         [req.params.orderId],
//         (err, rows) => {
//             if (err)          return res.status(500).json({ error: err.message });
//             if (!rows.length) return res.status(404).json({ message: 'No image found for this order.' });
//             const r = rows[0];
//             res.json({
//                 id:           r.id,
//                 orderId:      r.order_id,
//                 accountEmail: r.account_email,
//                 image:        r.image,
//                 uploadedAt:   r.uploaded_at,
//             });
//         }
//     );
// });

// // Admin: delete invoice image
// app.delete('/api/invoice-images/:id', (req, res) => {
//     db.query('DELETE FROM invoice_images WHERE id = ?', [req.params.id], (err, result) => {
//         if (err)                  return res.status(500).json({ error: err.message });
//         if (!result.affectedRows) return res.status(404).json({ message: 'Invoice image not found.' });
//         res.json({ success: true, message: 'Invoice image deleted.' });
//     });
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // DASHBOARD ANALYTICS API
// // Auto-calculated from existing orders, products, users tables
// // ─────────────────────────────────────────────────────────────────────────────
// app.get('/api/analytics/summary', (req, res) => {
//     const results = {};

//     // 1. Total revenue + total orders count
//     db.query(
//         `SELECT
//             COUNT(*)            AS totalOrders,
//             SUM(total)          AS totalRevenue,
//             SUM(subtotal)       AS totalSubtotal,
//             SUM(shipping_fee)   AS totalShipping
//          FROM orders`,
//         (err, rows) => {
//             if (err) return res.status(500).json({ error: err.message });
//             results.totalOrders   = rows[0].totalOrders   || 0;
//             results.totalRevenue  = Number(rows[0].totalRevenue  || 0);
//             results.totalSubtotal = Number(rows[0].totalSubtotal || 0);
//             results.totalShipping = Number(rows[0].totalShipping || 0);

//             // 2. Orders by status
//             db.query(
//                 `SELECT status, COUNT(*) AS count FROM orders GROUP BY status`,
//                 (err2, rows2) => {
//                     if (err2) return res.status(500).json({ error: err2.message });
//                     results.ordersByStatus = {};
//                     rows2.forEach(r => { results.ordersByStatus[r.status] = r.count; });

//                     // 3. Total products + total stock units
//                     db.query(
//                         `SELECT COUNT(*) AS totalProducts, SUM(stock) AS totalStock FROM products`,
//                         (err3, rows3) => {
//                             if (err3) return res.status(500).json({ error: err3.message });
//                             results.totalProducts = rows3[0].totalProducts || 0;
//                             results.totalStock    = Number(rows3[0].totalStock || 0);

//                             // 4. Total registered users + active users
//                             db.query(
//                                 `SELECT
//                                     COUNT(*) AS totalUsers,
//                                     SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) AS activeUsers
//                                  FROM users`,
//                                 (err4, rows4) => {
//                                     if (err4) return res.status(500).json({ error: err4.message });
//                                     results.totalUsers  = rows4[0].totalUsers  || 0;
//                                     results.activeUsers = rows4[0].activeUsers || 0;

//                                     // 5. Unique customers who placed orders
//                                     db.query(
//                                         `SELECT COUNT(DISTINCT account_email) AS buyingCustomers FROM orders`,
//                                         (err5, rows5) => {
//                                             if (err5) return res.status(500).json({ error: err5.message });
//                                             results.buyingCustomers = rows5[0].buyingCustomers || 0;

//                                             // 6. Total items sold (sum of qty inside items JSON)
//                                             db.query(
//                                                 `SELECT items FROM orders`,
//                                                 (err6, rows6) => {
//                                                     if (err6) return res.status(500).json({ error: err6.message });
//                                                     let totalItemsSold = 0;
//                                                     rows6.forEach(row => {
//                                                         try {
//                                                             const items = JSON.parse(row.items || '[]');
//                                                             items.forEach(item => {
//                                                                 totalItemsSold += Number(item.quantity || item.qty || 1);
//                                                             });
//                                                         } catch {}
//                                                     });
//                                                     results.totalItemsSold = totalItemsSold;

//                                                     // 7. Top 5 best-selling products by quantity
//                                                     db.query(
//                                                         `SELECT items FROM orders`,
//                                                         (err7, rows7) => {
//                                                             if (err7) return res.status(500).json({ error: err7.message });
//                                                             const productMap = {};
//                                                             rows7.forEach(row => {
//                                                                 try {
//                                                                     const items = JSON.parse(row.items || '[]');
//                                                                     items.forEach(item => {
//                                                                         const key = item.name || item.productName || 'Unknown';
//                                                                         const qty = Number(item.quantity || item.qty || 1);
//                                                                         productMap[key] = (productMap[key] || 0) + qty;
//                                                                     });
//                                                                 } catch {}
//                                                             });
//                                                             results.topProducts = Object.entries(productMap)
//                                                                 .sort((a, b) => b[1] - a[1])
//                                                                 .slice(0, 5)
//                                                                 .map(([name, qty]) => ({ name, qty }));

//                                                             // 8. Recent 5 orders summary
//                                                             db.query(
//                                                                 `SELECT id, account_email, customer_name, total, status, date_str
//                                                                  FROM orders ORDER BY created_at DESC LIMIT 5`,
//                                                                 (err8, rows8) => {
//                                                                     if (err8) return res.status(500).json({ error: err8.message });
//                                                                     results.recentOrders = rows8.map(r => ({
//                                                                         id:           r.id,
//                                                                         email:        r.account_email,
//                                                                         customerName: r.customer_name,
//                                                                         total:        Number(r.total),
//                                                                         status:       r.status,
//                                                                         date:         r.date_str,
//                                                                     }));

//                                                                     // 9. Revenue per day (last 7 days)
//                                                                     db.query(
//                                                                         `SELECT
//                                                                             DATE(created_at) AS day,
//                                                                             SUM(total)       AS revenue,
//                                                                             COUNT(*)         AS orders
//                                                                          FROM orders
//                                                                          WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
//                                                                          GROUP BY DATE(created_at)
//                                                                          ORDER BY day ASC`,
//                                                                         (err9, rows9) => {
//                                                                             if (err9) return res.status(500).json({ error: err9.message });
//                                                                             results.revenueLastWeek = rows9.map(r => ({
//                                                                                 day:     r.day,
//                                                                                 revenue: Number(r.revenue),
//                                                                                 orders:  r.orders,
//                                                                             }));

//                                                                             res.json(results);
//                                                                         }
//                                                                     );
//                                                                 }
//                                                             );
//                                                         }
//                                                     );
//                                                 }
//                                             );
//                                         }
//                                     );
//                                 }
//                             );
//                         }
//                     );
//                 }
//             );
//         }
//     );
// });

// // Per-user analytics (for customer dashboard)
// app.get('/api/analytics/user', (req, res) => {
//     const { email } = req.query;
//     if (!email) return res.status(400).json({ error: 'email is required.' });

//     const userEmail = email.toLowerCase().trim();

//     db.query(
//         `SELECT COUNT(*) AS totalOrders, SUM(total) AS totalSpent, SUM(subtotal) AS totalSubtotal
//          FROM orders WHERE account_email = ?`,
//         [userEmail],
//         (err, rows) => {
//             if (err) return res.status(500).json({ error: err.message });
//             const summary = {
//                 totalOrders:   rows[0].totalOrders  || 0,
//                 totalSpent:    Number(rows[0].totalSpent    || 0),
//                 totalSubtotal: Number(rows[0].totalSubtotal || 0),
//             };

//             db.query(
//                 `SELECT items FROM orders WHERE account_email = ?`,
//                 [userEmail],
//                 (err2, rows2) => {
//                     if (err2) return res.status(500).json({ error: err2.message });
//                     let totalItemsBought = 0;
//                     rows2.forEach(row => {
//                         try {
//                             const items = JSON.parse(row.items || '[]');
//                             items.forEach(item => {
//                                 totalItemsBought += Number(item.quantity || item.qty || 1);
//                             });
//                         } catch {}
//                     });
//                     summary.totalItemsBought = totalItemsBought;

//                     db.query(
//                         `SELECT id, total, status, date_str FROM orders
//                          WHERE account_email = ? ORDER BY created_at DESC LIMIT 5`,
//                         [userEmail],
//                         (err3, rows3) => {
//                             if (err3) return res.status(500).json({ error: err3.message });
//                             summary.recentOrders = rows3.map(r => ({
//                                 id:     r.id,
//                                 total:  Number(r.total),
//                                 status: r.status,
//                                 date:   r.date_str,
//                             }));
//                             res.json(summary);
//                         }
//                     );
//                 }
//             );
//         }
//     );
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // HEALTH CHECK
// // ─────────────────────────────────────────────────────────────────────────────
// app.get('/api/health', (req, res) => {
//     db.query('SELECT 1', (err) => {
//         if (err) return res.status(503).json({ status: 'db_error', error: err.message });
//         res.json({ status: 'ok' });
//     });
// });

// // ─── KEEP ALIVE (prevents Render free tier sleep) ───────────────────────────
// const https = require('https');
// const RENDER_URL = 'https://backend-psp-market.onrender.com/api/health';

// setInterval(() => {
//     https.get(RENDER_URL, (res) => {
//         console.log(`✓ Keep-alive ping: ${res.statusCode}`);
//     }).on('error', (err) => {
//         console.warn('Keep-alive ping failed:', err.message);
//     });
// }, 10 * 60 * 1000); // ping every 10 minutes

// // ─── START SERVER ────────────────────────────────────────────────────────────
// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => console.log(`✓ Server running on port ${PORT}`));






















// require('dotenv').config();

// const express = require('express');
// const mysql   = require('mysql2');
// const cors    = require('cors');
// const https   = require('https');

// // ─── Gemini AI ─────────────────────────────────────────────────────────────
// const { GoogleGenAI } = require('@google/genai');
// const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// const app = express();

// // ─── CORS ───────────────────────────────────────────────────────────────────
// app.use(cors({
//     origin: [
//         'https://pspmartonline.netlify.app',
//         'http://localhost:5173'
//     ],
//     methods: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH'],
//     credentials: true
// }));

// app.use(express.json({ limit: '50mb' }));
// app.use(express.urlencoded({ limit: '50mb', extended: true }));

// // ─── DATABASE POOL (Aiven Cloud with SSL) ───────────────────────────────────
// const db = mysql.createPool({
//     host:     process.env.DB_HOST,
//     user:     process.env.DB_USER,
//     password: process.env.DB_PASSWORD,
//     database: process.env.DB_NAME,
//     port:     process.env.DB_PORT || 3306,
//     waitForConnections: true,
//     connectionLimit: 10,
//     queueLimit: 0,
//     ssl: { rejectUnauthorized: false }
// });

// // ─── AUTO-CREATE + AUTO-MIGRATE TABLES ──────────────────────────────────────
// db.getConnection((err, connection) => {
//     if (err) {
//         console.error('Database connection failed:', err.message);
//         return;
//     }
//     console.log('✓ Connected to MySQL Database.');

//     const createProducts = `
//     CREATE TABLE IF NOT EXISTS products (
//         id          VARCHAR(64)   PRIMARY KEY,
//         category    VARCHAR(100)  NOT NULL DEFAULT 'Other',
//         name        VARCHAR(255)  NOT NULL,
//         price       DECIMAL(12,2) NOT NULL DEFAULT 0,
//         description TEXT,
//         image       LONGTEXT,
//         created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
//     )`;

//     const createKhqr = `
//     CREATE TABLE IF NOT EXISTS khqr (
//         id         INT PRIMARY KEY DEFAULT 1,
//         image      LONGTEXT,
//         updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
//     )`;

//     const createUsers = `
//     CREATE TABLE IF NOT EXISTS users (
//         id            VARCHAR(64)   PRIMARY KEY,
//         name          VARCHAR(255)  NOT NULL,
//         email         VARCHAR(255)  NOT NULL UNIQUE,
//         password_hash VARCHAR(64)   NOT NULL,
//         role          VARCHAR(50)   DEFAULT 'Customer',
//         status        VARCHAR(50)   DEFAULT 'Active',
//         avatar        LONGTEXT,
//         created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
//     )`;

//     const createOrders = `
//     CREATE TABLE IF NOT EXISTS orders (
//         id            VARCHAR(64)   PRIMARY KEY,
//         account_email VARCHAR(255)  NOT NULL,
//         customer_name VARCHAR(255)  NOT NULL,
//         phone         VARCHAR(50)   NOT NULL,
//         address       TEXT          NOT NULL,
//         map_location  TEXT,
//         carrier       VARCHAR(100)  NOT NULL,
//         shipping_fee  DECIMAL(12,2) NOT NULL DEFAULT 0.00,
//         subtotal      DECIMAL(12,2) NOT NULL DEFAULT 0.00,
//         total         DECIMAL(12,2) NOT NULL DEFAULT 0.00,
//         status        VARCHAR(50)   DEFAULT 'pending',
//         date_str      VARCHAR(100)  DEFAULT NULL,
//         items         LONGTEXT      NOT NULL,
//         created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
//         updated_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
//     )`;

//     const createComments = `
//     CREATE TABLE IF NOT EXISTS comments (
//         id          VARCHAR(64)   PRIMARY KEY,
//         username    VARCHAR(255)  NOT NULL,
//         email       VARCHAR(255)  NOT NULL,
//         rating      INT           NOT NULL DEFAULT 0,
//         comment     TEXT          NOT NULL,
//         date_str    VARCHAR(100)  DEFAULT NULL,
//         created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
//     )`;

//     const createInvoiceImages = `
//     CREATE TABLE IF NOT EXISTS invoice_images (
//         id            VARCHAR(64)   PRIMARY KEY,
//         order_id      VARCHAR(64)   NOT NULL,
//         account_email VARCHAR(255)  NOT NULL,
//         image         LONGTEXT      NOT NULL,
//         uploaded_at   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
//     )`;

//     const migrations = [
//         `ALTER TABLE products ADD COLUMN stock            INT       DEFAULT NULL`,
//         `ALTER TABLE products ADD COLUMN images           LONGTEXT`,
//         `ALTER TABLE products ADD COLUMN variants         LONGTEXT`,
//         `ALTER TABLE products ADD COLUMN variant_pricing  LONGTEXT`,
//         `ALTER TABLE products ADD COLUMN child_models     LONGTEXT`,
//         `ALTER TABLE products ADD COLUMN updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
//         `ALTER TABLE products MODIFY COLUMN id VARCHAR(64) NOT NULL`,
//         `ALTER TABLE products MODIFY COLUMN price DECIMAL(12,2) NOT NULL DEFAULT 0`,
//     ];

//     connection.query(createProducts, (e1) => {
//         if (e1) console.error('Error creating products table:', e1.message);
//         else    console.log('✓ products table ready.');

//         connection.query(createKhqr, (e2) => {
//             if (e2) console.error('Error creating khqr table:', e2.message);
//             else    console.log('✓ khqr table ready.');

//             connection.query(createUsers, (e3) => {
//                 if (e3) console.error('Error creating users table:', e3.message);
//                 else    console.log('✓ users table ready.');

//                 connection.query(createOrders, (e4) => {
//                     if (e4) console.error('Error creating orders table:', e4.message);
//                     else    console.log('✓ orders table ready.');

//                     connection.query(createComments, (e5) => {
//                         if (e5) console.error('Error creating comments table:', e5.message);
//                         else    console.log('✓ comments table ready.');

//                         connection.query(createInvoiceImages, (e6) => {
//                             if (e6) console.error('Error creating invoice_images table:', e6.message);
//                             else    console.log('✓ invoice_images table ready.');

//                             let completed = 0;
//                             migrations.forEach((sql) => {
//                                 connection.query(sql, (me) => {
//                                     if (me && me.errno !== 1060 && me.errno !== 1091) {
//                                         console.warn('Migration warning:', me.message);
//                                     }
//                                     completed++;
//                                     if (completed === migrations.length) {
//                                         console.log('✓ All migrations applied.');
//                                         connection.release();
//                                     }
//                                 });
//                             });
//                         });
//                     });
//                 });
//             });
//         });
//     });
// });

// // ─── HELPERS ────────────────────────────────────────────────────────────────
// function safeJson(val) {
//     if (val === null || val === undefined) return null;
//     if (typeof val === 'object') return val;
//     try { return JSON.parse(val); } catch { return null; }
// }

// function toJson(val) {
//     if (val === null || val === undefined) return null;
//     if (typeof val === 'string') return val;
//     return JSON.stringify(val);
// }

// function hydrateProduct(row) {
//     if (!row) return null;
//     return {
//         id:             row.id,
//         category:       row.category,
//         name:           row.name,
//         price:          Number(row.price),
//         stock:          row.stock,
//         description:    row.description,
//         image:          row.image,
//         images:         safeJson(row.images)          || [],
//         variants:       safeJson(row.variants)        || [],
//         variantPricing: safeJson(row.variant_pricing) || null,
//         childModels:    safeJson(row.child_models)    || null,
//         created_at:     row.created_at,
//         updated_at:     row.updated_at,
//     };
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // GEMINI AI CHAT API
// // ─────────────────────────────────────────────────────────────────────────────
// const chatSystemInstruction = `
// You are PSP Assistant, the official and exclusive AI customer support agent for PSP MARKET (also known as PSP Mart).
// PSP MARKET is a trusted and growing online retail marketplace proudly based in the Kingdom of Cambodia.

// ════════════════════════════════════════
//   YOUR IDENTITY & ROLE
// ════════════════════════════════════════
// - Full Name        : PSP Assistant
// - Store Name       : PSP MARKET (PSP Mart)
// - Country          : Kingdom of Cambodia
// - Website          : https://pspmartonline.netlify.app
// - Your Role        : Official AI Customer Support Agent & Shopping Guide
// - You represent    : PSP MARKET brand in every conversation
// - You are NOT      : a general AI, not ChatGPT, not Gemini — you are PSP Assistant only

// If anyone asks "Who are you?" or "What AI is this?", always reply:
//   "I am PSP Assistant, the official AI support agent for PSP MARKET. I am here to help you shop smarter! 😊"

// ════════════════════════════════════════
//   YOUR PERSONALITY & TONE
// ════════════════════════════════════════
// - Warm, friendly, and welcoming like a real store staff member
// - Professional but never robotic or cold
// - Patient and calm — even with frustrated or angry customers
// - Positive energy in every reply
// - Use light emojis occasionally to feel human (👋 😊 🛍️ ✅ 📦) but never overdo it
// - Keep answers SHORT and CLEAR — no walls of text
// - Break information into bullet points when listing multiple things
// - Never be dismissive, sarcastic, or impatient

// ════════════════════════════════════════
//   LANGUAGE RULES
// ════════════════════════════════════════
// - If the customer writes in KHMER (ភាសាខ្មែរ) → reply fully in Khmer
// - If the customer writes in ENGLISH → reply fully in English
// - If the customer MIXES both languages → match their dominant language
// - NEVER switch language mid-conversation unless the customer switches first
// - Always match the customer's energy — if they are casual, be casual; if formal, be formal
// - Khmer customers are very important — treat them with extra warmth and respect

// ════════════════════════════════════════
//   GREETING — START OF EVERY CONVERSATION
// ════════════════════════════════════════
// Always greet warmly when a conversation begins:

// English:
//   "Hello! 👋 Welcome to PSP MARKET — Cambodia's trusted online store!
//    I'm PSP Assistant, your personal shopping support. How can I help you today? 🛍️"

// Khmer:
//   "សួស្តី! 👋 សូមស្វាគមន៍មកកាន់ PSP MARKET — ហាងអនឡាញដែលអ្នកទុកចិត្តបានក្នុងប្រទេសកម្ពុជា!
//    ខ្ញុំជា PSP Assistant សូមរីករាយជួយអ្នក។ តើខ្ញុំអាចជួយអ្វីបានខ្លះថ្ងៃនេះ? 🛍️"

// ════════════════════════════════════════
//   WHAT YOU HELP WITH — FULL GUIDE
// ════════════════════════════════════════

// ──────────────────────────────────────
//   1. PRODUCTS & CATALOG
// ──────────────────────────────────────
// - Help customers search and find products by name, category, or use case
// - Explain product variants: sizes, colors, models, combos
// - Explain multi-image galleries and zoom features on product pages
// - If exact product details (price, stock) are unknown, say:
//     "For the most accurate and up-to-date product details, please visit our website or contact our support team."
// - Never guess or make up product names, prices, or stock numbers
// - Categories available may include: Electronics, Accessories, Clothing, and more

// ──────────────────────────────────────
//   2. HOW TO PLACE AN ORDER
// ──────────────────────────────────────
// Step-by-step guide when a customer asks how to order:
//   Step 1 → Browse products on https://pspmartonline.netlify.app
//   Step 2 → Select your product, choose variant/size/color if needed
//   Step 3 → Click "Add to Cart" or "Buy Now"
//   Step 4 → Go to your Cart and review your items
//   Step 5 → Fill in your delivery details (name, phone, address)
//   Step 6 → Choose your delivery carrier and see shipping fee
//   Step 7 → Scan the Bakong KHQR code to complete payment
//   Step 8 → Your order is confirmed! You will receive an order ID (e.g. INV-XXXXXX)

// ──────────────────────────────────────
//   3. ORDER STATUS & TRACKING
// ──────────────────────────────────────
// - Order status flow: Pending → Confirmed → Shipped → Delivered
// - To check order status, ask: "Could you please provide your Order ID (starts with INV-) or your registered email?"
// - Customers can log in to their account on our website to view all their orders
// - If an order seems stuck or incorrect, collect details and escalate to support

// ──────────────────────────────────────
//   4. PAYMENT — BAKONG KHQR
// ──────────────────────────────────────
// - PSP MARKET uses Bakong KHQR (National Bank of Cambodia payment system)
// - Payment is made by scanning the QR code shown at checkout
// - Payments are processed instantly and securely
// - If payment fails:
//     → Ask the customer to check their Bakong app balance
//     → Ask them to try scanning again
//     → If still failing: "Please contact our support team with your Order ID and we will assist you immediately."
// - We do NOT currently accept cash on delivery or credit card directly

// ──────────────────────────────────────
//   5. DELIVERY & SHIPPING
// ──────────────────────────────────────
// - PSP MARKET delivers across Cambodia via Standard Home Delivery
// - Shipping fee is calculated at checkout based on the carrier selected
// - Delivery time varies depending on the customer's location
// - For remote areas, delivery may take longer than urban areas
// - If a customer asks about delivery to a specific province, say:
//     "We deliver across Cambodia! Shipping fees and times vary by location. Please check at checkout for your exact shipping fee."

// ──────────────────────────────────────
//   6. ACCOUNT & REGISTRATION
// ──────────────────────────────────────
// - Customers register with: Full Name, Email, Password
// - After registration, role is set to: Customer (default)
// - Login uses: Email + Password
// - Common login issues:
//     → Wrong password: Ask them to re-enter carefully (case-sensitive)
//     → Email not found: They may not have registered yet
//     → Account locked/inactive: Escalate to admin support
// - Profile features: customers can update avatar, view order history, manage their account

// ──────────────────────────────────────
//   7. RETURNS, REFUNDS & COMPLAINTS
// ──────────────────────────────────────
// When a customer has a complaint, return request, or refund inquiry:
//   1. Stay calm and empathetic: "I'm sorry to hear that! Let me help you resolve this."
//   2. Collect these details:
//        - Full name
//        - Registered email
//        - Order ID (INV-XXXXXX)
//        - Description of the issue
//        - Photo of item if damaged (ask them to send via support email)
//   3. Then say: "Thank you for providing those details. Our support team will review your case and contact you as soon as possible."
// - Return/refund policies are handled by the PSP MARKET support team

// ──────────────────────────────────────
//   8. PROMOTIONS & DISCOUNTS
// ──────────────────────────────────────
// - If you are unaware of current promotions, say:
//     "Please visit our website or follow our official updates for the latest deals and promotions! 🎉"
// - Never make up or promise discounts you are not sure about

// ──────────────────────────────────────
//   9. ADMIN & DASHBOARD (for staff only)
// ──────────────────────────────────────
// - PSP MARKET has an admin dashboard for managing products, orders, users, analytics
// - If a customer accidentally asks admin-related questions, politely redirect:
//     "That section is for our internal team. Is there anything else I can help you with as a customer? 😊"

// ──────────────────────────────────────
//   10. TELEGRAM ORDER NOTIFICATIONS
// ──────────────────────────────────────
// - PSP MARKET uses a Telegram Bot to notify admins of new orders
// - This is an internal system — do not discuss technical details with customers
// - If a customer asks about order confirmation notifications, say:
//     "Our team is notified of every order and will process yours as quickly as possible! ✅"

// ════════════════════════════════════════
//   STRICT RULES — NEVER BREAK THESE
// ════════════════════════════════════════
// 1. NEVER make up product names, prices, stock levels, or order details
// 2. NEVER share any other customer's data, orders, or personal information
// 3. NEVER reveal internal system details (database, server, API keys, Telegram bot details)
// 4. NEVER pretend to be a human if sincerely asked — say: "I am PSP Assistant, an AI support agent for PSP MARKET."
// 5. NEVER go off-topic. If asked about unrelated topics (politics, other stores, general knowledge), say:
//      "I'm here specifically to help you with PSP MARKET. Is there anything about our store I can assist with? 😊"
// 6. NEVER be rude, sarcastic, or dismissive — even with difficult customers
// 7. NEVER promise refunds, discounts, or free shipping unless you are certain it is a store policy
// 8. If you truly cannot answer something, ALWAYS say:
//      "I'm not able to answer that right now. Please contact our support team or leave your email and we will get back to you as soon as possible."

// ════════════════════════════════════════
//   CLOSING — END OF CONVERSATION
// ════════════════════════════════════════
// Always close conversations warmly:

// English:
//   "Thank you for choosing PSP MARKET! 😊 We appreciate your support.
//    If you need anything else, don't hesitate to ask. Have a wonderful day! 🛍️"

// Khmer:
//   "អរគុណដែលបានជ្រើសរើស PSP MARKET! 😊 យើងខ្ញុំពេញចិត្តនឹងការគាំទ្ររបស់អ្នក។
//    បើមានអ្វីត្រូវការជំនួយទៀត សូមសួរបានគ្រប់ពេល។ សូមឱ្យមានថ្ងៃដ៏មានសុភមង្គល! 🛍️"

// ════════════════════════════════════════
//   FALLBACK — WHEN UNSURE
// ════════════════════════════════════════
// If you are ever unsure about any answer, always fall back to:
//   "For the most accurate information, please visit https://pspmartonline.netlify.app
//    or contact our support team directly. We are always happy to help! 😊"
// `;

// app.post('/api/chat', async (req, res) => {
//     try {
//         const { message, history } = req.body;

//         if (!message || !message.trim()) {
//             return res.status(400).json({ error: 'message is required.' });
//         }

//         // Build conversation history in Gemini format
//         const contents = [];

//         // Add previous messages if any
//         if (Array.isArray(history) && history.length > 0) {
//             history.forEach(({ role, text }) => {
//                 contents.push({
//                     role:  role === 'bot' ? 'model' : 'user',
//                     parts: [{ text }]
//                 });
//             });
//         }

//         // Add current user message
//         contents.push({
//             role:  'user',
//             parts: [{ text: message.trim() }]
//         });

//         const response = await ai.models.generateContent({
//             model:    'gemini-2.0-flash-lite',
//             contents: contents,
//             config: {
//                 systemInstruction: chatSystemInstruction
//             }
//         });

//         res.json({ reply: response.text });
//     } catch (error) {
//         console.error('[chat POST /api/chat]', error);
//         res.status(500).json({ error: 'The server is currently busy. Please wait a moment and try again.' });
//     }
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // PRODUCTS API
// // ─────────────────────────────────────────────────────────────────────────────
// app.get('/api/products', (req, res) => {
//     db.query('SELECT * FROM products ORDER BY created_at DESC', (err, rows) => {
//         if (err) return res.status(500).json({ error: err.message });
//         res.json(rows.map(hydrateProduct));
//     });
// });

// app.get('/api/products/:id', (req, res) => {
//     db.query('SELECT * FROM products WHERE id = ?', [req.params.id], (err, rows) => {
//         if (err)          return res.status(500).json({ error: err.message });
//         if (!rows.length) return res.status(404).json({ message: 'Product not found' });
//         res.json(hydrateProduct(rows[0]));
//     });
// });

// app.post('/api/products', (req, res) => {
//     const { id, category, name, price, stock, description, image, images, variants, variantPricing, childModels } = req.body;

//     if (!name || price === undefined) {
//         return res.status(400).json({ error: 'name and price are required.' });
//     }

//     const productId  = id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
//     const coverImage = image || (Array.isArray(images) && images[0]) || null;

//     const sql = `
//         INSERT INTO products (id, category, name, price, stock, description, image, images, variants, variant_pricing, child_models)
//         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
//     `;
//     const values = [
//         productId,
//         category  || 'Other',
//         name.trim(),
//         Number(price) || 0,
//         stock !== undefined && stock !== '' ? Number(stock) : null,
//         description || null,
//         coverImage,
//         toJson(images         || []),
//         toJson(variants       || []),
//         toJson(variantPricing || null),
//         toJson(childModels    || null),
//     ];

//     db.query(sql, values, (err) => {
//         if (err) return res.status(500).json({ error: err.message });
//         db.query('SELECT * FROM products WHERE id = ?', [productId], (err2, rows) => {
//             if (err2) return res.status(500).json({ error: err2.message });
//             res.status(201).json({ message: 'Product created successfully.', product: hydrateProduct(rows[0]) });
//         });
//     });
// });

// app.put('/api/products/:id', (req, res) => {
//     const { id } = req.params;
//     const { category, name, price, stock, description, image, images, variants, variantPricing, childModels } = req.body;
//     const coverImage = image || (Array.isArray(images) && images[0]) || null;

//     const sql = `
//         UPDATE products SET
//             category = ?, name = ?, price = ?, stock = ?, description = ?,
//             image = ?, images = ?, variants = ?, variant_pricing = ?, child_models = ?
//         WHERE id = ?
//     `;
//     const values = [
//         category || 'Other', (name || '').trim(), Number(price) || 0,
//         stock !== undefined && stock !== '' ? Number(stock) : null,
//         description || null, coverImage,
//         toJson(images || []), toJson(variants || []),
//         toJson(variantPricing || null), toJson(childModels || null), id,
//     ];

//     db.query(sql, values, (err, result) => {
//         if (err)                  return res.status(500).json({ error: err.message });
//         if (!result.affectedRows) return res.status(404).json({ message: 'Product not found.' });
//         db.query('SELECT * FROM products WHERE id = ?', [id], (err2, rows) => {
//             if (err2) return res.status(500).json({ error: err2.message });
//             res.json({ message: 'Product updated successfully.', product: hydrateProduct(rows[0]) });
//         });
//     });
// });

// app.patch('/api/products/:id', (req, res) => {
//     const { id } = req.params;
//     const allowed = ['category','name','price','stock','description','image','images','variants','variant_pricing','child_models'];
//     const dbMap   = { variantPricing: 'variant_pricing', childModels: 'child_models' };
//     const fields  = [];
//     const values  = [];

//     Object.entries(req.body).forEach(([key, val]) => {
//         const col = dbMap[key] || key;
//         if (!allowed.includes(col)) return;
//         const jsonCols = ['images','variants','variant_pricing','child_models'];
//         fields.push(`${col} = ?`);
//         values.push(jsonCols.includes(col) ? toJson(val) : val);
//     });

//     if (!fields.length) return res.status(400).json({ error: 'No valid fields to update.' });
//     values.push(id);

//     db.query(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`, values, (err, result) => {
//         if (err)                  return res.status(500).json({ error: err.message });
//         if (!result.affectedRows) return res.status(404).json({ message: 'Product not found.' });
//         db.query('SELECT * FROM products WHERE id = ?', [id], (err2, rows) => {
//             if (err2) return res.status(500).json({ error: err2.message });
//             res.json({ message: 'Product patched successfully.', product: hydrateProduct(rows[0]) });
//         });
//     });
// });

// app.delete('/api/products/:id', (req, res) => {
//     db.query('DELETE FROM products WHERE id = ?', [req.params.id], (err, result) => {
//         if (err)                  return res.status(500).json({ error: err.message });
//         if (!result.affectedRows) return res.status(404).json({ message: 'Product not found.' });
//         res.json({ message: 'Product deleted successfully.' });
//     });
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // USERS API
// // ─────────────────────────────────────────────────────────────────────────────
// app.post('/api/users/register', (req, res) => {
//     const { id, name, email, passwordHash, role, status } = req.body;

//     if (!name || !email || !passwordHash) {
//         return res.status(400).json({ error: 'name, email, and passwordHash are required.' });
//     }

//     const userId = id || ('USR-' + Date.now());
//     const sql = `INSERT INTO users (id, name, email, password_hash, role, status, avatar) VALUES (?, ?, ?, ?, ?, ?, NULL)`;

//     db.query(sql, [
//         userId,
//         name.trim(),
//         email.toLowerCase().trim(),
//         passwordHash,
//         role   || 'Customer',
//         status || 'Active',
//     ], (err) => {
//         if (err) {
//             if (err.code === 'ER_DUP_ENTRY') {
//                 return res.status(409).json({ error: 'This email is already registered.' });
//             }
//             return res.status(500).json({ error: err.message });
//         }
//         db.query('SELECT * FROM users WHERE id = ?', [userId], (e2, rows) => {
//             if (e2) return res.status(500).json({ error: e2.message });
//             const u = rows[0];
//             res.status(201).json({
//                 message: 'Registered successfully.',
//                 user: {
//                     id:     u.id,
//                     name:   u.name,
//                     email:  u.email,
//                     role:   u.role,
//                     status: u.status,
//                     avatar: u.avatar || null,
//                     date:   u.created_at ? u.created_at.toISOString().slice(0, 10) : null,
//                 },
//             });
//         });
//     });
// });

// app.post('/api/users/login', (req, res) => {
//     const { email, passwordHash } = req.body;

//     if (!email || !passwordHash) {
//         return res.status(400).json({ error: 'email and passwordHash are required.' });
//     }

//     db.query('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()], (err, rows) => {
//         if (err)          return res.status(500).json({ error: err.message });
//         if (!rows.length) return res.status(404).json({ error: 'No account found for this email.' });

//         const u = rows[0];
//         if (u.password_hash !== passwordHash) {
//             return res.status(401).json({ error: 'Incorrect password.' });
//         }

//         res.json({
//             user: {
//                 id:     u.id,
//                 name:   u.name,
//                 email:  u.email,
//                 role:   u.role,
//                 status: u.status,
//                 avatar: u.avatar || null,
//                 date:   u.created_at ? u.created_at.toISOString().slice(0, 10) : null,
//             },
//         });
//     });
// });

// app.post('/api/users/check-email', (req, res) => {
//     const { email } = req.body;
//     if (!email) return res.status(400).json({ error: 'email required.' });
//     db.query('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()], (err, rows) => {
//         if (err) return res.status(500).json({ error: err.message });
//         res.json({ exists: rows.length > 0 });
//     });
// });

// app.get('/api/users', (req, res) => {
//     db.query(
//         'SELECT id, name, email, role, status, created_at FROM users ORDER BY created_at DESC',
//         (err, rows) => {
//             if (err) return res.status(500).json({ error: err.message });
//             res.json(rows.map(u => ({
//                 id:     u.id,
//                 name:   u.name,
//                 email:  u.email,
//                 role:   u.role,
//                 status: u.status,
//                 date:   u.created_at ? u.created_at.toISOString().slice(0, 10) : null,
//             })));
//         }
//     );
// });

// app.patch('/api/users/:id', (req, res) => {
//     const allowed = ['name', 'role', 'status', 'avatar'];
//     const fields  = [];
//     const values  = [];

//     Object.entries(req.body).forEach(([k, v]) => {
//         if (allowed.includes(k)) { fields.push(`${k} = ?`); values.push(v); }
//     });

//     if (!fields.length) return res.status(400).json({ error: 'No valid fields to update.' });
//     values.push(req.params.id);

//     db.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values, (err, result) => {
//         if (err)                  return res.status(500).json({ error: err.message });
//         if (!result.affectedRows) return res.status(404).json({ message: 'User not found.' });
//         res.json({ message: 'User updated successfully.' });
//     });
// });

// app.delete('/api/users/:id', (req, res) => {
//     db.query('DELETE FROM users WHERE id = ?', [req.params.id], (err, result) => {
//         if (err)                  return res.status(500).json({ error: err.message });
//         if (!result.affectedRows) return res.status(404).json({ message: 'User not found.' });
//         res.json({ message: 'User deleted successfully.' });
//     });
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // KHQR API
// // ─────────────────────────────────────────────────────────────────────────────
// app.get('/api/khqr', (req, res) => {
//     db.query('SELECT image FROM khqr WHERE id = 1', (err, rows) => {
//         if (err) return res.status(500).json({ error: err.message });
//         res.json({ image: rows[0]?.image || null });
//     });
// });

// app.put('/api/khqr', (req, res) => {
//     const { image } = req.body;
//     if (!image) return res.status(400).json({ error: 'image is required.' });

//     const sql = `INSERT INTO khqr (id, image) VALUES (1, ?) ON DUPLICATE KEY UPDATE image = VALUES(image)`;
//     db.query(sql, [image], (err) => {
//         if (err) return res.status(500).json({ error: err.message });
//         res.json({ message: 'KHQR updated successfully.' });
//     });
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // ORDERS API
// // ─────────────────────────────────────────────────────────────────────────────
// function hydrateOrder(row) {
//     if (!row) return null;
//     return {
//         id:           row.id,
//         accountEmail: row.account_email,
//         customerName: row.customer_name,
//         phone:        row.phone,
//         address:      row.address,
//         mapLocation:  row.map_location,
//         carrier:      row.carrier,
//         shippingFee:  Number(row.shipping_fee || 0),
//         subtotal:     Number(row.subtotal || 0),
//         total:        Number(row.total || 0),
//         status:       row.status || 'paid',
//         date:         row.date_str || (row.created_at ? row.created_at.toISOString().slice(0, 16).replace('T', ' ') : new Date().toLocaleString()),
//         items:        safeJson(row.items) || [],
//         created_at:   row.created_at,
//         updated_at:   row.updated_at,
//     };
// }

// app.get('/api/orders', (req, res) => {
//     const { email } = req.query;
//     let sql = 'SELECT * FROM orders';
//     const values = [];

//     if (email) {
//         sql += ' WHERE account_email = ?';
//         values.push(email.toLowerCase().trim());
//     }
//     sql += ' ORDER BY created_at DESC';

//     db.query(sql, values, (err, rows) => {
//         if (err) return res.status(500).json({ error: err.message });
//         res.json(rows.map(hydrateOrder));
//     });
// });

// // app.post('/api/orders', (req, res) => {
// //     const { id, accountEmail, customerName, phone, address, mapLocation, carrier, shippingFee, subtotal, total, items, date } = req.body;

// //     if (!accountEmail || !customerName || !phone || !items) {
// //         return res.status(400).json({ error: 'Missing required fields' });
// //     }

// //     const orderId      = id || `INV-${Date.now().toString(36).toUpperCase()}`;
// //     const orderDateStr = date || new Date().toLocaleString('en-US', { timeZone: 'Asia/Phnom_Penh' });

// //     const sql = `
// //         INSERT INTO orders (id, account_email, customer_name, phone, address, map_location, carrier,
// //                             shipping_fee, subtotal, total, status, date_str, items)
// //         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', ?, ?)
// //         ON DUPLICATE KEY UPDATE
// //             status = VALUES(status), updated_at = CURRENT_TIMESTAMP
// //     `;

// //     const values = [
// //         orderId,
// //         accountEmail.toLowerCase().trim(),
// //         customerName.trim(),
// //         phone.trim(),
// //         address.trim(),
// //         mapLocation || null,
// //         carrier || 'Standard Home Delivery',
// //         Number(shippingFee) || 0,
// //         Number(subtotal)    || 0,
// //         Number(total)       || 0,
// //         orderDateStr,
// //         JSON.stringify(items || []),
// //     ];



// app.post('/api/orders', (req, res) => {
//     const {
//         id, accountEmail, customerName, phone, address,
//         mapLocation, carrier, shippingFee, subtotal, total, items, date, status
//     } = req.body;

//     // Safe string helpers — prevent .trim() crash on undefined
//     const safeStr  = (v) => (v != null ? String(v).trim() : '');
//     const safeLow  = (v) => safeStr(v).toLowerCase();

//     const cleanEmail = safeLow(accountEmail);
//     const cleanName  = safeStr(customerName);
//     const cleanPhone = safeStr(phone);
//     const cleanAddr  = safeStr(address);

//     if (!cleanEmail || !cleanName || !cleanPhone) {
//         return res.status(400).json({ error: 'Missing required fields: accountEmail, customerName, phone' });
//     }

//     // Safely serialize items — handle both array and already-stringified JSON
//     let itemsJson;
//     if (typeof items === 'string') {
//         try { JSON.parse(items); itemsJson = items; } catch { itemsJson = '[]'; }
//     } else {
//         itemsJson = JSON.stringify(Array.isArray(items) ? items : []);
//     }

//     const orderId      = id || `INV-${Date.now().toString(36).toUpperCase()}`;
//     const orderDateStr = date || new Date().toLocaleString('en-US', { timeZone: 'Asia/Phnom_Penh' });
//     const orderStatus  = status || 'paid';

//     const sql = `
//         INSERT INTO orders (id, account_email, customer_name, phone, address, map_location, carrier,
//                             shipping_fee, subtotal, total, status, date_str, items)
//         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
//         ON DUPLICATE KEY UPDATE
//             status = VALUES(status), updated_at = CURRENT_TIMESTAMP
//     `;

//     const values = [
//         orderId,
//         cleanEmail,
//         cleanName,
//         cleanPhone,
//         cleanAddr  || 'N/A',
//         mapLocation || null,
//         safeStr(carrier) || 'Standard Home Delivery',
//         Number(shippingFee) || 0,
//         Number(subtotal)    || 0,
//         Number(total)       || 0,
//         orderStatus,
//         orderDateStr,
//         itemsJson,
//     ];
//     db.query(sql, values, (err) => {
//         if (err) return res.status(500).json({ error: err.message });
//         db.query('SELECT * FROM orders WHERE id = ?', [orderId], (err2, rows) => {
//             if (err2) return res.status(500).json({ error: err2.message });
//             res.status(201).json({ message: 'Order saved', order: hydrateOrder(rows[0]) });
//         });
//     });
// });

// app.delete('/api/orders/:id', (req, res) => {
//     db.query('DELETE FROM orders WHERE id = ?', [req.params.id], (err, result) => {
//         if (err)                  return res.status(500).json({ error: err.message });
//         if (!result.affectedRows) return res.status(404).json({ message: 'Order record not found.' });
//         res.json({ message: 'Invoice historical record deleted successfully.' });
//     });
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // INVOICE IMAGES API
// // ─────────────────────────────────────────────────────────────────────────────

// // Upload invoice image for an order
// app.post('/api/invoice-images', (req, res) => {
//     const { orderId, accountEmail, image } = req.body;

//     if (!orderId || !accountEmail || !image) {
//         return res.status(400).json({ error: 'orderId, accountEmail, and image are required.' });
//     }

//     const id = 'IMG-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

//     const sql = `
//         INSERT INTO invoice_images (id, order_id, account_email, image)
//         VALUES (?, ?, ?, ?)
//     `;

//     db.query(sql, [id, orderId, accountEmail.toLowerCase().trim(), image], (err) => {
//         if (err) return res.status(500).json({ error: err.message });
//         res.status(201).json({ success: true, id, message: 'Invoice image saved.' });
//     });
// });

// // Get invoice images — by email (customer) or all (admin)
// app.get('/api/invoice-images', (req, res) => {
//     const { email } = req.query;
//     let sql = 'SELECT * FROM invoice_images';
//     const values = [];

//     if (email) {
//         sql += ' WHERE account_email = ?';
//         values.push(email.toLowerCase().trim());
//     }
//     sql += ' ORDER BY uploaded_at DESC';

//     db.query(sql, values, (err, rows) => {
//         if (err) return res.status(500).json({ error: err.message });
//         res.json(rows.map(r => ({
//             id:           r.id,
//             orderId:      r.order_id,
//             accountEmail: r.account_email,
//             image:        r.image,
//             uploadedAt:   r.uploaded_at,
//         })));
//     });
// });

// // Get invoice image by order ID
// app.get('/api/invoice-images/:orderId', (req, res) => {
//     db.query(
//         'SELECT * FROM invoice_images WHERE order_id = ?',
//         [req.params.orderId],
//         (err, rows) => {
//             if (err)          return res.status(500).json({ error: err.message });
//             if (!rows.length) return res.status(404).json({ message: 'No image found for this order.' });
//             const r = rows[0];
//             res.json({
//                 id:           r.id,
//                 orderId:      r.order_id,
//                 accountEmail: r.account_email,
//                 image:        r.image,
//                 uploadedAt:   r.uploaded_at,
//             });
//         }
//     );
// });

// // Admin: delete invoice image
// app.delete('/api/invoice-images/:id', (req, res) => {
//     db.query('DELETE FROM invoice_images WHERE id = ?', [req.params.id], (err, result) => {
//         if (err)                  return res.status(500).json({ error: err.message });
//         if (!result.affectedRows) return res.status(404).json({ message: 'Invoice image not found.' });
//         res.json({ success: true, message: 'Invoice image deleted.' });
//     });
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // COMMENTS API
// // ─────────────────────────────────────────────────────────────────────────────
// function hydrateComment(row) {
//     if (!row) return null;
//     return {
//         id:         row.id,
//         username:   row.username,
//         email:      row.email,
//         rating:     row.rating,
//         comment:    row.comment,
//         date:       row.date_str,
//         created_at: row.created_at,
//     };
// }

// app.get('/api/comments', (req, res) => {
//     db.query(
//         'SELECT id, username, email, comment, rating, date_str, created_at FROM comments ORDER BY created_at DESC',
//         (err, rows) => {
//             if (err) {
//                 console.error('[comments GET /]', err);
//                 return res.status(500).json({ error: 'Failed to fetch comments.' });
//             }
//             res.json(rows.map(hydrateComment));
//         }
//     );
// });

// app.post('/api/comments', (req, res) => {
//     const { id, username, email, comment, rating, date } = req.body;

//     if (!username || !email || !comment) {
//         return res.status(400).json({ error: 'username, email and comment are required.' });
//     }

//     const commentId  = id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
//     const safeRating = Math.min(5, Math.max(1, parseInt(rating, 10) || 5));
//     const dateStr    = date || new Date().toLocaleDateString('en-US');

//     db.query(
//         'INSERT INTO comments (id, username, email, comment, rating, date_str) VALUES (?, ?, ?, ?, ?, ?)',
//         [commentId, username.trim(), email.trim().toLowerCase(), comment.trim(), safeRating, dateStr],
//         (err) => {
//             if (err) {
//                 if (err.code === 'ER_DUP_ENTRY') {
//                     return res.status(200).json({ success: true, id: commentId });
//                 }
//                 console.error('[comments POST /]', err);
//                 return res.status(500).json({ error: 'Failed to save comment.' });
//             }
//             res.status(201).json({ success: true, id: commentId });
//         }
//     );
// });

// app.delete('/api/comments/:id', (req, res) => {
//     db.query('DELETE FROM comments WHERE id = ?', [req.params.id], (err, result) => {
//         if (err) {
//             console.error('[comments DELETE /:id]', err);
//             return res.status(500).json({ error: 'Failed to delete comment.' });
//         }
//         if (result.affectedRows === 0) {
//             return res.status(404).json({ message: 'Comment not found.' });
//         }
//         res.json({ success: true, message: 'Comment deleted successfully.' });
//     });
// });

// app.delete('/api/comments', (req, res) => {
//     db.query('DELETE FROM comments', (err) => {
//         if (err) {
//             console.error('[comments DELETE /]', err);
//             return res.status(500).json({ error: 'Failed to clear comments.' });
//         }
//         res.json({ success: true, message: 'All comments deleted.' });
//     });
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // DASHBOARD ANALYTICS API
// // Auto-calculated from existing tables — no extra storage needed
// // ─────────────────────────────────────────────────────────────────────────────

// // Full admin summary
// app.get('/api/analytics/summary', (req, res) => {
//     const results = {};

//     // 1. Revenue + order counts
//     db.query(
//         `SELECT COUNT(*) AS totalOrders, SUM(total) AS totalRevenue,
//                 SUM(subtotal) AS totalSubtotal, SUM(shipping_fee) AS totalShipping
//          FROM orders`,
//         (err, rows) => {
//             if (err) return res.status(500).json({ error: err.message });
//             results.totalOrders   = rows[0].totalOrders   || 0;
//             results.totalRevenue  = Number(rows[0].totalRevenue  || 0);
//             results.totalSubtotal = Number(rows[0].totalSubtotal || 0);
//             results.totalShipping = Number(rows[0].totalShipping || 0);

//             // 2. Orders by status
//             db.query(`SELECT status, COUNT(*) AS count FROM orders GROUP BY status`, (err2, rows2) => {
//                 if (err2) return res.status(500).json({ error: err2.message });
//                 results.ordersByStatus = {};
//                 rows2.forEach(r => { results.ordersByStatus[r.status] = r.count; });

//                 // 3. Products + stock
//                 db.query(`SELECT COUNT(*) AS totalProducts, SUM(stock) AS totalStock FROM products`, (err3, rows3) => {
//                     if (err3) return res.status(500).json({ error: err3.message });
//                     results.totalProducts = rows3[0].totalProducts || 0;
//                     results.totalStock    = Number(rows3[0].totalStock || 0);

//                     // 4. Users
//                     db.query(
//                         `SELECT COUNT(*) AS totalUsers,
//                                 SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) AS activeUsers
//                          FROM users`,
//                         (err4, rows4) => {
//                             if (err4) return res.status(500).json({ error: err4.message });
//                             results.totalUsers  = rows4[0].totalUsers  || 0;
//                             results.activeUsers = rows4[0].activeUsers || 0;

//                             // 5. Unique buying customers
//                             db.query(
//                                 `SELECT COUNT(DISTINCT account_email) AS buyingCustomers FROM orders`,
//                                 (err5, rows5) => {
//                                     if (err5) return res.status(500).json({ error: err5.message });
//                                     results.buyingCustomers = rows5[0].buyingCustomers || 0;

//                                     // 6. Total items sold
//                                     db.query(`SELECT items FROM orders`, (err6, rows6) => {
//                                         if (err6) return res.status(500).json({ error: err6.message });

//                                         let totalItemsSold = 0;
//                                         const productMap   = {};

//                                         rows6.forEach(row => {
//                                             try {
//                                                 const items = JSON.parse(row.items || '[]');
//                                                 items.forEach(item => {
//                                                     const qty = Number(item.quantity || item.qty || 1);
//                                                     totalItemsSold += qty;
//                                                     const key = item.name || item.productName || 'Unknown';
//                                                     productMap[key] = (productMap[key] || 0) + qty;
//                                                 });
//                                             } catch {}
//                                         });

//                                         results.totalItemsSold = totalItemsSold;
//                                         results.topProducts = Object.entries(productMap)
//                                             .sort((a, b) => b[1] - a[1])
//                                             .slice(0, 5)
//                                             .map(([name, qty]) => ({ name, qty }));

//                                         // 7. Recent 5 orders
//                                         db.query(
//                                             `SELECT id, account_email, customer_name, total, status, date_str
//                                              FROM orders ORDER BY created_at DESC LIMIT 5`,
//                                             (err7, rows7) => {
//                                                 if (err7) return res.status(500).json({ error: err7.message });
//                                                 results.recentOrders = rows7.map(r => ({
//                                                     id:           r.id,
//                                                     email:        r.account_email,
//                                                     customerName: r.customer_name,
//                                                     total:        Number(r.total),
//                                                     status:       r.status,
//                                                     date:         r.date_str,
//                                                 }));

//                                                 // 8. Revenue last 7 days
//                                                 db.query(
//                                                     `SELECT DATE(created_at) AS day,
//                                                             SUM(total) AS revenue, COUNT(*) AS orders
//                                                      FROM orders
//                                                      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
//                                                      GROUP BY DATE(created_at)
//                                                      ORDER BY day ASC`,
//                                                     (err8, rows8) => {
//                                                         if (err8) return res.status(500).json({ error: err8.message });
//                                                         results.revenueLastWeek = rows8.map(r => ({
//                                                             day:     r.day,
//                                                             revenue: Number(r.revenue),
//                                                             orders:  r.orders,
//                                                         }));

//                                                         res.json(results);
//                                                     }
//                                                 );
//                                             }
//                                         );
//                                     });
//                                 }
//                             );
//                         }
//                     );
//                 });
//             });
//         }
//     );
// });

// // Per-user analytics (customer dashboard)
// app.get('/api/analytics/user', (req, res) => {
//     const { email } = req.query;
//     if (!email) return res.status(400).json({ error: 'email is required.' });

//     const userEmail = email.toLowerCase().trim();

//     db.query(
//         `SELECT COUNT(*) AS totalOrders, SUM(total) AS totalSpent, SUM(subtotal) AS totalSubtotal
//          FROM orders WHERE account_email = ?`,
//         [userEmail],
//         (err, rows) => {
//             if (err) return res.status(500).json({ error: err.message });
//             const summary = {
//                 totalOrders:   rows[0].totalOrders   || 0,
//                 totalSpent:    Number(rows[0].totalSpent    || 0),
//                 totalSubtotal: Number(rows[0].totalSubtotal || 0),
//             };

//             db.query(`SELECT items FROM orders WHERE account_email = ?`, [userEmail], (err2, rows2) => {
//                 if (err2) return res.status(500).json({ error: err2.message });

//                 let totalItemsBought = 0;
//                 rows2.forEach(row => {
//                     try {
//                         const items = JSON.parse(row.items || '[]');
//                         items.forEach(item => {
//                             totalItemsBought += Number(item.quantity || item.qty || 1);
//                         });
//                     } catch {}
//                 });
//                 summary.totalItemsBought = totalItemsBought;

//                 db.query(
//                     `SELECT id, total, status, date_str FROM orders
//                      WHERE account_email = ? ORDER BY created_at DESC LIMIT 5`,
//                     [userEmail],
//                     (err3, rows3) => {
//                         if (err3) return res.status(500).json({ error: err3.message });
//                         summary.recentOrders = rows3.map(r => ({
//                             id:     r.id,
//                             total:  Number(r.total),
//                             status: r.status,
//                             date:   r.date_str,
//                         }));
//                         res.json(summary);
//                     }
//                 );
//             });
//         }
//     );
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // HEALTH CHECK
// // ─────────────────────────────────────────────────────────────────────────────
// app.get('/api/health', (req, res) => {
//     db.query('SELECT 1', (err) => {
//         if (err) return res.status(503).json({ status: 'db_error', error: err.message });
//         res.json({ status: 'ok' });
//     });
// });

// // ─── KEEP ALIVE (prevents Render free tier sleep) ───────────────────────────
// const RENDER_URL = 'https://backend-psp-market.onrender.com/api/health';

// setInterval(() => {
//     https.get(RENDER_URL, (res) => {
//         console.log(`✓ Keep-alive ping: ${res.statusCode}`);
//     }).on('error', (err) => {
//         console.warn('Keep-alive ping failed:', err.message);
//     });
// }, 10 * 60 * 1000); // ping every 10 minutes

// // ─── START SERVER ────────────────────────────────────────────────────────────
// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => console.log(`✓ Server running on port ${PORT}`));




















require('dotenv').config();

const express = require('express');
const mysql   = require('mysql2');
const cors    = require('cors');
const https   = require('https');

// ─── Gemini AI ─────────────────────────────────────────────────────────────
const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const app = express();

// ─── CORS ───────────────────────────────────────────────────────────────────
app.use(cors({
    origin: [
        'https://pspmartonline.netlify.app',
        'http://localhost:5173'
    ],
    methods: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH'],
    credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ─── DATABASE POOL (Aiven Cloud with SSL) ───────────────────────────────────
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

// ─── AUTO-CREATE + AUTO-MIGRATE TABLES ──────────────────────────────────────
db.getConnection((err, connection) => {
    if (err) {
        console.error('Database connection failed:', err.message);
        return;
    }
    console.log('✓ Connected to MySQL Database.');

    const createProducts = `
    CREATE TABLE IF NOT EXISTS products (
        id          VARCHAR(64)   PRIMARY KEY,
        category    VARCHAR(100)  NOT NULL DEFAULT 'Other',
        name        VARCHAR(255)  NOT NULL,
        price       DECIMAL(12,2) NOT NULL DEFAULT 0,
        description TEXT,
        image       LONGTEXT,
        created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
    )`;

    const createKhqr = `
    CREATE TABLE IF NOT EXISTS khqr (
        id         INT PRIMARY KEY DEFAULT 1,
        image      LONGTEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`;

    const createUsers = `
    CREATE TABLE IF NOT EXISTS users (
        id            VARCHAR(64)   PRIMARY KEY,
        name          VARCHAR(255)  NOT NULL,
        email         VARCHAR(255)  NOT NULL UNIQUE,
        password_hash VARCHAR(64)   NOT NULL,
        role          VARCHAR(50)   DEFAULT 'Customer',
        status        VARCHAR(50)   DEFAULT 'Active',
        avatar        LONGTEXT,
        created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
    )`;

    const createOrders = `
    CREATE TABLE IF NOT EXISTS orders (
        id            VARCHAR(64)   PRIMARY KEY,
        account_email VARCHAR(255)  NOT NULL,
        customer_name VARCHAR(255)  NOT NULL,
        phone         VARCHAR(50)   NOT NULL,
        address       TEXT          NOT NULL,
        map_location  TEXT,
        carrier       VARCHAR(100)  NOT NULL,
        shipping_fee  DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        subtotal      DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        total         DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        status        VARCHAR(50)   DEFAULT 'pending',
        date_str      VARCHAR(100)  DEFAULT NULL,
        items         LONGTEXT      NOT NULL,
        created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
        updated_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`;

    const createComments = `
    CREATE TABLE IF NOT EXISTS comments (
        id          VARCHAR(64)   PRIMARY KEY,
        username    VARCHAR(255)  NOT NULL,
        email       VARCHAR(255)  NOT NULL,
        rating      INT           NOT NULL DEFAULT 0,
        comment     TEXT          NOT NULL,
        date_str    VARCHAR(100)  DEFAULT NULL,
        created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
    )`;

    const createInvoiceImages = `
    CREATE TABLE IF NOT EXISTS invoice_images (
        id            VARCHAR(64)   PRIMARY KEY,
        order_id      VARCHAR(64)   NOT NULL,
        account_email VARCHAR(255)  NOT NULL,
        image         LONGTEXT      NOT NULL,
        uploaded_at   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
    )`;

    const migrations = [
        `ALTER TABLE products ADD COLUMN stock            INT       DEFAULT NULL`,
        `ALTER TABLE products ADD COLUMN images           LONGTEXT`,
        `ALTER TABLE products ADD COLUMN variants         LONGTEXT`,
        `ALTER TABLE products ADD COLUMN variant_pricing  LONGTEXT`,
        `ALTER TABLE products ADD COLUMN child_models     LONGTEXT`,
        `ALTER TABLE products ADD COLUMN updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
        `ALTER TABLE products MODIFY COLUMN id VARCHAR(64) NOT NULL`,
        `ALTER TABLE products MODIFY COLUMN price DECIMAL(12,2) NOT NULL DEFAULT 0`,
    ];

    connection.query(createProducts, (e1) => {
        if (e1) console.error('Error creating products table:', e1.message);
        else    console.log('✓ products table ready.');

        connection.query(createKhqr, (e2) => {
            if (e2) console.error('Error creating khqr table:', e2.message);
            else    console.log('✓ khqr table ready.');

            connection.query(createUsers, (e3) => {
                if (e3) console.error('Error creating users table:', e3.message);
                else    console.log('✓ users table ready.');

                connection.query(createOrders, (e4) => {
                    if (e4) console.error('Error creating orders table:', e4.message);
                    else    console.log('✓ orders table ready.');

                    connection.query(createComments, (e5) => {
                        if (e5) console.error('Error creating comments table:', e5.message);
                        else    console.log('✓ comments table ready.');

                        connection.query(createInvoiceImages, (e6) => {
                            if (e6) console.error('Error creating invoice_images table:', e6.message);
                            else    console.log('✓ invoice_images table ready.');

                            let completed = 0;
                            migrations.forEach((sql) => {
                                connection.query(sql, (me) => {
                                    if (me && me.errno !== 1060 && me.errno !== 1091) {
                                        console.warn('Migration warning:', me.message);
                                    }
                                    completed++;
                                    if (completed === migrations.length) {
                                        console.log('✓ All migrations applied.');
                                        connection.release();
                                    }
                                });
                            });
                        });
                    });
                });
            });
        });
    });
});

// ─── HELPERS ────────────────────────────────────────────────────────────────
function safeJson(val) {
    if (val === null || val === undefined) return null;
    if (typeof val === 'object' && !Buffer.isBuffer(val)) return val;
    if (typeof val !== 'string') return null;
    try { return JSON.parse(val); } catch { return null; }
}

function toJson(val) {
    if (val === null || val === undefined) return null;
    if (typeof val === 'string') return val;
    return JSON.stringify(val);
}

// Safely convert any date value (Date object, string, null) to a locale string
function safeDate(val, fallback) {
    if (!val) return fallback || '';
    try {
        const d = val instanceof Date ? val : new Date(val);
        if (isNaN(d.getTime())) return String(val);
        return d.toLocaleString('en-US', { timeZone: 'Asia/Phnom_Penh' });
    } catch {
        return String(val);
    }
}

function hydrateProduct(row) {
    if (!row) return null;
    return {
        id:             row.id,
        category:       row.category,
        name:           row.name,
        price:          Number(row.price),
        stock:          row.stock,
        description:    row.description,
        image:          row.image,
        images:         safeJson(row.images)          || [],
        variants:       safeJson(row.variants)        || [],
        variantPricing: safeJson(row.variant_pricing) || null,
        childModels:    safeJson(row.child_models)    || null,
        created_at:     row.created_at,
        updated_at:     row.updated_at,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// GEMINI AI CHAT API
// ─────────────────────────────────────────────────────────────────────────────
const chatSystemInstruction = `
You are PSP Assistant, the official and exclusive AI customer support agent for PSP MARKET (also known as PSP Mart).
PSP MARKET is a trusted and growing online retail marketplace proudly based in the Kingdom of Cambodia.

════════════════════════════════════════
  YOUR IDENTITY & ROLE
════════════════════════════════════════
- Full Name        : PSP Assistant
- Store Name       : PSP MARKET (PSP Mart)
- Country          : Kingdom of Cambodia
- Website          : https://pspmartonline.netlify.app
- Your Role        : Official AI Customer Support Agent & Shopping Guide
- You represent    : PSP MARKET brand in every conversation
- You are NOT      : a general AI, not ChatGPT, not Gemini — you are PSP Assistant only

If anyone asks "Who are you?" or "What AI is this?", always reply:
  "I am PSP Assistant, the official AI support agent for PSP MARKET. I am here to help you shop smarter! 😊"

════════════════════════════════════════
  YOUR PERSONALITY & TONE
════════════════════════════════════════
- Warm, friendly, and welcoming like a real store staff member
- Professional but never robotic or cold
- Patient and calm — even with frustrated or angry customers
- Positive energy in every reply
- Use light emojis occasionally to feel human (👋 😊 🛍️ ✅ 📦) but never overdo it
- Keep answers SHORT and CLEAR — no walls of text
- Break information into bullet points when listing multiple things
- Never be dismissive, sarcastic, or impatient

════════════════════════════════════════
  LANGUAGE RULES
════════════════════════════════════════
- If the customer writes in KHMER (ភាសាខ្មែរ) → reply fully in Khmer
- If the customer writes in ENGLISH → reply fully in English
- If the customer MIXES both languages → match their dominant language
- NEVER switch language mid-conversation unless the customer switches first
- Always match the customer's energy — if they are casual, be casual; if formal, be formal
- Khmer customers are very important — treat them with extra warmth and respect

════════════════════════════════════════
  GREETING — START OF EVERY CONVERSATION
════════════════════════════════════════
Always greet warmly when a conversation begins:

English:
  "Hello! 👋 Welcome to PSP MARKET — Cambodia's trusted online store!
   I'm PSP Assistant, your personal shopping support. How can I help you today? 🛍️"

Khmer:
  "សួស្តី! 👋 សូមស្វាគមន៍មកកាន់ PSP MARKET — ហាងអនឡាញដែលអ្នកទុកចិត្តបានក្នុងប្រទេសកម្ពុជា!
   ខ្ញុំជា PSP Assistant សូមរីករាយជួយអ្នក។ តើខ្ញុំអាចជួយអ្វីបានខ្លះថ្ងៃនេះ? 🛍️"

════════════════════════════════════════
  WHAT YOU HELP WITH — FULL GUIDE
════════════════════════════════════════

──────────────────────────────────────
  1. PRODUCTS & CATALOG
──────────────────────────────────────
- Help customers search and find products by name, category, or use case
- Explain product variants: sizes, colors, models, combos
- Explain multi-image galleries and zoom features on product pages
- If exact product details (price, stock) are unknown, say:
    "For the most accurate and up-to-date product details, please visit our website or contact our support team."
- Never guess or make up product names, prices, or stock numbers
- Categories available may include: Electronics, Accessories, Clothing, and more

──────────────────────────────────────
  2. HOW TO PLACE AN ORDER
──────────────────────────────────────
Step-by-step guide when a customer asks how to order:
  Step 1 → Browse products on https://pspmartonline.netlify.app
  Step 2 → Select your product, choose variant/size/color if needed
  Step 3 → Click "Add to Cart" or "Buy Now"
  Step 4 → Go to your Cart and review your items
  Step 5 → Fill in your delivery details (name, phone, address)
  Step 6 → Choose your delivery carrier and see shipping fee
  Step 7 → Scan the Bakong KHQR code to complete payment
  Step 8 → Your order is confirmed! You will receive an order ID (e.g. INV-XXXXXX)

──────────────────────────────────────
  3. ORDER STATUS & TRACKING
──────────────────────────────────────
- Order status flow: Pending → Confirmed → Shipped → Delivered
- To check order status, ask: "Could you please provide your Order ID (starts with INV-) or your registered email?"
- Customers can log in to their account on our website to view all their orders
- If an order seems stuck or incorrect, collect details and escalate to support

──────────────────────────────────────
  4. PAYMENT — BAKONG KHQR
──────────────────────────────────────
- PSP MARKET uses Bakong KHQR (National Bank of Cambodia payment system)
- Payment is made by scanning the QR code shown at checkout
- Payments are processed instantly and securely
- If payment fails:
    → Ask the customer to check their Bakong app balance
    → Ask them to try scanning again
    → If still failing: "Please contact our support team with your Order ID and we will assist you immediately."
- We do NOT currently accept cash on delivery or credit card directly

──────────────────────────────────────
  5. DELIVERY & SHIPPING
──────────────────────────────────────
- PSP MARKET delivers across Cambodia via Standard Home Delivery
- Shipping fee is calculated at checkout based on the carrier selected
- Delivery time varies depending on the customer's location
- For remote areas, delivery may take longer than urban areas
- If a customer asks about delivery to a specific province, say:
    "We deliver across Cambodia! Shipping fees and times vary by location. Please check at checkout for your exact shipping fee."

──────────────────────────────────────
  6. ACCOUNT & REGISTRATION
──────────────────────────────────────
- Customers register with: Full Name, Email, Password
- After registration, role is set to: Customer (default)
- Login uses: Email + Password
- Common login issues:
    → Wrong password: Ask them to re-enter carefully (case-sensitive)
    → Email not found: They may not have registered yet
    → Account locked/inactive: Escalate to admin support
- Profile features: customers can update avatar, view order history, manage their account

──────────────────────────────────────
  7. RETURNS, REFUNDS & COMPLAINTS
──────────────────────────────────────
When a customer has a complaint, return request, or refund inquiry:
  1. Stay calm and empathetic: "I'm sorry to hear that! Let me help you resolve this."
  2. Collect these details:
       - Full name
       - Registered email
       - Order ID (INV-XXXXXX)
       - Description of the issue
       - Photo of item if damaged (ask them to send via support email)
  3. Then say: "Thank you for providing those details. Our support team will review your case and contact you as soon as possible."
- Return/refund policies are handled by the PSP MARKET support team

──────────────────────────────────────
  8. PROMOTIONS & DISCOUNTS
──────────────────────────────────────
- If you are unaware of current promotions, say:
    "Please visit our website or follow our official updates for the latest deals and promotions! 🎉"
- Never make up or promise discounts you are not sure about

──────────────────────────────────────
  9. ADMIN & DASHBOARD (for staff only)
──────────────────────────────────────
- PSP MARKET has an admin dashboard for managing products, orders, users, analytics
- If a customer accidentally asks admin-related questions, politely redirect:
    "That section is for our internal team. Is there anything else I can help you with as a customer? 😊"

──────────────────────────────────────
  10. TELEGRAM ORDER NOTIFICATIONS
──────────────────────────────────────
- PSP MARKET uses a Telegram Bot to notify admins of new orders
- This is an internal system — do not discuss technical details with customers
- If a customer asks about order confirmation notifications, say:
    "Our team is notified of every order and will process yours as quickly as possible! ✅"

════════════════════════════════════════
  STRICT RULES — NEVER BREAK THESE
════════════════════════════════════════
1. NEVER make up product names, prices, stock levels, or order details
2. NEVER share any other customer's data, orders, or personal information
3. NEVER reveal internal system details (database, server, API keys, Telegram bot details)
4. NEVER pretend to be a human if sincerely asked — say: "I am PSP Assistant, an AI support agent for PSP MARKET."
5. NEVER go off-topic. If asked about unrelated topics (politics, other stores, general knowledge), say:
     "I'm here specifically to help you with PSP MARKET. Is there anything about our store I can assist with? 😊"
6. NEVER be rude, sarcastic, or dismissive — even with difficult customers
7. NEVER promise refunds, discounts, or free shipping unless you are certain it is a store policy
8. If you truly cannot answer something, ALWAYS say:
     "I'm not able to answer that right now. Please contact our support team or leave your email and we will get back to you as soon as possible."

════════════════════════════════════════
  CLOSING — END OF CONVERSATION
════════════════════════════════════════
Always close conversations warmly:

English:
  "Thank you for choosing PSP MARKET! 😊 We appreciate your support.
   If you need anything else, don't hesitate to ask. Have a wonderful day! 🛍️"

Khmer:
  "អរគុណដែលបានជ្រើសរើស PSP MARKET! 😊 យើងខ្ញុំពេញចិត្តនឹងការគាំទ្ររបស់អ្នក។
   បើមានអ្វីត្រូវការជំនួយទៀត សូមសួរបានគ្រប់ពេល។ សូមឱ្យមានថ្ងៃដ៏មានសុភមង្គល! 🛍️"

════════════════════════════════════════
  FALLBACK — WHEN UNSURE
════════════════════════════════════════
If you are ever unsure about any answer, always fall back to:
  "For the most accurate information, please visit https://pspmartonline.netlify.app
   or contact our support team directly. We are always happy to help! 😊"
`;

app.post('/api/chat', async (req, res) => {
    try {
        const { message, history } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({ error: 'message is required.' });
        }

        const contents = [];

        if (Array.isArray(history) && history.length > 0) {
            history.forEach(({ role, text }) => {
                contents.push({
                    role:  role === 'bot' ? 'model' : 'user',
                    parts: [{ text }]
                });
            });
        }

        contents.push({
            role:  'user',
            parts: [{ text: message.trim() }]
        });

        const response = await ai.models.generateContent({
            model:    'gemini-2.0-flash-lite',
            contents: contents,
            config: {
                systemInstruction: chatSystemInstruction
            }
        });

        res.json({ reply: response.text });
    } catch (error) {
        console.error('[chat POST /api/chat]', error);
        res.status(500).json({ error: 'The server is currently busy. Please wait a moment and try again.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCTS API
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/products', (req, res) => {
    db.query('SELECT * FROM products ORDER BY created_at DESC', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows.map(hydrateProduct));
    });
});

app.get('/api/products/:id', (req, res) => {
    db.query('SELECT * FROM products WHERE id = ?', [req.params.id], (err, rows) => {
        if (err)          return res.status(500).json({ error: err.message });
        if (!rows.length) return res.status(404).json({ message: 'Product not found' });
        res.json(hydrateProduct(rows[0]));
    });
});

app.post('/api/products', (req, res) => {
    const { id, category, name, price, stock, description, image, images, variants, variantPricing, childModels } = req.body;

    if (!name || price === undefined) {
        return res.status(400).json({ error: 'name and price are required.' });
    }

    const productId  = id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
    const coverImage = image || (Array.isArray(images) && images[0]) || null;

    const sql = `
        INSERT INTO products (id, category, name, price, stock, description, image, images, variants, variant_pricing, child_models)
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
        toJson(images         || []),
        toJson(variants       || []),
        toJson(variantPricing || null),
        toJson(childModels    || null),
    ];

    db.query(sql, values, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        db.query('SELECT * FROM products WHERE id = ?', [productId], (err2, rows) => {
            if (err2) return res.status(500).json({ error: err2.message });
            res.status(201).json({ message: 'Product created successfully.', product: hydrateProduct(rows[0]) });
        });
    });
});

app.put('/api/products/:id', (req, res) => {
    const { id } = req.params;
    const { category, name, price, stock, description, image, images, variants, variantPricing, childModels } = req.body;
    const coverImage = image || (Array.isArray(images) && images[0]) || null;

    const sql = `
        UPDATE products SET
            category = ?, name = ?, price = ?, stock = ?, description = ?,
            image = ?, images = ?, variants = ?, variant_pricing = ?, child_models = ?
        WHERE id = ?
    `;
    const values = [
        category || 'Other', (name || '').trim(), Number(price) || 0,
        stock !== undefined && stock !== '' ? Number(stock) : null,
        description || null, coverImage,
        toJson(images || []), toJson(variants || []),
        toJson(variantPricing || null), toJson(childModels || null), id,
    ];

    db.query(sql, values, (err, result) => {
        if (err)                  return res.status(500).json({ error: err.message });
        if (!result.affectedRows) return res.status(404).json({ message: 'Product not found.' });
        db.query('SELECT * FROM products WHERE id = ?', [id], (err2, rows) => {
            if (err2) return res.status(500).json({ error: err2.message });
            res.json({ message: 'Product updated successfully.', product: hydrateProduct(rows[0]) });
        });
    });
});

app.patch('/api/products/:id', (req, res) => {
    const { id } = req.params;
    const allowed = ['category','name','price','stock','description','image','images','variants','variant_pricing','child_models'];
    const dbMap   = { variantPricing: 'variant_pricing', childModels: 'child_models' };
    const fields  = [];
    const values  = [];

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

app.delete('/api/products/:id', (req, res) => {
    db.query('DELETE FROM products WHERE id = ?', [req.params.id], (err, result) => {
        if (err)                  return res.status(500).json({ error: err.message });
        if (!result.affectedRows) return res.status(404).json({ message: 'Product not found.' });
        res.json({ message: 'Product deleted successfully.' });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// USERS API
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/users/register', (req, res) => {
    const { id, name, email, passwordHash, role, status } = req.body;

    if (!name || !email || !passwordHash) {
        return res.status(400).json({ error: 'name, email, and passwordHash are required.' });
    }

    const userId = id || ('USR-' + Date.now());
    const sql = `INSERT INTO users (id, name, email, password_hash, role, status, avatar) VALUES (?, ?, ?, ?, ?, ?, NULL)`;

    db.query(sql, [
        userId,
        name.trim(),
        email.toLowerCase().trim(),
        passwordHash,
        role   || 'Customer',
        status || 'Active',
    ], (err) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ error: 'This email is already registered.' });
            }
            return res.status(500).json({ error: err.message });
        }
        db.query('SELECT * FROM users WHERE id = ?', [userId], (e2, rows) => {
            if (e2) return res.status(500).json({ error: e2.message });
            const u = rows[0];
            res.status(201).json({
                message: 'Registered successfully.',
                user: {
                    id:     u.id,
                    name:   u.name,
                    email:  u.email,
                    role:   u.role,
                    status: u.status,
                    avatar: u.avatar || null,
                    date:   u.created_at ? safeDate(u.created_at).slice(0, 10) : null,
                },
            });
        });
    });
});

app.post('/api/users/login', (req, res) => {
    const { email, passwordHash } = req.body;

    if (!email || !passwordHash) {
        return res.status(400).json({ error: 'email and passwordHash are required.' });
    }

    db.query('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()], (err, rows) => {
        if (err)          return res.status(500).json({ error: err.message });
        if (!rows.length) return res.status(404).json({ error: 'No account found for this email.' });

        const u = rows[0];
        if (u.password_hash !== passwordHash) {
            return res.status(401).json({ error: 'Incorrect password.' });
        }

        res.json({
            user: {
                id:     u.id,
                name:   u.name,
                email:  u.email,
                role:   u.role,
                status: u.status,
                avatar: u.avatar || null,
                date:   u.created_at ? safeDate(u.created_at).slice(0, 10) : null,
            },
        });
    });
});

app.post('/api/users/check-email', (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email required.' });
    db.query('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ exists: rows.length > 0 });
    });
});

app.get('/api/users', (req, res) => {
    db.query(
        'SELECT id, name, email, role, status, created_at FROM users ORDER BY created_at DESC',
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows.map(u => ({
                id:     u.id,
                name:   u.name,
                email:  u.email,
                role:   u.role,
                status: u.status,
                date:   u.created_at ? safeDate(u.created_at).slice(0, 10) : null,
            })));
        }
    );
});

app.patch('/api/users/:id', (req, res) => {
    const allowed = ['name', 'role', 'status', 'avatar'];
    const fields  = [];
    const values  = [];

    Object.entries(req.body).forEach(([k, v]) => {
        if (allowed.includes(k)) { fields.push(`${k} = ?`); values.push(v); }
    });

    if (!fields.length) return res.status(400).json({ error: 'No valid fields to update.' });
    values.push(req.params.id);

    db.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values, (err, result) => {
        if (err)                  return res.status(500).json({ error: err.message });
        if (!result.affectedRows) return res.status(404).json({ message: 'User not found.' });
        res.json({ message: 'User updated successfully.' });
    });
});

app.delete('/api/users/:id', (req, res) => {
    db.query('DELETE FROM users WHERE id = ?', [req.params.id], (err, result) => {
        if (err)                  return res.status(500).json({ error: err.message });
        if (!result.affectedRows) return res.status(404).json({ message: 'User not found.' });
        res.json({ message: 'User deleted successfully.' });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// KHQR API
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/khqr', (req, res) => {
    db.query('SELECT image FROM khqr WHERE id = 1', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ image: rows[0]?.image || null });
    });
});

app.put('/api/khqr', (req, res) => {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: 'image is required.' });

    const sql = `INSERT INTO khqr (id, image) VALUES (1, ?) ON DUPLICATE KEY UPDATE image = VALUES(image)`;
    db.query(sql, [image], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'KHQR updated successfully.' });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// ORDERS API
// ─────────────────────────────────────────────────────────────────────────────

// ✅ FIXED hydrateOrder — crash-proof items parsing + safe date handling
function hydrateOrder(row) {
    if (!row) return null;

    // Safe items parse — handles null, bad JSON, already-parsed array
    let items = [];
    try {
        if (Array.isArray(row.items)) {
            items = row.items;
        } else if (typeof row.items === 'string' && row.items.trim()) {
            const parsed = JSON.parse(row.items);
            items = Array.isArray(parsed) ? parsed : [];
        }
    } catch (e) {
        console.warn('[hydrateOrder] Bad items JSON for order', row.id, '-', e.message);
        items = [];
    }

    // Safe date — row.created_at from Aiven can be a Date object or string
    let dateStr = row.date_str || '';
    if (!dateStr) {
        dateStr = safeDate(row.created_at);
    }

    return {
        id:           row.id           || '',
        accountEmail: row.account_email || '',
        customerName: row.customer_name || '',
        phone:        row.phone         || '',
        address:      row.address       || '',
        mapLocation:  row.map_location  || null,
        carrier:      row.carrier       || 'Standard Home Delivery',
        shippingFee:  Number(row.shipping_fee || 0),
        subtotal:     Number(row.subtotal     || 0),
        total:        Number(row.total        || 0),
        status:       row.status        || 'paid',
        date:         dateStr,
        items,
        created_at:   row.created_at,
        updated_at:   row.updated_at,
    };
}

// ✅ FIXED GET /api/orders — wrapped in try/catch so one bad row can't crash all orders
app.get('/api/orders', (req, res) => {
    const { email } = req.query;
    let sql = 'SELECT * FROM orders';
    const values = [];

    if (email && email.trim()) {
        sql += ' WHERE account_email = ?';
        values.push(email.toLowerCase().trim());
    }
    sql += ' ORDER BY created_at DESC';

    db.query(sql, values, (err, rows) => {
        if (err) {
            console.error('[GET /api/orders] DB error:', err.message, '| email:', email);
            return res.status(500).json({ error: err.message });
        }
        try {
            res.json(rows.map(hydrateOrder));
        } catch (hydrateErr) {
            console.error('[GET /api/orders] hydrateOrder failed:', hydrateErr.message);
            // Fallback: return rows that can be hydrated, skip bad ones
            const safe = rows.reduce((acc, row) => {
                try { acc.push(hydrateOrder(row)); } catch {}
                return acc;
            }, []);
            res.json(safe);
        }
    });
});

// ✅ FIXED POST /api/orders — safe string helpers prevent .trim() crash on undefined
app.post('/api/orders', (req, res) => {
    const {
        id, accountEmail, customerName, phone, address,
        mapLocation, carrier, shippingFee, subtotal, total, items, date, status
    } = req.body;

    // Safe string helpers — prevent .trim() crash on undefined/null
    const safeStr = (v) => (v != null ? String(v).trim() : '');
    const safeLow = (v) => safeStr(v).toLowerCase();

    const cleanEmail = safeLow(accountEmail);
    const cleanName  = safeStr(customerName);
    const cleanPhone = safeStr(phone);
    const cleanAddr  = safeStr(address);

    if (!cleanEmail || !cleanName || !cleanPhone) {
        return res.status(400).json({ error: 'Missing required fields: accountEmail, customerName, phone' });
    }

    // Safely serialize items — handle array or already-stringified JSON
    let itemsJson;
    if (typeof items === 'string') {
        try { JSON.parse(items); itemsJson = items; } catch { itemsJson = '[]'; }
    } else {
        itemsJson = JSON.stringify(Array.isArray(items) ? items : []);
    }

    const orderId      = id || `INV-${Date.now().toString(36).toUpperCase()}`;
    const orderDateStr = date || new Date().toLocaleString('en-US', { timeZone: 'Asia/Phnom_Penh' });
    const orderStatus  = status || 'paid';

    const sql = `
        INSERT INTO orders (id, account_email, customer_name, phone, address, map_location, carrier,
                            shipping_fee, subtotal, total, status, date_str, items)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            status = VALUES(status), updated_at = CURRENT_TIMESTAMP
    `;

    const values = [
        orderId,
        cleanEmail,
        cleanName,
        cleanPhone,
        cleanAddr || 'N/A',
        mapLocation || null,
        safeStr(carrier) || 'Standard Home Delivery',
        Number(shippingFee) || 0,
        Number(subtotal)    || 0,
        Number(total)       || 0,
        orderStatus,
        orderDateStr,
        itemsJson,
    ];

    db.query(sql, values, (err) => {
        if (err) {
            console.error('[POST /api/orders] DB error:', err.message);
            return res.status(500).json({ error: err.message });
        }
        db.query('SELECT * FROM orders WHERE id = ?', [orderId], (err2, rows) => {
            if (err2) return res.status(500).json({ error: err2.message });
            res.status(201).json({ message: 'Order saved', order: hydrateOrder(rows[0]) });
        });
    });
});

app.delete('/api/orders/:id', (req, res) => {
    db.query('DELETE FROM orders WHERE id = ?', [req.params.id], (err, result) => {
        if (err)                  return res.status(500).json({ error: err.message });
        if (!result.affectedRows) return res.status(404).json({ message: 'Order record not found.' });
        res.json({ message: 'Invoice historical record deleted successfully.' });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// INVOICE IMAGES API
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/invoice-images', (req, res) => {
    const { orderId, accountEmail, image } = req.body;

    if (!orderId || !accountEmail || !image) {
        return res.status(400).json({ error: 'orderId, accountEmail, and image are required.' });
    }

    const id = 'IMG-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

    db.query(
        'INSERT INTO invoice_images (id, order_id, account_email, image) VALUES (?, ?, ?, ?)',
        [id, orderId, accountEmail.toLowerCase().trim(), image],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ success: true, id, message: 'Invoice image saved.' });
        }
    );
});

app.get('/api/invoice-images', (req, res) => {
    const { email } = req.query;
    let sql = 'SELECT * FROM invoice_images';
    const values = [];

    if (email) {
        sql += ' WHERE account_email = ?';
        values.push(email.toLowerCase().trim());
    }
    sql += ' ORDER BY uploaded_at DESC';

    db.query(sql, values, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows.map(r => ({
            id:           r.id,
            orderId:      r.order_id,
            accountEmail: r.account_email,
            image:        r.image,
            uploadedAt:   r.uploaded_at,
        })));
    });
});

app.get('/api/invoice-images/:orderId', (req, res) => {
    db.query(
        'SELECT * FROM invoice_images WHERE order_id = ?',
        [req.params.orderId],
        (err, rows) => {
            if (err)          return res.status(500).json({ error: err.message });
            if (!rows.length) return res.status(404).json({ message: 'No image found for this order.' });
            const r = rows[0];
            res.json({
                id:           r.id,
                orderId:      r.order_id,
                accountEmail: r.account_email,
                image:        r.image,
                uploadedAt:   r.uploaded_at,
            });
        }
    );
});

app.delete('/api/invoice-images/:id', (req, res) => {
    db.query('DELETE FROM invoice_images WHERE id = ?', [req.params.id], (err, result) => {
        if (err)                  return res.status(500).json({ error: err.message });
        if (!result.affectedRows) return res.status(404).json({ message: 'Invoice image not found.' });
        res.json({ success: true, message: 'Invoice image deleted.' });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// COMMENTS API
// ─────────────────────────────────────────────────────────────────────────────
function hydrateComment(row) {
    if (!row) return null;
    return {
        id:         row.id,
        username:   row.username,
        email:      row.email,
        rating:     row.rating,
        comment:    row.comment,
        date:       row.date_str,
        created_at: row.created_at,
    };
}

app.get('/api/comments', (req, res) => {
    db.query(
        'SELECT id, username, email, comment, rating, date_str, created_at FROM comments ORDER BY created_at DESC',
        (err, rows) => {
            if (err) {
                console.error('[comments GET /]', err);
                return res.status(500).json({ error: 'Failed to fetch comments.' });
            }
            res.json(rows.map(hydrateComment));
        }
    );
});

app.post('/api/comments', (req, res) => {
    const { id, username, email, comment, rating, date } = req.body;

    if (!username || !email || !comment) {
        return res.status(400).json({ error: 'username, email and comment are required.' });
    }

    const commentId  = id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
    const safeRating = Math.min(5, Math.max(1, parseInt(rating, 10) || 5));
    const dateStr    = date || new Date().toLocaleDateString('en-US');

    db.query(
        'INSERT INTO comments (id, username, email, comment, rating, date_str) VALUES (?, ?, ?, ?, ?, ?)',
        [commentId, username.trim(), email.trim().toLowerCase(), comment.trim(), safeRating, dateStr],
        (err) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(200).json({ success: true, id: commentId });
                }
                console.error('[comments POST /]', err);
                return res.status(500).json({ error: 'Failed to save comment.' });
            }
            res.status(201).json({ success: true, id: commentId });
        }
    );
});

app.delete('/api/comments/:id', (req, res) => {
    db.query('DELETE FROM comments WHERE id = ?', [req.params.id], (err, result) => {
        if (err) {
            console.error('[comments DELETE /:id]', err);
            return res.status(500).json({ error: 'Failed to delete comment.' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Comment not found.' });
        }
        res.json({ success: true, message: 'Comment deleted successfully.' });
    });
});

app.delete('/api/comments', (req, res) => {
    db.query('DELETE FROM comments', (err) => {
        if (err) {
            console.error('[comments DELETE /]', err);
            return res.status(500).json({ error: 'Failed to clear comments.' });
        }
        res.json({ success: true, message: 'All comments deleted.' });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD ANALYTICS API
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/analytics/summary', (req, res) => {
    const results = {};

    db.query(
        `SELECT COUNT(*) AS totalOrders, SUM(total) AS totalRevenue,
                SUM(subtotal) AS totalSubtotal, SUM(shipping_fee) AS totalShipping
         FROM orders`,
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            results.totalOrders   = rows[0].totalOrders   || 0;
            results.totalRevenue  = Number(rows[0].totalRevenue  || 0);
            results.totalSubtotal = Number(rows[0].totalSubtotal || 0);
            results.totalShipping = Number(rows[0].totalShipping || 0);

            db.query(`SELECT status, COUNT(*) AS count FROM orders GROUP BY status`, (err2, rows2) => {
                if (err2) return res.status(500).json({ error: err2.message });
                results.ordersByStatus = {};
                rows2.forEach(r => { results.ordersByStatus[r.status] = r.count; });

                db.query(`SELECT COUNT(*) AS totalProducts, SUM(stock) AS totalStock FROM products`, (err3, rows3) => {
                    if (err3) return res.status(500).json({ error: err3.message });
                    results.totalProducts = rows3[0].totalProducts || 0;
                    results.totalStock    = Number(rows3[0].totalStock || 0);

                    db.query(
                        `SELECT COUNT(*) AS totalUsers,
                                SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) AS activeUsers
                         FROM users`,
                        (err4, rows4) => {
                            if (err4) return res.status(500).json({ error: err4.message });
                            results.totalUsers  = rows4[0].totalUsers  || 0;
                            results.activeUsers = rows4[0].activeUsers || 0;

                            db.query(
                                `SELECT COUNT(DISTINCT account_email) AS buyingCustomers FROM orders`,
                                (err5, rows5) => {
                                    if (err5) return res.status(500).json({ error: err5.message });
                                    results.buyingCustomers = rows5[0].buyingCustomers || 0;

                                    db.query(`SELECT items FROM orders`, (err6, rows6) => {
                                        if (err6) return res.status(500).json({ error: err6.message });

                                        let totalItemsSold = 0;
                                        const productMap   = {};

                                        rows6.forEach(row => {
                                            try {
                                                const items = typeof row.items === 'string'
                                                    ? JSON.parse(row.items || '[]')
                                                    : (Array.isArray(row.items) ? row.items : []);
                                                items.forEach(item => {
                                                    const qty = Number(item.quantity || item.qty || 1);
                                                    totalItemsSold += qty;
                                                    const key = item.name || item.productName || 'Unknown';
                                                    productMap[key] = (productMap[key] || 0) + qty;
                                                });
                                            } catch {}
                                        });

                                        results.totalItemsSold = totalItemsSold;
                                        results.topProducts = Object.entries(productMap)
                                            .sort((a, b) => b[1] - a[1])
                                            .slice(0, 5)
                                            .map(([name, qty]) => ({ name, qty }));

                                        db.query(
                                            `SELECT id, account_email, customer_name, total, status, date_str
                                             FROM orders ORDER BY created_at DESC LIMIT 5`,
                                            (err7, rows7) => {
                                                if (err7) return res.status(500).json({ error: err7.message });
                                                results.recentOrders = rows7.map(r => ({
                                                    id:           r.id,
                                                    email:        r.account_email,
                                                    customerName: r.customer_name,
                                                    total:        Number(r.total),
                                                    status:       r.status,
                                                    date:         r.date_str,
                                                }));

                                                db.query(
                                                    `SELECT DATE(created_at) AS day,
                                                            SUM(total) AS revenue, COUNT(*) AS orders
                                                     FROM orders
                                                     WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                                                     GROUP BY DATE(created_at)
                                                     ORDER BY day ASC`,
                                                    (err8, rows8) => {
                                                        if (err8) return res.status(500).json({ error: err8.message });
                                                        results.revenueLastWeek = rows8.map(r => ({
                                                            day:     r.day,
                                                            revenue: Number(r.revenue),
                                                            orders:  r.orders,
                                                        }));
                                                        res.json(results);
                                                    }
                                                );
                                            }
                                        );
                                    });
                                }
                            );
                        }
                    );
                });
            });
        }
    );
});

app.get('/api/analytics/user', (req, res) => {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'email is required.' });

    const userEmail = email.toLowerCase().trim();

    db.query(
        `SELECT COUNT(*) AS totalOrders, SUM(total) AS totalSpent, SUM(subtotal) AS totalSubtotal
         FROM orders WHERE account_email = ?`,
        [userEmail],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            const summary = {
                totalOrders:   rows[0].totalOrders   || 0,
                totalSpent:    Number(rows[0].totalSpent    || 0),
                totalSubtotal: Number(rows[0].totalSubtotal || 0),
            };

            db.query(`SELECT items FROM orders WHERE account_email = ?`, [userEmail], (err2, rows2) => {
                if (err2) return res.status(500).json({ error: err2.message });

                let totalItemsBought = 0;
                rows2.forEach(row => {
                    try {
                        const items = typeof row.items === 'string'
                            ? JSON.parse(row.items || '[]')
                            : (Array.isArray(row.items) ? row.items : []);
                        items.forEach(item => {
                            totalItemsBought += Number(item.quantity || item.qty || 1);
                        });
                    } catch {}
                });
                summary.totalItemsBought = totalItemsBought;

                db.query(
                    `SELECT id, total, status, date_str FROM orders
                     WHERE account_email = ? ORDER BY created_at DESC LIMIT 5`,
                    [userEmail],
                    (err3, rows3) => {
                        if (err3) return res.status(500).json({ error: err3.message });
                        summary.recentOrders = rows3.map(r => ({
                            id:     r.id,
                            total:  Number(r.total),
                            status: r.status,
                            date:   r.date_str,
                        }));
                        res.json(summary);
                    }
                );
            });
        }
    );
});

// ─────────────────────────────────────────────────────────────────────────────
// HEALTH CHECK
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
    db.query('SELECT 1', (err) => {
        if (err) return res.status(503).json({ status: 'db_error', error: err.message });
        res.json({ status: 'ok' });
    });
});

// ─── KEEP ALIVE ─────────────────────────────────────────────────────────────
const RENDER_URL = 'https://backend-psp-market.onrender.com/api/health';

setInterval(() => {
    https.get(RENDER_URL, (res) => {
        console.log(`✓ Keep-alive ping: ${res.statusCode}`);
    }).on('error', (err) => {
        console.warn('Keep-alive ping failed:', err.message);
    });
}, 10 * 60 * 1000);

// ─── START SERVER ────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✓ Server running on port ${PORT}`));