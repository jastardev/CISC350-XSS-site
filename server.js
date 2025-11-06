const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;

// Create database connection
const db = new sqlite3.Database('./products.db');

// Middleware
app.use(express.json());
app.use(cookieParser());

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'techstore_jwt_secret_key_2024';
const JWT_COOKIE_NAME = 'techstore-auth-token';
const JWT_EXPIRY_SECONDS = 24 * 60 * 60; // 24 hours

// Removed demo cookie middleware that set 'techstore_session' and 'user_preferences'

// Authentication middleware using JWT
function requireAuth(req, res, next) {
    const handleUnauthenticated = () => {
        // For browser page requests, redirect to login; for API, return JSON 401
        if (req.accepts('html')) {
            return res.redirect('/login');
        }
        return res.status(401).json({ message: 'Authentication required' });
    };

    try {
        // Prefer Authorization header, fall back to cookie for lab visibility
        let token;
        const authHeader = req.headers['authorization'] || req.headers['Authorization'];
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.slice('Bearer '.length);
        } else if (req.cookies && req.cookies[JWT_COOKIE_NAME]) {
            token = req.cookies[JWT_COOKIE_NAME];
        }

        if (!token) {
            return handleUnauthenticated();
        }

        const payload = jwt.verify(token, JWT_SECRET);
        req.user = {
            id: payload.id,
            username: payload.username,
            email: payload.email,
            created_at: payload.created_at,
            isAdmin: !!payload.isAdmin
        };
        return next();
    } catch (err) {
        return handleUnauthenticated();
    }
}

// Admin-only middleware (builds on authentication)
function requireAdmin(req, res, next) {
    return requireAuth(req, res, () => {
        if (!req.user || !req.user.isAdmin) {
            if (req.accepts('html')) {
                return res.status(403).send('Admin access required');
            }
            return res.status(403).json({ message: 'Admin privileges required' });
        }
        return next();
    });
}

// Authentication routes
app.post('/auth/login', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }
    
    try {
        // Query user from database
        const query = `SELECT * FROM users WHERE username = ?`;
        db.get(query, [username], async (err, user) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ message: 'Database error' });
            }
            
            if (!user) {
                return res.status(401).json({ message: 'Invalid username or password' });
            }
            
            // Check password
            const isValidPassword = await bcrypt.compare(password, user.password);
            if (!isValidPassword) {
                return res.status(401).json({ message: 'Invalid username or password' });
            }
            // Create JWT
            const token = jwt.sign({
                id: user.id,
                username: user.username,
                email: user.email,
                created_at: user.created_at,
                isAdmin: user.username === 'admin'
            }, JWT_SECRET, { expiresIn: JWT_EXPIRY_SECONDS });

            // Set cookie to make token easy to steal/observe for the lab
            res.cookie(JWT_COOKIE_NAME, token, {
                httpOnly: true, // deliberate for XSS lab
                secure: false,
                sameSite: 'lax',
                maxAge: JWT_EXPIRY_SECONDS * 1000
            });

            console.log('Login successful - JWT issued');

            res.json({
                message: 'Login successful',
                id: user.id,
                username: user.username,
                email: user.email,
                created_at: user.created_at
            });
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Ensure pending_products table exists for admin review queue
db.run(`CREATE TABLE IF NOT EXISTS pending_products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    price REAL NOT NULL
)`);

app.post('/auth/logout', (req, res) => {
    res.clearCookie(JWT_COOKIE_NAME);
    res.json({ message: 'Logout successful' });
});

app.get('/auth/status', requireAuth, (req, res) => {
    res.json({
        id: req.user.id,
        username: req.user.username,
        email: req.user.email,
        created_at: req.user.created_at,
        isAdmin: !!req.user.isAdmin
    });
});

