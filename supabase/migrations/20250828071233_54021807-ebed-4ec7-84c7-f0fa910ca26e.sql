-- Insert dummy data for POS system testing (corrected enums)

-- Insert Categories
INSERT INTO categories (name) VALUES
('Food & Snacks'),
('Beverages'),
('Electronics'),
('Personal Care'),
('Household Items'),
('Office Supplies');

-- Insert Products
INSERT INTO products (name, category_id) VALUES
-- Food & Snacks
('Potato Chips', (SELECT id FROM categories WHERE name = 'Food & Snacks')),
('Chocolate Bar', (SELECT id FROM categories WHERE name = 'Food & Snacks')),
('Sandwich', (SELECT id FROM categories WHERE name = 'Food & Snacks')),
('Cookies', (SELECT id FROM categories WHERE name = 'Food & Snacks')),
('Energy Bar', (SELECT id FROM categories WHERE name = 'Food & Snacks')),

-- Beverages
('Coca Cola', (SELECT id FROM categories WHERE name = 'Beverages')),
('Coffee', (SELECT id FROM categories WHERE name = 'Beverages')),
('Mineral Water', (SELECT id FROM categories WHERE name = 'Beverages')),
('Orange Juice', (SELECT id FROM categories WHERE name = 'Beverages')),
('Energy Drink', (SELECT id FROM categories WHERE name = 'Beverages')),

-- Electronics
('USB Cable', (SELECT id FROM categories WHERE name = 'Electronics')),
('Phone Charger', (SELECT id FROM categories WHERE name = 'Electronics')),
('Bluetooth Headphones', (SELECT id FROM categories WHERE name = 'Electronics')),
('Power Bank', (SELECT id FROM categories WHERE name = 'Electronics')),
('Screen Protector', (SELECT id FROM categories WHERE name = 'Electronics')),

-- Personal Care
('Toothbrush', (SELECT id FROM categories WHERE name = 'Personal Care')),
('Shampoo', (SELECT id FROM categories WHERE name = 'Personal Care')),
('Hand Sanitizer', (SELECT id FROM categories WHERE name = 'Personal Care')),
('Face Mask', (SELECT id FROM categories WHERE name = 'Personal Care')),
('Soap', (SELECT id FROM categories WHERE name = 'Personal Care')),

-- Household Items
('Trash Bags', (SELECT id FROM categories WHERE name = 'Household Items')),
('Paper Towels', (SELECT id FROM categories WHERE name = 'Household Items')),
('Laundry Detergent', (SELECT id FROM categories WHERE name = 'Household Items')),
('Light Bulb', (SELECT id FROM categories WHERE name = 'Household Items')),
('Batteries', (SELECT id FROM categories WHERE name = 'Household Items')),

-- Office Supplies
('Notebook', (SELECT id FROM categories WHERE name = 'Office Supplies')),
('Pen Set', (SELECT id FROM categories WHERE name = 'Office Supplies')),
('Stapler', (SELECT id FROM categories WHERE name = 'Office Supplies')),
('Paper Clips', (SELECT id FROM categories WHERE name = 'Office Supplies')),
('Sticky Notes', (SELECT id FROM categories WHERE name = 'Office Supplies'));

-- Insert Product Variants with realistic pricing
INSERT INTO product_variants (name, product_id, sku, price, cost_price, barcode, track_inventory) VALUES
-- Food & Snacks variants
('Potato Chips - Regular', gen_random_uuid(), 'CHIP-REG-001', 2.50, 1.20, '1234567890123', true),
('Potato Chips - Large', gen_random_uuid(), 'CHIP-LRG-001', 4.00, 2.00, '1234567890124', true),
('Chocolate Bar - Dark', gen_random_uuid(), 'CHOC-DRK-001', 3.50, 1.75, '1234567890125', true),
('Chocolate Bar - Milk', gen_random_uuid(), 'CHOC-MLK-001', 3.50, 1.75, '1234567890126', true),
('Ham Sandwich', gen_random_uuid(), 'SAND-HAM-001', 6.50, 3.00, '1234567890127', true),
('Tuna Sandwich', gen_random_uuid(), 'SAND-TUN-001', 7.00, 3.50, '1234567890128', true),
('Chocolate Chip Cookies', gen_random_uuid(), 'COOK-CHC-001', 4.50, 2.25, '1234567890129', true),
('Oatmeal Cookies', gen_random_uuid(), 'COOK-OAT-001', 4.50, 2.25, '1234567890130', true),
('Protein Bar - Vanilla', gen_random_uuid(), 'EBAR-VAN-001', 5.50, 3.00, '1234567890131', true),
('Protein Bar - Chocolate', gen_random_uuid(), 'EBAR-CHO-001', 5.50, 3.00, '1234567890132', true),

