-- Insert dummy data for POS system testing

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
('Potato Chips - Regular', (SELECT id FROM products WHERE name = 'Potato Chips'), 'CHIP-REG-001', 2.50, 1.20, '1234567890123', true),
('Potato Chips - Large', (SELECT id FROM products WHERE name = 'Potato Chips'), 'CHIP-LRG-001', 4.00, 2.00, '1234567890124', true),
('Chocolate Bar - Dark', (SELECT id FROM products WHERE name = 'Chocolate Bar'), 'CHOC-DRK-001', 3.50, 1.75, '1234567890125', true),
('Chocolate Bar - Milk', (SELECT id FROM products WHERE name = 'Chocolate Bar'), 'CHOC-MLK-001', 3.50, 1.75, '1234567890126', true),
('Ham Sandwich', (SELECT id FROM products WHERE name = 'Sandwich'), 'SAND-HAM-001', 6.50, 3.00, '1234567890127', true),
('Tuna Sandwich', (SELECT id FROM products WHERE name = 'Sandwich'), 'SAND-TUN-001', 7.00, 3.50, '1234567890128', true),
('Chocolate Chip Cookies', (SELECT id FROM products WHERE name = 'Cookies'), 'COOK-CHC-001', 4.50, 2.25, '1234567890129', true),
('Oatmeal Cookies', (SELECT id FROM products WHERE name = 'Cookies'), 'COOK-OAT-001', 4.50, 2.25, '1234567890130', true),
('Protein Bar - Vanilla', (SELECT id FROM products WHERE name = 'Energy Bar'), 'EBAR-VAN-001', 5.50, 3.00, '1234567890131', true),
('Protein Bar - Chocolate', (SELECT id FROM products WHERE name = 'Energy Bar'), 'EBAR-CHO-001', 5.50, 3.00, '1234567890132', true),

-- Beverages variants
('Coca Cola - 330ml', (SELECT id FROM products WHERE name = 'Coca Cola'), 'COLA-330-001', 2.00, 0.80, '1234567890133', true),
('Coca Cola - 500ml', (SELECT id FROM products WHERE name = 'Coca Cola'), 'COLA-500-001', 2.75, 1.20, '1234567890134', true),
('Coffee - Americano', (SELECT id FROM products WHERE name = 'Coffee'), 'COFF-AME-001', 4.50, 1.50, '1234567890135', true),
('Coffee - Latte', (SELECT id FROM products WHERE name = 'Coffee'), 'COFF-LAT-001', 5.50, 2.00, '1234567890136', true),
('Mineral Water - 500ml', (SELECT id FROM products WHERE name = 'Mineral Water'), 'WATR-500-001', 1.50, 0.60, '1234567890137', true),
('Mineral Water - 1L', (SELECT id FROM products WHERE name = 'Mineral Water'), 'WATR-1L-001', 2.50, 1.00, '1234567890138', true),
('Orange Juice - Fresh', (SELECT id FROM products WHERE name = 'Orange Juice'), 'OJUI-FRE-001', 4.00, 2.00, '1234567890139', true),
('Orange Juice - Bottled', (SELECT id FROM products WHERE name = 'Orange Juice'), 'OJUI-BOT-001', 3.50, 1.75, '1234567890140', true),
('Energy Drink - Regular', (SELECT id FROM products WHERE name = 'Energy Drink'), 'ENDR-REG-001', 3.50, 1.50, '1234567890141', true),
('Energy Drink - Sugar Free', (SELECT id FROM products WHERE name = 'Energy Drink'), 'ENDR-SF-001', 3.75, 1.60, '1234567890142', true),