// Change password for authenticated user
app.post('/auth/change-password', requireAuth, async (req, res) => {
    try {
        const { newPassword } = req.body;

        if (!newPassword) {
            return res.status(400).json({ message: 'New password is required' });
        }

        if (typeof newPassword !== 'string' || newPassword.length < 8) {
            return res.status(400).json({ message: 'New password must be at least 8 characters' });
        }

        // Fetch user from DB
        db.get(`SELECT * FROM users WHERE id = ?`, [req.user.id], async (err, user) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ message: 'Database error' });
            }
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }
            // Insecure by design for the lab: no current password check
            const hashed = await bcrypt.hash(newPassword, 10);
            db.run(`UPDATE users SET password = ? WHERE id = ?`, [hashed, req.user.id], function(updateErr) {
                if (updateErr) {
                    console.error('Database error:', updateErr);
                    return res.status(500).json({ message: 'Database error' });
                }

                // Issue a fresh JWT
                const token = jwt.sign({
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    created_at: user.created_at,
                    isAdmin: user.username === 'admin'
                }, JWT_SECRET, { expiresIn: JWT_EXPIRY_SECONDS });

                res.cookie(JWT_COOKIE_NAME, token, {
                    httpOnly: false,
                    secure: false,
                    sameSite: 'lax',
                    maxAge: JWT_EXPIRY_SECONDS * 1000
                });

                return res.json({ message: 'Password updated successfully' });
            });
        });
    } catch (error) {
        console.error('Change password error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
});

// Protected dashboard route
app.get('/dashboard', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// Login page route
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// Test route to check session functionality
app.get('/test-session', (req, res) => {
    const token = req.cookies[JWT_COOKIE_NAME] || null;
    let decoded = null;
    try {
        if (token) decoded = jwt.verify(token, JWT_SECRET);
    } catch (e) {}
    res.json({
        tokenPresent: !!token,
        decoded: decoded || null
    });
});

// Routes
app.get('/api/products', (req, res) => {
    // Intentionally vulnerable query for teaching purposes
    const query = `SELECT * FROM products`;
    
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(rows);
    });
});

// Pending products API - list
app.get('/api/pending-products', requireAuth, (req, res) => {
    const query = `SELECT * FROM pending_products`;
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(rows);
    });
});

app.get('/api/products/search', (req, res) => {
    // Intentionally vulnerable search endpoint for teaching injection
    const searchTerm = req.query.q;
    
    if (!searchTerm) {
        return res.json([]);
    }
    
    // Fixed SQL injection but kept XSS vulnerability for teaching
    // Using parameterized query to prevent SQL injection
    const query = `SELECT * FROM products WHERE name LIKE ? OR description LIKE ?`;
    const searchPattern = `%${searchTerm}%`;
    
    db.all(query, [searchPattern, searchPattern], (err, rows) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(rows);
    });
});

// Submit new product to pending queue (instead of publishing directly)
app.post('/api/products/pending', (req, res) => {
    const { name, description, price } = req.body;
    if (!name || !description || !price) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    const query = `INSERT INTO pending_products (name, description, price) VALUES (?, ?, ?)`;
    db.run(query, [name, description, price], function(err) {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.status(201).json({
            id: this.lastID,
            name: name,
            description: description,
            price: price
        });
    });
});

// Backward-compatible: accept legacy POST /api/products and treat as pending
app.post('/api/products', (req, res) => {
    const { name, description, price } = req.body;
    if (!name || !description || !price) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    const query = `INSERT INTO pending_products (name, description, price) VALUES (?, ?, ?)`;
    db.run(query, [name, description, price], function(err) {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.status(201).json({
            id: this.lastID,
            name: name,
            description: description,
            price: price
        });
    });
});

// Approve a pending product: move to products and remove from pending
app.post('/api/pending-products/:id/approve', requireAuth, (req, res) => {
    const pendingId = req.params.id;
    db.get(`SELECT * FROM pending_products WHERE id = ?`, [pendingId], (selErr, row) => {
        if (selErr) {
            console.error('Database error:', selErr);
            return res.status(500).json({ error: 'Database error' });
        }
        if (!row) {
            return res.status(404).json({ error: 'Pending product not found' });
        }
        db.run(`INSERT INTO products (name, description, price) VALUES (?, ?, ?)`, [row.name, row.description, row.price], function(insErr) {
            if (insErr) {
                console.error('Database error:', insErr);
                return res.status(500).json({ error: 'Database error' });
            }
            db.run(`DELETE FROM pending_products WHERE id = ?`, [pendingId], function(delErr) {
                if (delErr) {
                    console.error('Database error:', delErr);
                    return res.status(500).json({ error: 'Database error' });
                }
                res.json({ message: 'Product approved', newProductId: this.lastID });
            });
        });
    });
});

