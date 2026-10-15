/**
 * ============================================================================
 * FOOD WASTAGE REDUCTION & DONATION PLATFORM - BACKEND (Single Page Server)
 * ============================================================================
 * Technology: Node.js, Express, MySQL (mysql2)
 * Features:
 *   - Automatic MySQL Database & Table Initialization
 *   - Auto-seeding with realistic test data
 *   - RESTful API for Donations, Claims, Impact Metrics, and User Auth
 *   - Built-in static server for single-page frontend (public/index.html)
 * ============================================================================
 */

const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Database Configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '',
  port: Number(process.env.DB_PORT) || 3306,
  database: process.env.DB_NAME || 'food_waste_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

let pool = null;
let isDbConnected = false;

// In-memory fallback dataset in case MySQL is offline or password differs
let memoryStore = {
  users: [
    { id: 1, name: 'Rajesh Kumar', email: 'rajesh@royalhotel.com', password: 'password123', role: 'donor', organization: 'The Royal Grand Hotel & Banquet', phone: '9876543210', address: '120 MG Road, Residency Area' },
    { id: 2, name: 'Sarah Jenkins', email: 'sarah@freshbites.org', password: 'password123', role: 'donor', organization: 'FreshBites Cafe & Catering', phone: '9811223344', address: '45 Baker Street, City Center' },
    { id: 3, name: 'Anita Sharma', email: 'anita@hopefoundation.org', password: 'password123', role: 'ngo', organization: 'Hope & Hunger Relief NGO', phone: '9822334455', address: 'Plot 12, Community Center, East Wing' },
    { id: 4, name: 'David Miller', email: 'david@feedthecity.org', password: 'password123', role: 'ngo', organization: 'FeedTheCity Shelter', phone: '9833445566', address: '78 Sunshine Ave, North Sector' }
  ],
  donations: [
    { id: 1, donor_id: 1, donor_name: 'The Royal Grand Hotel & Banquet', food_title: 'Surplus Banquet Rice & Vegetable Curry', category: 'Cooked Meals', quantity: 65, unit: 'servings', dietary_type: 'Vegetarian', expiry_hours: 4, status: 'Available', pickup_address: 'Kitchen Back Entrance, 120 MG Road', contact_phone: '9876543210', notes: 'Freshly prepared for lunch banquet. Packed hygienically.', created_at: new Date(Date.now() - 3600000) },
    { id: 2, donor_id: 2, donor_name: 'FreshBites Cafe & Catering', food_title: 'Artisan Bread Loaves & Bagels', category: 'Bakery & Bread', quantity: 35, unit: 'pieces', dietary_type: 'Vegetarian', expiry_hours: 18, status: 'Available', pickup_address: '45 Baker Street, City Center', contact_phone: '9811223344', notes: 'Baked today morning. Stored in dry bakery boxes.', created_at: new Date(Date.now() - 7200000) },
    { id: 3, donor_id: 1, donor_name: 'The Royal Grand Hotel & Banquet', food_title: 'Mixed Seasonal Fresh Fruits', category: 'Fresh Produce', quantity: 20, unit: 'kg', dietary_type: 'Vegan', expiry_hours: 8, status: 'Claimed', pickup_address: 'Banquet Storage, 120 MG Road', contact_phone: '9876543210', notes: 'Chilled and fresh. Includes apples, oranges, melon slices.', created_at: new Date(Date.now() - 10800000) },
    { id: 4, donor_id: 2, donor_name: 'FreshBites Cafe & Catering', food_title: 'Packaged Vegetarian Sandwich Platters', category: 'Cooked Meals', quantity: 40, unit: 'packs', dietary_type: 'Vegetarian', expiry_hours: 6, status: 'Completed', pickup_address: 'Front Counter, 45 Baker Street', contact_phone: '9811223344', notes: 'Individually wrapped sandwiches.', created_at: new Date(Date.now() - 86400000) }
  ],
  claims: [
    { id: 1, donation_id: 3, ngo_id: 3, ngo_name: 'Hope & Hunger Relief NGO', ngo_phone: '9822334455', pickup_time: 'Within 2 hours', status: 'Pending Pickup', notes: 'Volunteer van dispatched for collection.', created_at: new Date(Date.now() - 5400000) }
  ]
};