-- Electronics variants
('USB Cable - Type C', (SELECT id FROM products WHERE name = 'USB Cable'), 'USB-TC-001', 12.00, 5.00, '1234567890143', true),
('USB Cable - Micro USB', (SELECT id FROM products WHERE name = 'USB Cable'), 'USB-MU-001', 10.00, 4.00, '1234567890144', true),
('Phone Charger - iPhone', (SELECT id FROM products WHERE name = 'Phone Charger'), 'CHG-IPH-001', 25.00, 12.00, '1234567890145', true),
('Phone Charger - Android', (SELECT id FROM products WHERE name = 'Phone Charger'), 'CHG-AND-001', 20.00, 10.00, '1234567890146', true),
('Bluetooth Headphones - Over Ear', (SELECT id FROM products WHERE name = 'Bluetooth Headphones'), 'BT-HE-001', 85.00, 45.00, '1234567890147', true),
('Bluetooth Headphones - In Ear', (SELECT id FROM products WHERE name = 'Bluetooth Headphones'), 'BT-IE-001', 55.00, 30.00, '1234567890148', true),
('Power Bank - 10000mAh', (SELECT id FROM products WHERE name = 'Power Bank'), 'PB-10K-001', 35.00, 18.00, '1234567890149', true),
('Power Bank - 20000mAh', (SELECT id FROM products WHERE name = 'Power Bank'), 'PB-20K-001', 55.00, 28.00, '1234567890150', true),
('Screen Protector - iPhone', (SELECT id FROM products WHERE name = 'Screen Protector'), 'SP-IPH-001', 15.00, 6.00, '1234567890151', true),
('Screen Protector - Android', (SELECT id FROM products WHERE name = 'Screen Protector'), 'SP-AND-001', 12.00, 5.00, '1234567890152', true),

-- Personal Care variants
('Toothbrush - Soft', (SELECT id FROM products WHERE name = 'Toothbrush'), 'TB-SOF-001', 3.50, 1.50, '1234567890153', true),
('Toothbrush - Medium', (SELECT id FROM products WHERE name = 'Toothbrush'), 'TB-MED-001', 3.50, 1.50, '1234567890154', true),
('Shampoo - 250ml', (SELECT id FROM products WHERE name = 'Shampoo'), 'SH-250-001', 8.50, 4.00, '1234567890155', true),
('Shampoo - 500ml', (SELECT id FROM products WHERE name = 'Shampoo'), 'SH-500-001', 14.50, 7.00, '1234567890156', true),
('Hand Sanitizer - 50ml', (SELECT id FROM products WHERE name = 'Hand Sanitizer'), 'HS-50-001', 3.00, 1.20, '1234567890157', true),
('Hand Sanitizer - 250ml', (SELECT id FROM products WHERE name = 'Hand Sanitizer'), 'HS-250-001', 8.50, 4.00, '1234567890158', true),
('Face Mask - Pack of 10', (SELECT id FROM products WHERE name = 'Face Mask'), 'FM-10P-001', 12.00, 6.00, '1234567890159', true),
('Face Mask - Pack of 50', (SELECT id FROM products WHERE name = 'Face Mask'), 'FM-50P-001', 45.00, 25.00, '1234567890160', true),
('Soap - Bar', (SELECT id FROM products WHERE name = 'Soap'), 'SOAP-BAR-001', 2.50, 1.00, '1234567890161', true),
('Soap - Liquid', (SELECT id FROM products WHERE name = 'Soap'), 'SOAP-LIQ-001', 5.50, 2.50, '1234567890162', true),

-- Household Items variants
('Trash Bags - Small (30 pack)', (SELECT id FROM products WHERE name = 'Trash Bags'), 'TB-SM-001', 6.50, 3.00, '1234567890163', true),
('Trash Bags - Large (20 pack)', (SELECT id FROM products WHERE name = 'Trash Bags'), 'TB-LG-001', 8.50, 4.00, '1234567890164', true),
('Paper Towels - 6 rolls', (SELECT id FROM products WHERE name = 'Paper Towels'), 'PT-6R-001', 12.00, 6.00, '1234567890165', true),
('Paper Towels - 12 rolls', (SELECT id FROM products WHERE name = 'Paper Towels'), 'PT-12R-001', 22.00, 11.00, '1234567890166', true),
('Laundry Detergent - 1L', (SELECT id FROM products WHERE name = 'Laundry Detergent'), 'LD-1L-001', 8.50, 4.50, '1234567890167', true),
('Laundry Detergent - 2L', (SELECT id FROM products WHERE name = 'Laundry Detergent'), 'LD-2L-001', 15.00, 8.00, '1234567890168', true),
('Light Bulb - LED 9W', (SELECT id FROM products WHERE name = 'Light Bulb'), 'LB-9W-001', 12.00, 6.00, '1234567890169', true),
('Light Bulb - LED 15W', (SELECT id FROM products WHERE name = 'Light Bulb'), 'LB-15W-001', 18.00, 9.00, '1234567890170', true),
('Batteries - AA (4 pack)', (SELECT id FROM products WHERE name = 'Batteries'), 'BAT-AA-001', 8.00, 4.00, '1234567890171', true),
('Batteries - AAA (4 pack)', (SELECT id FROM products WHERE name = 'Batteries'), 'BAT-AAA-001', 8.50, 4.25, '1234567890172', true),