// Reject/remove a pending product
app.delete('/api/pending-products/:id', requireAuth, (req, res) => {
    const pendingId = req.params.id;
    db.run(`DELETE FROM pending_products WHERE id = ?`, [pendingId], function(err) {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Pending product not found' });
        }
        res.json({ message: 'Pending product removed' });
    });
});

app.delete('/api/products/:id', (req, res) => {
    // Intentionally vulnerable DELETE endpoint for teaching purposes
    const productId = req.params.id;
    
    if (!productId) {
        return res.status(400).json({ error: 'Product ID is required' });
    }
    
    // Vulnerable query - no sanitization for teaching purposes
    const query = `DELETE FROM products WHERE id = ${productId}`;
    
    db.run(query, function(err) {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        res.json({ message: 'Product deleted successfully' });
    });
});

// Serve the main HTML file with server-side rendered products
app.get('/', (req, res) => {
    const templatePath = path.join(__dirname, 'index.html');
    fs.readFile(templatePath, 'utf8', (readErr, html) => {
        if (readErr) {
            console.error('Error reading template:', readErr);
            return res.status(500).send('Server error');
        }

        db.all('SELECT * FROM products', [], (err, rows) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).send('Database error');
            }

            // Build products HTML with raw, unsanitized descriptions
            const productsHtml = rows.map((product) => `
                <article class="product" style="position: relative;">
                    <button class="delete-btn" onclick="deleteProduct(${product.id})" style="
                        position: absolute; top: 8px; right: 8px; background: rgba(220, 53, 69, 0.8); color: white;
                        border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; font-size: 12px;
                        font-weight: bold; line-height: 1; text-align: center; padding: 0; margin: 0; box-sizing: border-box;
                        transition: all 0.2s ease; z-index: 10; opacity: 0.7;"
                        onmouseover="this.style.opacity='1'; this.style.background='rgba(220, 53, 69, 1)'"
                        onmouseout="this.style.opacity='0.7'; this.style.background='rgba(220, 53, 69, 0.8)'">×</button>
                    <h3>${product.name}</h3>
                    <p>${product.description}</p>
                    <p><strong>Price: $${product.price}</strong></p>
                    <button>Add to Cart</button>
                </article>
            `).join('');

            let rendered = html.replace('<!-- SERVER_PRODUCTS -->', productsHtml);
            rendered = rendered.replace('<!-- SERVER_RENDERED_FLAG -->', '<script>window.SERVER_RENDERED=true;</script>');
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.send(rendered);
        });
    });
});

// Serve home-new.html with server-side rendered search status and products
app.get('/home-new.html', (req, res) => {
    const templatePath = path.join(__dirname, 'home-new.html');
    fs.readFile(templatePath, 'utf8', (readErr, html) => {
        if (readErr) {
            console.error('Error reading template:', readErr);
            return res.status(500).send('Server error');
        }

        // Get search query parameter
        const searchTerm = req.query.search || '';
        
        // Build search status HTML if search term exists
        let searchStatusHtml = '';
        if (searchTerm) {
            // Intentionally vulnerable - no filtering for XSS lab
            // This allows onload events to fire naturally when browser parses the HTML
            searchStatusHtml = `You are searching for: ${searchTerm}`;
        }
        
        // Load products from database
        let query, params;
        if (searchTerm) {
            // Search products if search term exists
            query = `SELECT * FROM products WHERE name LIKE ? OR description LIKE ?`;
            const searchPattern = `%${searchTerm}%`;
            params = [searchPattern, searchPattern];
        } else {
            // Load all products if no search term
            query = `SELECT * FROM products`;
            params = [];
        }
        
        db.all(query, params, (err, rows) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).send('Database error');
            }
            
            // Build products HTML with raw, unsanitized descriptions
            const productsHtml = rows.map((product) => `
                <article class="product" style="position: relative;">
                    <button class="delete-btn" onclick="deleteProduct(${product.id})" style="
                        position: absolute; top: 8px; right: 8px; background: rgba(220, 53, 69, 0.8); color: white;
                        border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; font-size: 12px;
                        font-weight: bold; line-height: 1; text-align: center; padding: 0; margin: 0; box-sizing: border-box;
                        transition: all 0.2s ease; z-index: 10; opacity: 0.7;"
                        onmouseover="this.style.opacity='1'; this.style.background='rgba(220, 53, 69, 1)'"
                        onmouseout="this.style.opacity='0.7'; this.style.background='rgba(220, 53, 69, 0.8)'">×</button>
                    <h3>${product.name}</h3>
                    <p>${product.description}</p>
                    <p><strong>Price: $${product.price}</strong></p>
                    <button>Add to Cart</button>
                </article>
            `).join('');
            
            let rendered = html.replace('<!-- SERVER_SEARCH_STATUS -->', searchStatusHtml);
            rendered = rendered.replace('<!-- SERVER_PRODUCTS -->', productsHtml);
            rendered = rendered.replace('<!-- SERVER_RENDERED_FLAG -->', '<script>window.SERVER_RENDERED=true;</script>');
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.send(rendered);
        });
    });
});