-- Beverages variants
('Coca Cola - 330ml', gen_random_uuid(), 'COLA-330-001', 2.00, 0.80, '1234567890133', true),
('Coca Cola - 500ml', gen_random_uuid(), 'COLA-500-001', 2.75, 1.20, '1234567890134', true),
('Coffee - Americano', gen_random_uuid(), 'COFF-AME-001', 4.50, 1.50, '1234567890135', true),
('Coffee - Latte', gen_random_uuid(), 'COFF-LAT-001', 5.50, 2.00, '1234567890136', true),
('Mineral Water - 500ml', gen_random_uuid(), 'WATR-500-001', 1.50, 0.60, '1234567890137', true),
('Mineral Water - 1L', gen_random_uuid(), 'WATR-1L-001', 2.50, 1.00, '1234567890138', true),
('Orange Juice - Fresh', gen_random_uuid(), 'OJUI-FRE-001', 4.00, 2.00, '1234567890139', true),
('Orange Juice - Bottled', gen_random_uuid(), 'OJUI-BOT-001', 3.50, 1.75, '1234567890140', true),
('Energy Drink - Regular', gen_random_uuid(), 'ENDR-REG-001', 3.50, 1.50, '1234567890141', true),
('Energy Drink - Sugar Free', gen_random_uuid(), 'ENDR-SF-001', 3.75, 1.60, '1234567890142', true),

-- Electronics variants
('USB Cable - Type C', gen_random_uuid(), 'USB-TC-001', 12.00, 5.00, '1234567890143', true),
('USB Cable - Micro USB', gen_random_uuid(), 'USB-MU-001', 10.00, 4.00, '1234567890144', true),
('Phone Charger - iPhone', gen_random_uuid(), 'CHG-IPH-001', 25.00, 12.00, '1234567890145', true),
('Phone Charger - Android', gen_random_uuid(), 'CHG-AND-001', 20.00, 10.00, '1234567890146', true),
('Bluetooth Headphones - Over Ear', gen_random_uuid(), 'BT-HE-001', 85.00, 45.00, '1234567890147', true),
('Bluetooth Headphones - In Ear', gen_random_uuid(), 'BT-IE-001', 55.00, 30.00, '1234567890148', true),
('Power Bank - 10000mAh', gen_random_uuid(), 'PB-10K-001', 35.00, 18.00, '1234567890149', true),
('Power Bank - 20000mAh', gen_random_uuid(), 'PB-20K-001', 55.00, 28.00, '1234567890150', true),
('Screen Protector - iPhone', gen_random_uuid(), 'SP-IPH-001', 15.00, 6.00, '1234567890151', true),
('Screen Protector - Android', gen_random_uuid(), 'SP-AND-001', 12.00, 5.00, '1234567890152', true),

-- Personal Care variants
('Toothbrush - Soft', gen_random_uuid(), 'TB-SOF-001', 3.50, 1.50, '1234567890153', true),
('Toothbrush - Medium', gen_random_uuid(), 'TB-MED-001', 3.50, 1.50, '1234567890154', true),
('Shampoo - 250ml', gen_random_uuid(), 'SH-250-001', 8.50, 4.00, '1234567890155', true),
('Shampoo - 500ml', gen_random_uuid(), 'SH-500-001', 14.50, 7.00, '1234567890156', true),
('Hand Sanitizer - 50ml', gen_random_uuid(), 'HS-50-001', 3.00, 1.20, '1234567890157', true),
('Hand Sanitizer - 250ml', gen_random_uuid(), 'HS-250-001', 8.50, 4.00, '1234567890158', true),
('Face Mask - Pack of 10', gen_random_uuid(), 'FM-10P-001', 12.00, 6.00, '1234567890159', true),
('Face Mask - Pack of 50', gen_random_uuid(), 'FM-50P-001', 45.00, 25.00, '1234567890160', true),
('Soap - Bar', gen_random_uuid(), 'SOAP-BAR-001', 2.50, 1.00, '1234567890161', true),
('Soap - Liquid', gen_random_uuid(), 'SOAP-LIQ-001', 5.50, 2.50, '1234567890162', true),