-- Office Supplies variants
('Notebook - A4 Lined', (SELECT id FROM products WHERE name = 'Notebook'), 'NB-A4L-001', 5.50, 2.50, '1234567890173', true),
('Notebook - A5 Blank', (SELECT id FROM products WHERE name = 'Notebook'), 'NB-A5B-001', 4.00, 2.00, '1234567890174', true),
('Pen Set - Blue (10 pack)', (SELECT id FROM products WHERE name = 'Pen Set'), 'PS-BLU-001', 8.50, 4.00, '1234567890175', true),
('Pen Set - Black (10 pack)', (SELECT id FROM products WHERE name = 'Pen Set'), 'PS-BLK-001', 8.50, 4.00, '1234567890176', true),
('Stapler - Standard', (SELECT id FROM products WHERE name = 'Stapler'), 'ST-STD-001', 15.00, 8.00, '1234567890177', true),
('Stapler - Heavy Duty', (SELECT id FROM products WHERE name = 'Stapler'), 'ST-HD-001', 25.00, 13.00, '1234567890178', true),
('Paper Clips - Small (100 pack)', (SELECT id FROM products WHERE name = 'Paper Clips'), 'PC-SM-001', 3.50, 1.50, '1234567890179', true),
('Paper Clips - Large (50 pack)', (SELECT id FROM products WHERE name = 'Paper Clips'), 'PC-LG-001', 4.50, 2.00, '1234567890180', true),
('Sticky Notes - Yellow', (SELECT id FROM products WHERE name = 'Sticky Notes'), 'SN-YEL-001', 4.50, 2.00, '1234567890181', true),
('Sticky Notes - Multi Color', (SELECT id FROM products WHERE name = 'Sticky Notes'), 'SN-MC-001', 6.00, 3.00, '1234567890182', true);

-- Now create inventory records for all variants with realistic stock levels
INSERT INTO inventory (variant_id, quantity) 
SELECT 
    pv.id,
    CASE 
        WHEN pv.price < 5 THEN FLOOR(RANDOM() * 100 + 50)::integer  -- High stock for cheap items
        WHEN pv.price < 20 THEN FLOOR(RANDOM() * 50 + 20)::integer  -- Medium stock for mid-range items
        ELSE FLOOR(RANDOM() * 20 + 5)::integer                      -- Lower stock for expensive items
    END as quantity
FROM product_variants pv;

-- Create some discount examples
INSERT INTO discounts (name, discount_type, value, applies_to, active, starts_at, ends_at) VALUES
('Student Discount', 'percentage', 10.00, 'global', true, NOW(), NOW() + INTERVAL '30 days'),
('Buy 2 Get 1 Free Chips', 'percentage', 33.33, 'product', true, NOW(), NOW() + INTERVAL '7 days'),
('Happy Hour Coffee', 'fixed_amount', 1.00, 'category', true, NOW(), NOW() + INTERVAL '14 days'),
('Weekend Special', 'percentage', 15.00, 'global', true, NOW(), NOW() + INTERVAL '2 days'),
('Bulk Purchase Discount', 'percentage', 5.00, 'global', true, NOW(), NOW() + INTERVAL '60 days');

-- Create a sample user profile for testing (owner role)
INSERT INTO profiles (id, email, role) VALUES 
('00000000-0000-0000-0000-000000000001', 'owner@postest.com', 'owner'),
('00000000-0000-0000-0000-000000000002', 'cashier@postest.com', 'cashier'),
('00000000-0000-0000-0000-000000000003', 'warehouse@postest.com', 'warehouse_admin');