// Admin review queue rendered like the home page but using pending products
app.get('/admin/queue', requireAdmin, (req, res) => {
    const templatePath = path.join(__dirname, 'index.html');
    fs.readFile(templatePath, 'utf8', (readErr, html) => {
        if (readErr) {
            console.error('Error reading template:', readErr);
            return res.status(500).send('Server error');
        }
        db.all('SELECT * FROM pending_products', [], (err, rows) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).send('Database error');
            }
            const productsHtml = rows.map((product) => `
                <article class="product" style="position: relative;">
                    <button class="delete-btn" onclick="rejectPending(${product.id})" style="
                        position: absolute; top: 8px; right: 8px; background: rgba(220, 53, 69, 0.8); color: white;
                        border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; font-size: 12px;
                        font-weight: bold; line-height: 1; text-align: center; padding: 0; margin: 0; box-sizing: border-box;
                        transition: all 0.2s ease; z-index: 10; opacity: 0.7;" 
                        onmouseover="this.style.opacity='1'; this.style.background='rgba(220, 53, 69, 1)'"
                        onmouseout="this.style.opacity='0.7'; this.style.background='rgba(220, 53, 69, 0.8)'">×</button>
                    <h3>${product.name}</h3>
                    <p>${product.description}</p>
                    <p><strong>Price: $${product.price}</strong></p>
                    <div style="margin-top: 10px; display: flex; gap: 8px;">
                        <button onclick="approvePending(${product.id})" style="background:#28a745;color:white;border:none;padding:6px 10px;border-radius:4px;cursor:pointer;">Approve</button>
                        <button onclick="rejectPending(${product.id})" style="background:#dc3545;color:white;border:none;padding:6px 10px;border-radius:4px;cursor:pointer;">Reject</button>
                    </div>
                </article>
            `).join('');
            let rendered = html.replace('<!-- SERVER_PRODUCTS -->', `<div style="margin-bottom:10px;padding:10px;background:#fff3cd;border:1px solid #ffe8a1;border-radius:6px;">Admin Review Queue: Approve or Reject pending submissions.</div>` + productsHtml);
            rendered = rendered.replace('<!-- SERVER_RENDERED_FLAG -->', '<script>window.SERVER_RENDERED=true;window.IS_REVIEW_QUEUE=true;</script>');
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.send(rendered);
        });
    });
});

// Serve static files (CSS, JS, etc.) - but exclude dashboard.html
app.use(express.static('.', {
    index: false, // Don't serve index.html automatically
    setHeaders: (res, path) => {
        // Block direct access to dashboard.html
        if (path.endsWith('dashboard.html')) {
            res.status(403).send('Access denied. Please login first.');
        }
    }
}));

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('Database initialized with sample products');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down server...');
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err);
        } else {
            console.log('Database connection closed.');
        }
        process.exit(0);
    });
});
