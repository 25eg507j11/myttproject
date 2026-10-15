CREATE DATABASE IF NOT EXISTS food_waste_db;
USE food_waste_db;

-- 1. Users Table (Donors, NGOs, Admins)
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

-- 2. Food Donations Table
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

-- 3. Food Claims Table (NGO claims a donation)
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

-- Sample Starter Data
INSERT INTO users (id, name, email, password, role, organization, phone, address) VALUES
(1, 'Rajesh Kumar', 'rajesh@royalhotel.com', 'password123', 'donor', 'The Royal Grand Hotel & Banquet', '9876543210', '120 MG Road, Residency Area'),
(2, 'Sarah Jenkins', 'sarah@freshbites.org', 'password123', 'donor', 'FreshBites Cafe & Catering', '9811223344', '45 Baker Street, City Center'),
(3, 'Anita Sharma', 'anita@hopefoundation.org', 'password123', 'ngo', 'Hope & Hunger Relief NGO', '9822334455', 'Plot 12, Community Center, East Wing'),
(4, 'David Miller', 'david@feedthecity.org', 'password123', 'ngo', 'FeedTheCity Shelter', '9833445566', '78 Sunshine Ave, North Sector'),
(5, 'Platform Admin', 'admin@foodbridge.org', 'admin123', 'admin', 'Food Wastage Reduction Network', '9900112233', 'Central Hub, Main Tower')
ON DUPLICATE KEY UPDATE id=id;

INSERT INTO donations (id, donor_id, donor_name, food_title, category, quantity, unit, dietary_type, expiry_hours, status, pickup_address, contact_phone, notes) VALUES
(1, 1, 'The Royal Grand Hotel & Banquet', 'Surplus Banquet Rice & Vegetable Curry', 'Cooked Meals', 65, 'servings', 'Vegetarian', 4, 'Available', 'Kitchen Back Entrance, 120 MG Road', '9876543210', 'Freshly prepared for lunch banquet. Packed hygienically.'),
(2, 2, 'FreshBites Cafe & Catering', 'Artisan Bread Loaves, Croissants & Bagels', 'Bakery & Bread', 35, 'pieces', 'Vegetarian', 18, 'Available', '45 Baker Street, City Center', '9811223344', 'Baked today morning. Stored in dry bakery boxes.'),
(3, 1, 'The Royal Grand Hotel & Banquet', 'Mixed Seasonal Fruits & Salads', 'Fresh Produce', 20, 'kg', 'Vegan', 8, 'Claimed', 'Banquet Storage, 120 MG Road', '9876543210', 'Chilled and fresh. Includes apples, oranges, and watermelon slices.'),
(4, 2, 'FreshBites Cafe & Catering', 'Packaged Sandwich Platters (Paneer & Veg)', 'Cooked Meals', 40, 'packs', 'Vegetarian', 6, 'Completed', 'Front Counter, 45 Baker Street', '9811223344', 'Individually wrapped vegetarian sandwiches.')
ON DUPLICATE KEY UPDATE id=id;

INSERT INTO claims (id, donation_id, ngo_id, ngo_name, ngo_phone, pickup_time, status, notes) VALUES
(1, 3, 3, 'Hope & Hunger Relief NGO', '9822334455', 'Within 2 hours', 'Pending Pickup', 'Volunteer van dispatched for collection.')
ON DUPLICATE KEY UPDATE id=id;