-- Household Items variants
('Trash Bags - Small (30 pack)', gen_random_uuid(), 'TB-SM-001', 6.50, 3.00, '1234567890163', true),
('Trash Bags - Large (20 pack)', gen_random_uuid(), 'TB-LG-001', 8.50, 4.00, '1234567890164', true),
('Paper Towels - 6 rolls', gen_random_uuid(), 'PT-6R-001', 12.00, 6.00, '1234567890165', true),
('Paper Towels - 12 rolls', gen_random_uuid(), 'PT-12R-001', 22.00, 11.00, '1234567890166', true),
('Laundry Detergent - 1L', gen_random_uuid(), 'LD-1L-001', 8.50, 4.50, '1234567890167', true),
('Laundry Detergent - 2L', gen_random_uuid(), 'LD-2L-001', 15.00, 8.00, '1234567890168', true),
('Light Bulb - LED 9W', gen_random_uuid(), 'LB-9W-001', 12.00, 6.00, '1234567890169', true),
('Light Bulb - LED 15W', gen_random_uuid(), 'LB-15W-001', 18.00, 9.00, '1234567890170', true),
('Batteries - AA (4 pack)', gen_random_uuid(), 'BAT-AA-001', 8.00, 4.00, '1234567890171', true),
('Batteries - AAA (4 pack)', gen_random_uuid(), 'BAT-AAA-001', 8.50, 4.25, '1234567890172', true),

-- Office Supplies variants
('Notebook - A4 Lined', gen_random_uuid(), 'NB-A4L-001', 5.50, 2.50, '1234567890173', true),
('Notebook - A5 Blank', gen_random_uuid(), 'NB-A5B-001', 4.00, 2.00, '1234567890174', true),
('Pen Set - Blue (10 pack)', gen_random_uuid(), 'PS-BLU-001', 8.50, 4.00, '1234567890175', true),
('Pen Set - Black (10 pack)', gen_random_uuid(), 'PS-BLK-001', 8.50, 4.00, '1234567890176', true),
('Stapler - Standard', gen_random_uuid(), 'ST-STD-001', 15.00, 8.00, '1234567890177', true),
('Stapler - Heavy Duty', gen_random_uuid(), 'ST-HD-001', 25.00, 13.00, '1234567890178', true),
('Paper Clips - Small (100 pack)', gen_random_uuid(), 'PC-SM-001', 3.50, 1.50, '1234567890179', true),
('Paper Clips - Large (50 pack)', gen_random_uuid(), 'PC-LG-001', 4.50, 2.00, '1234567890180', true),
('Sticky Notes - Yellow', gen_random_uuid(), 'SN-YEL-001', 4.50, 2.00, '1234567890181', true),
('Sticky Notes - Multi Color', gen_random_uuid(), 'SN-MC-001', 6.00, 3.00, '1234567890182', true);

-- Create some discount examples (using correct enum values)
INSERT INTO discounts (name, discount_type, value, applies_to, active, starts_at, ends_at) VALUES
('Student Discount', 'percentage', 10.00, 'global', true, NOW(), NOW() + INTERVAL '30 days'),
('Buy 2 Get 1 Free Chips', 'percentage', 33.33, 'product', true, NOW(), NOW() + INTERVAL '7 days'),
('Happy Hour Coffee', 'fixed', 1.00, 'category', true, NOW(), NOW() + INTERVAL '14 days'),
('Weekend Special', 'percentage', 15.00, 'global', true, NOW(), NOW() + INTERVAL '2 days'),
('Bulk Purchase Discount', 'percentage', 5.00, 'global', true, NOW(), NOW() + INTERVAL '60 days');

-- Create sample user profiles for testing
INSERT INTO profiles (id, email, role) VALUES 
('00000000-0000-0000-0000-000000000001', 'owner@postest.com', 'owner'),
('00000000-0000-0000-0000-000000000002', 'cashier@postest.com', 'cashier'),
('00000000-0000-0000-0000-000000000003', 'warehouse@postest.com', 'warehouse_admin');