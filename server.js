

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





















require('dotenv').config();

const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();

// ─── CORS ─────────────────────────────────────────────────────────────────────
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

// ─── DATABASE POOL (Aiven Cloud with SSL) ─────────────────────────────────────
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

// ─── AUTO-CREATE + AUTO-MIGRATE TABLES ────────────────────────────────────────
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

                        let completed = 0;
                        migrations.forEach((sql) => {
                            connection.query(sql, (me) => {
                                // errno 1060 = column already exists, 1091 = can't drop non-existent — both are safe to ignore
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

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function safeJson(val) {
    if (val === null || val === undefined) return null;
    if (typeof val === 'object') return val;
    try { return JSON.parse(val); } catch { return null; }
}

function toJson(val) {
    if (val === null || val === undefined) return null;
    if (typeof val === 'string') return val;
    return JSON.stringify(val);
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
        toJson(images      || []),
        toJson(variants    || []),
        toJson(variantPricing || null),
        toJson(childModels || null),
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

// POST /api/users/register
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
                    date:   u.created_at ? u.created_at.toISOString().slice(0, 10) : null,
                },
            });
        });
    });
});

// POST /api/users/login
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
                date:   u.created_at ? u.created_at.toISOString().slice(0, 10) : null,
            },
        });
    });
});

// POST /api/users/check-email
app.post('/api/users/check-email', (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email required.' });
    db.query('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ exists: rows.length > 0 });
    });
});

// GET /api/users — list all users (admin)
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
                date:   u.created_at ? u.created_at.toISOString().slice(0, 10) : null,
            })));
        }
    );
});

// PATCH /api/users/:id — update name, role, status, or avatar
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

// DELETE /api/users/:id
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
function hydrateOrder(row) {
    if (!row) return null;
    return {
        id:           row.id,
        accountEmail: row.account_email,
        customerName: row.customer_name,
        phone:        row.phone,
        address:      row.address,
        mapLocation:  row.map_location,
        carrier:      row.carrier,
        shippingFee:  Number(row.shipping_fee),
        subtotal:     Number(row.subtotal),
        total:        Number(row.total),
        status:       row.status,
        date:         row.date_str,
        items:        safeJson(row.items) || [],
        created_at:   row.created_at,
        updated_at:   row.updated_at,
    };
}

// GET /api/orders — all orders (admin) or filtered by email (customer)
app.get('/api/orders', (req, res) => {
    const { email } = req.query;
    let sql    = 'SELECT * FROM orders';
    const params = [];

    if (email) {
        sql += ' WHERE account_email = ?';
        params.push(email.trim().toLowerCase());
    }

    sql += ' ORDER BY created_at DESC';

    db.query(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows.map(hydrateOrder));
    });
});

// GET /api/orders/:id
app.get('/api/orders/:id', (req, res) => {
    db.query('SELECT * FROM orders WHERE id = ?', [req.params.id], (err, rows) => {
        if (err)          return res.status(500).json({ error: err.message });
        if (!rows.length) return res.status(404).json({ message: 'Order not found' });
        res.json(hydrateOrder(rows[0]));
    });
});

// POST /api/orders — create or update (upsert) an order
app.post('/api/orders', (req, res) => {
    const {
        id, accountEmail, customerName, phone, address, mapLocation,
        carrier, shippingFee, subtotal, total, status, date, items
    } = req.body;

    if (!accountEmail || !customerName || !phone || !address || !items) {
        return res.status(400).json({ error: 'Required fields missing: accountEmail, customerName, phone, address, and items are required.' });
    }

    const orderId = id ? String(id) : Math.floor(100000 + Math.random() * 900000).toString();

    const sql = `
        INSERT INTO orders
            (id, account_email, customer_name, phone, address, map_location,
             carrier, shipping_fee, subtotal, total, status, date_str, items)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            customer_name = VALUES(customer_name),
            phone         = VALUES(phone),
            address       = VALUES(address),
            map_location  = VALUES(map_location),
            carrier       = VALUES(carrier),
            shipping_fee  = VALUES(shipping_fee),
            subtotal      = VALUES(subtotal),
            total         = VALUES(total),
            status        = VALUES(status),
            items         = VALUES(items),
            updated_at    = CURRENT_TIMESTAMP
    `;

    const values = [
        orderId,
        accountEmail.trim().toLowerCase(),
        customerName.trim(),
        phone.trim(),
        address.trim(),
        mapLocation || null,
        carrier     || 'Standard Home Delivery',
        Number(shippingFee) || 0.00,
        Number(subtotal)    || 0.00,
        Number(total)       || 0.00,
        status || 'confirmed',
        date   || new Date().toLocaleDateString('en-US'),
        toJson(items),
    ];

    db.query(sql, values, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        db.query('SELECT * FROM orders WHERE id = ?', [orderId], (err2, rows) => {
            if (err2) return res.status(500).json({ error: err2.message });
            res.status(201).json({ message: 'Order saved successfully.', order: hydrateOrder(rows[0]) });
        });
    });
});

// PATCH /api/orders/:id — update order fields
app.patch('/api/orders/:id', (req, res) => {
    const { id } = req.params;
    const allowed = ['status','customer_name','phone','address','map_location','carrier','shipping_fee','subtotal','total','items'];
    const dbMap   = { customerName: 'customer_name', mapLocation: 'map_location', shippingFee: 'shipping_fee' };
    const fields  = [];
    const values  = [];

    Object.entries(req.body).forEach(([key, val]) => {
        const col = dbMap[key] || key;
        if (!allowed.includes(col)) return;
        fields.push(`${col} = ?`);
        values.push(col === 'items' ? toJson(val) : val);
    });

    if (!fields.length) return res.status(400).json({ error: 'No valid fields to update.' });
    values.push(id);

    db.query(`UPDATE orders SET ${fields.join(', ')} WHERE id = ?`, values, (err, result) => {
        if (err)                  return res.status(500).json({ error: err.message });
        if (!result.affectedRows) return res.status(404).json({ message: 'Order not found.' });
        db.query('SELECT * FROM orders WHERE id = ?', [id], (err2, rows) => {
            if (err2) return res.status(500).json({ error: err2.message });
            res.json({ message: 'Order updated successfully.', order: hydrateOrder(rows[0]) });
        });
    });
});

// DELETE /api/orders/:id
app.delete('/api/orders/:id', (req, res) => {
    db.query('DELETE FROM orders WHERE id = ?', [req.params.id], (err, result) => {
        if (err)                  return res.status(500).json({ error: err.message });
        if (!result.affectedRows) return res.status(404).json({ message: 'Order not found.' });
        res.json({ message: 'Order deleted successfully.' });
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

// GET /api/comments
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

// POST /api/comments
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

// DELETE /api/comments/:id — delete single comment
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

// DELETE /api/comments — delete ALL comments
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
// HEALTH CHECK
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
    db.query('SELECT 1', (err) => {
        if (err) return res.status(503).json({ status: 'db_error', error: err.message });
        res.json({ status: 'ok' });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✓ Server running on port ${PORT}`));