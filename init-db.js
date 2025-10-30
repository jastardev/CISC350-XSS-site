const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const bcrypt = require('bcryptjs');

// Remove existing database if it exists
if (fs.existsSync('./products.db')) {
    fs.unlinkSync('./products.db');
    console.log('Removed existing database');
}

// Create new database
const db = new sqlite3.Database('./products.db');

// Create tables
db.serialize(() => {
    // Create products table
    db.run(`CREATE TABLE products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        price REAL NOT NULL
    )`);

    // Create users table
    db.run(`CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Insert sample products
    const products = [
        {
            name: 'Wireless Headphones',
            description: 'Premium quality wireless headphones with noise cancellation',
            price: 199.99
        },
        {
            name: 'Smart Watch',
            description: 'Track your fitness and stay connected with this smart watch',
            price: 299.99
        },
        {
            name: 'Bluetooth Speaker',
            description: 'Portable speaker with crystal clear sound and long battery life',
            price: 89.99
        },
        {
            name: 'USB-C Cable',
            description: 'High-speed charging and data transfer cable for all your devices',
            price: 19.99
        }
    ];

    const stmt = db.prepare(`INSERT INTO products (name, description, price) VALUES (?, ?, ?)`);
    
    products.forEach(product => {
        stmt.run(product.name, product.description, product.price);
    });
    
    stmt.finalize();
    
    // Insert sample users
    const users = [
        {
            username: 'admin',
            password: 'admin123',
            email: 'admin@techstore.com'
        },
        {
            username: 'user1',
            password: 'password123',
            email: 'user1@techstore.com'
        },
        {
            username: 'demo',
            password: 'demo123',
            email: 'demo@techstore.com'
        }
    ];

    // Hash passwords and insert users
    const insertUsers = async () => {
        const userStmt = db.prepare(`INSERT INTO users (username, password, email) VALUES (?, ?, ?)`);
        
        for (const user of users) {
            const hashedPassword = await bcrypt.hash(user.password, 10);
            userStmt.run(user.username, hashedPassword, user.email);
        }
        
        userStmt.finalize();
    };
    
    insertUsers().then(() => {
        console.log('Database initialized with sample products and users');
    });
});

db.close((err) => {
    if (err) {
        console.error('Error closing database:', err);
    } else {
        console.log('Database setup complete');
    }
});