// ----------------------------------------------------------------------------
// DATABASE INITIALIZATION & SCHEMA SETUP
// ----------------------------------------------------------------------------
async function initializeDatabase() {
  try {
    console.log(`\n⏳ Attempting to connect to MySQL on ${dbConfig.host}:${dbConfig.port}...`);
    
    // Connect without selecting database first to ensure DB exists
    const rootConn = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password,
      port: dbConfig.port
    });

    await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\`;`);
    await rootConn.end();

    // Create Connection Pool to the application database
    pool = mysql.createPool(dbConfig);

    // Create Tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(120) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role ENUM('donor', 'ngo', 'admin') DEFAULT 'donor',
        organization VARCHAR(150),
        phone VARCHAR(20),
        address TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS donations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        donor_id INT NOT NULL,
        donor_name VARCHAR(100) NOT NULL,
        food_title VARCHAR(150) NOT NULL,
        category ENUM('Cooked Meals', 'Bakery & Bread', 'Fresh Produce', 'Packaged & Canned', 'Dairy & Eggs', 'Other') DEFAULT 'Cooked Meals',
        quantity DECIMAL(10,2) NOT NULL,
        unit VARCHAR(20) DEFAULT 'servings',
        dietary_type ENUM('Vegetarian', 'Non-Vegetarian', 'Vegan') DEFAULT 'Vegetarian',
        expiry_hours INT NOT NULL DEFAULT 6,
        status ENUM('Available', 'Claimed', 'Picked_Up', 'Completed', 'Cancelled') DEFAULT 'Available',
        pickup_address TEXT NOT NULL,
        contact_phone VARCHAR(20) NOT NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (donor_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS claims (
        id INT AUTO_INCREMENT PRIMARY KEY,
        donation_id INT NOT NULL,
        ngo_id INT NOT NULL,
        ngo_name VARCHAR(100) NOT NULL,
        ngo_phone VARCHAR(20) NOT NULL,
        pickup_time VARCHAR(100),
        status ENUM('Pending Pickup', 'Picked Up', 'Delivered') DEFAULT 'Pending Pickup',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (donation_id) REFERENCES donations(id) ON DELETE CASCADE,
        FOREIGN KEY (ngo_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    // Check if initial users exist, else seed
    const [userRows] = await pool.query(`SELECT COUNT(*) AS count FROM users;`);
    if (userRows[0].count === 0) {
      console.log('🌱 Seeding initial demo users and donations into MySQL...');
      for (const u of memoryStore.users) {
        await pool.query(
          `INSERT INTO users (id, name, email, password, role, organization, phone, address) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [u.id, u.name, u.email, u.password, u.role, u.organization, u.phone, u.address]
        );
      }
      for (const d of memoryStore.donations) {
        await pool.query(
          `INSERT INTO donations (id, donor_id, donor_name, food_title, category, quantity, unit, dietary_type, expiry_hours, status, pickup_address, contact_phone, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [d.id, d.donor_id, d.donor_name, d.food_title, d.category, d.quantity, d.unit, d.dietary_type, d.expiry_hours, d.status, d.pickup_address, d.contact_phone, d.notes]
        );
      }
      for (const c of memoryStore.claims) {
        await pool.query(
          `INSERT INTO claims (id, donation_id, ngo_id, ngo_name, ngo_phone, pickup_time, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [c.id, c.donation_id, c.ngo_id, c.ngo_name, c.ngo_phone, c.pickup_time, c.status, c.notes]
        );
      }
    }

    isDbConnected = true;
    console.log('✅ Connected successfully to MySQL Database:', dbConfig.database);
  } catch (error) {
    isDbConnected = false;
    console.warn('\n⚠️ MySQL Connection Warning:', error.message);
    console.warn('💡 The server will run with built-in in-memory storage so you can test immediately.');
    console.warn('👉 To connect to your MySQL database, configure your DB_PASSWORD in .env or MySQL service.');
  }
}

// ----------------------------------------------------------------------------
// REST API ROUTES
// ----------------------------------------------------------------------------

// 1. Health & Connection Status
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    appName: 'Food Wastage Reduction & Donation Platform',
    database: isDbConnected ? 'MySQL Connected' : 'In-Memory Fallback Mode',
    timestamp: new Date().toISOString()
  });
});

// 2. Authentication: Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role, organization, phone, address } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required.' });
    }

    if (isDbConnected) {
      const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
      if (existing.length > 0) {
        return res.status(409).json({ success: false, message: 'Email already registered.' });
      }

      const [result] = await pool.query(
        'INSERT INTO users (name, email, password, role, organization, phone, address) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [name, email, password, role || 'donor', organization || '', phone || '', address || '']
      );

      const [user] = await pool.query('SELECT id, name, email, role, organization, phone, address FROM users WHERE id = ?', [result.insertId]);
      return res.status(201).json({ success: true, message: 'User registered successfully!', user: user[0] });
    } else {
      const exists = memoryStore.users.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (exists) return res.status(409).json({ success: false, message: 'Email already registered.' });

      const newUser = {
        id: memoryStore.users.length + 1,
        name,
        email,
        password,
        role: role || 'donor',
        organization: organization || '',
        phone: phone || '',
        address: address || ''
      };
      memoryStore.users.push(newUser);
      const { password: _, ...userWithoutPass } = newUser;
      return res.status(201).json({ success: true, message: 'User registered successfully (in-memory)!', user: userWithoutPass });
    }
  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({ success: false, message: 'Server error during registration.', error: error.message });
  }
});

// 3. Authentication: Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password.' });
    }

    if (isDbConnected) {
      const [rows] = await pool.query('SELECT * FROM users WHERE email = ? AND password = ?', [email, password]);
      if (rows.length === 0) {
        return res.status(401).json({ success: false, message: 'Invalid email or password.' });
      }
      const user = rows[0];
      delete user.password;
      return res.json({ success: true, message: 'Login successful!', user });
    } else {
      const user = memoryStore.users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
      if (!user) {
        return res.status(401).json({ success: false, message: 'Invalid email or password.' });
      }
      const { password: _, ...userWithoutPass } = user;
      return res.json({ success: true, message: 'Login successful!', user: userWithoutPass });
    }
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ success: false, message: 'Server error during login.', error: error.message });
  }
});

// 4. Get All Donations (with search and filtering)
app.get('/api/donations', async (req, res) => {
  try {
    const { status, category, search, dietary_type } = req.query;

    if (isDbConnected) {
      let query = `
        SELECT d.*, c.ngo_name, c.pickup_time, c.status as claim_status
        FROM donations d
        LEFT JOIN claims c ON d.id = c.donation_id
        WHERE 1=1
      `;
      const params = [];

      if (status && status !== 'All') {
        query += ` AND d.status = ?`;
        params.push(status);
      }
      if (category && category !== 'All') {
        query += ` AND d.category = ?`;
        params.push(category);
      }
      if (dietary_type && dietary_type !== 'All') {
        query += ` AND d.dietary_type = ?`;
        params.push(dietary_type);
      }
      if (search) {
        query += ` AND (d.food_title LIKE ? OR d.pickup_address LIKE ? OR d.donor_name LIKE ?)`;
        const wild = `%${search}%`;
        params.push(wild, wild, wild);
      }

      query += ` ORDER BY d.id DESC`;
      const [rows] = await pool.query(query, params);
      return res.json({ success: true, count: rows.length, data: rows });
    } else {
      let results = [...memoryStore.donations];
      if (status && status !== 'All') results = results.filter(d => d.status.toLowerCase() === status.toLowerCase());
      if (category && category !== 'All') results = results.filter(d => d.category.toLowerCase() === category.toLowerCase());
      if (dietary_type && dietary_type !== 'All') results = results.filter(d => d.dietary_type.toLowerCase() === dietary_type.toLowerCase());
      if (search) {
        const s = search.toLowerCase();
        results = results.filter(d => d.food_title.toLowerCase().includes(s) || d.donor_name.toLowerCase().includes(s) || d.pickup_address.toLowerCase().includes(s));
      }
      results.sort((a, b) => b.id - a.id);
      return res.json({ success: true, count: results.length, data: results });
    }
  } catch (error) {
    console.error('Get Donations Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch donations.', error: error.message });
  }
});

// 5. Post New Food Donation
app.post('/api/donations', async (req, res) => {
  try {
    const { donor_id, donor_name, food_title, category, quantity, unit, dietary_type, expiry_hours, pickup_address, contact_phone, notes } = req.body;

    if (!food_title || !quantity || !pickup_address || !contact_phone) {
      return res.status(400).json({ success: false, message: 'Please provide food title, quantity, pickup address, and contact phone.' });
    }

    const newDonation = {
      donor_id: donor_id || 1,
      donor_name: donor_name || 'Anonymous Donor',
      food_title,
      category: category || 'Cooked Meals',
      quantity: parseFloat(quantity),
      unit: unit || 'servings',
      dietary_type: dietary_type || 'Vegetarian',
      expiry_hours: parseInt(expiry_hours) || 6,
      status: 'Available',
      pickup_address,
      contact_phone,
      notes: notes || ''
    };

    if (isDbConnected) {
      const [result] = await pool.query(
        `INSERT INTO donations (donor_id, donor_name, food_title, category, quantity, unit, dietary_type, expiry_hours, status, pickup_address, contact_phone, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [newDonation.donor_id, newDonation.donor_name, newDonation.food_title, newDonation.category, newDonation.quantity, newDonation.unit, newDonation.dietary_type, newDonation.expiry_hours, 'Available', newDonation.pickup_address, newDonation.contact_phone, newDonation.notes]
      );
      newDonation.id = result.insertId;
      newDonation.created_at = new Date();
      return res.status(201).json({ success: true, message: 'Food donation posted successfully!', data: newDonation });
    } else {
      newDonation.id = memoryStore.donations.length + 1;
      newDonation.created_at = new Date();
      memoryStore.donations.unshift(newDonation);
      return res.status(201).json({ success: true, message: 'Food donation posted successfully (in-memory)!', data: newDonation });
    }
  } catch (error) {
    console.error('Post Donation Error:', error);
    res.status(500).json({ success: false, message: 'Failed to post donation.', error: error.message });
  }
});

// 6. Claim Food Donation (NGO Action)
app.put('/api/donations/:id/claim', async (req, res) => {
  try {
    const donationId = parseInt(req.params.id);
    const { ngo_id, ngo_name, ngo_phone, pickup_time, notes } = req.body;

    if (!ngo_name || !ngo_phone) {
      return res.status(400).json({ success: false, message: 'NGO name and contact phone are required to claim.' });
    }

    if (isDbConnected) {
      const [donationRows] = await pool.query('SELECT * FROM donations WHERE id = ?', [donationId]);
      if (donationRows.length === 0) return res.status(404).json({ success: false, message: 'Donation not found.' });
      if (donationRows[0].status !== 'Available') {
        return res.status(400).json({ success: false, message: `Donation is already ${donationRows[0].status}.` });
      }

      await pool.query('UPDATE donations SET status = "Claimed" WHERE id = ?', [donationId]);
      await pool.query(
        `INSERT INTO claims (donation_id, ngo_id, ngo_name, ngo_phone, pickup_time, status, notes) VALUES (?, ?, ?, ?, ?, 'Pending Pickup', ?)`,
        [donationId, ngo_id || 3, ngo_name, ngo_phone, pickup_time || 'Within 2 hours', notes || '']
      );

      return res.json({ success: true, message: 'Donation claimed successfully! Pickup scheduled.' });
    } else {
      const donation = memoryStore.donations.find(d => d.id === donationId);
      if (!donation) return res.status(404).json({ success: false, message: 'Donation not found.' });
      if (donation.status !== 'Available') return res.status(400).json({ success: false, message: `Donation is already ${donation.status}.` });

      donation.status = 'Claimed';
      const newClaim = {
        id: memoryStore.claims.length + 1,
        donation_id: donationId,
        ngo_id: ngo_id || 3,
        ngo_name,
        ngo_phone,
        pickup_time: pickup_time || 'Within 2 hours',
        status: 'Pending Pickup',
        notes: notes || '',
        created_at: new Date()
      };
      memoryStore.claims.push(newClaim);
      return res.json({ success: true, message: 'Donation claimed successfully (in-memory)!', claim: newClaim });
    }
  } catch (error) {
    console.error('Claim Donation Error:', error);
    res.status(500).json({ success: false, message: 'Failed to claim donation.', error: error.message });
  }
});

// 7. Update Donation Status (Picked Up / Completed / Cancelled)
app.put('/api/donations/:id/status', async (req, res) => {
  try {
    const donationId = parseInt(req.params.id);
    const { status } = req.body;
    const allowed = ['Available', 'Claimed', 'Picked_Up', 'Completed', 'Cancelled'];

    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value.' });
    }

    if (isDbConnected) {
      const [result] = await pool.query('UPDATE donations SET status = ? WHERE id = ?', [status, donationId]);
      if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Donation not found.' });
      return res.json({ success: true, message: `Status updated to ${status}.` });
    } else {
      const donation = memoryStore.donations.find(d => d.id === donationId);
      if (!donation) return res.status(404).json({ success: false, message: 'Donation not found.' });
      donation.status = status;
      return res.json({ success: true, message: `Status updated to ${status}.`, donation });
    }
  } catch (error) {
    console.error('Status Update Error:', error);
    res.status(500).json({ success: false, message: 'Failed to update status.', error: error.message });
  }
});

// 8. Delete Donation
app.delete('/api/donations/:id', async (req, res) => {
  try {
    const donationId = parseInt(req.params.id);

    if (isDbConnected) {
      const [result] = await pool.query('DELETE FROM donations WHERE id = ?', [donationId]);
      if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Donation not found.' });
      return res.json({ success: true, message: 'Donation deleted successfully.' });
    } else {
      const idx = memoryStore.donations.findIndex(d => d.id === donationId);
      if (idx === -1) return res.status(404).json({ success: false, message: 'Donation not found.' });
      memoryStore.donations.splice(idx, 1);
      return res.json({ success: true, message: 'Donation deleted successfully.' });
    }
  } catch (error) {
    console.error('Delete Error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete donation.', error: error.message });
  }
});

// 9. Impact Analytics & Platform Metrics
app.get('/api/stats', async (req, res) => {
  try {
    if (isDbConnected) {
      const [totalDonations] = await pool.query('SELECT COUNT(*) AS total FROM donations;');
      const [completed] = await pool.query('SELECT COUNT(*) AS total, SUM(quantity) AS total_qty FROM donations WHERE status = "Completed" OR status = "Claimed";');
      const [donors] = await pool.query('SELECT COUNT(DISTINCT donor_id) AS total FROM donations;');
      const [ngos] = await pool.query('SELECT COUNT(DISTINCT ngo_id) AS total FROM claims;');
      
      const mealsSaved = Math.round((completed[0].total_qty || 160) * 1.5);
      const kgSaved = Math.round(mealsSaved * 0.45);
      const co2Prevented = Math.round(kgSaved * 2.5);

      return res.json({
        success: true,
        stats: {
          totalListings: totalDonations[0].total,
          mealsSaved: mealsSaved || 240,
          kgFoodSaved: kgSaved || 108,
          co2PreventedKg: co2Prevented || 270,
          activeDonors: donors[0].total || 2,
          registeredNgos: ngos[0].total || 2
        }
      });
    } else {
      const totalQty = memoryStore.donations
        .filter(d => d.status === 'Completed' || d.status === 'Claimed')
        .reduce((sum, d) => sum + Number(d.quantity || 0), 0);

      const mealsSaved = Math.round(totalQty * 1.5) || 240;
      const kgSaved = Math.round(mealsSaved * 0.45) || 108;
      const co2Prevented = Math.round(kgSaved * 2.5) || 270;

      return res.json({
        success: true,
        stats: {
          totalListings: memoryStore.donations.length,
          mealsSaved,
          kgFoodSaved: kgSaved,
          co2PreventedKg: co2Prevented,
          activeDonors: 2,
          registeredNgos: 2
        }
      });
    }
  } catch (error) {
    console.error('Stats Error:', error);
    res.status(500).json({ success: false, message: 'Failed to load stats.' });
  }
});

// Catch-all route to serve the single frontend page
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ----------------------------------------------------------------------------
// START SERVER
// ----------------------------------------------------------------------------
async function startServer() {
  await initializeDatabase();
  app.listen(PORT, () => {
    console.log(`\n============================================================`);
    console.log(`🚀 FOOD WASTAGE REDUCTION & DONATION PLATFORM IS RUNNING!`);
    console.log(`🌐 URL: http://localhost:${PORT}`);
    console.log(`🗄️ Database Status: ${isDbConnected ? 'Connected to MySQL (' + dbConfig.database + ')' : 'In-Memory Fallback Active'}`);
    console.log(`============================================================\n`);
  });
}

startServer();