const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const { authenticate, authorize, hashPassword, comparePassword, generateToken, REGISTRATION_TOKEN } = require('./auth');
require('dotenv').config();

const PORT = process.env.PORT || 3001;

const app = express();
app.use(cors());
app.use(express.json());


// Replace your current db connection with this:
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 10000, // 10 seconds
  acquireTimeout: 10000, // 10 seconds
  timeout: 60000, // 60 seconds
});

// Add error handling
db.on('error', (err) => {
  console.error('Database error:', err);
  if (err.code === 'PROTOCOL_CONNECTION_LOST') {
    // Handle connection loss
  } else {
    throw err;
  }
});



// User Registration endpoint
app.post('/register', authenticate, authorize('Sudo'), (req, res) => {
  const { username, password, role, registrationToken } = req.body;

  if (registrationToken !== REGISTRATION_TOKEN) {
    return res.status(403).json({ error: 'Invalid registration token.' });
  }

  hashPassword(password).then((hashedPassword) => {
    const query = 'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)';
    db.query(query, [username, hashedPassword, role], (err, result) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to register user.' });
      }
      res.status(201).json({ message: 'User registered successfully.' });
    });
  });
});


// User Login endpoint
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  const query = 'SELECT * FROM users WHERE username = ?';
  db.query(query, [username], async (err, results) => {
    if (err || results.length === 0) {
      return res.status(400).json({ error: 'Invalid username or password.' });
    }

    const user = results[0];
    const validPassword = await comparePassword(password, user.password_hash);

    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid username or password.' });
    }

    const token = generateToken(user);
    res.json({ token, role: user.role });
  });
});


// Get all devices (protected route)
app.get('/devices', authenticate, (req, res) => {
  const { search, brand } = req.query;

  let query = `
    SELECT 
      devices.device_id, 
      devices.device_name, 
      devices.brand,
      devices.device_type, 
      COUNT(device_repairs.repair_type_id) as repair_count
    FROM 
      devices
    LEFT JOIN 
      device_repairs ON devices.device_id = device_repairs.device_id
  `;

  const queryParams = []; // Declare this first
  
  // Build WHERE clauses conditionally
  if (search) {
    query += ` WHERE (devices.device_name LIKE ? OR devices.brand LIKE ?)`;
    queryParams.push(`%${search}%`, `%${search}%`);
  }
  
  if (brand) {
    query += search ? ` AND` : ` WHERE`;
    query += ` devices.brand = ?`;
    queryParams.push(brand);
  }

  query += ` GROUP BY 
    devices.device_id, 
    devices.device_name, 
    devices.brand
  `;


  db.query(query, queryParams, (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      console.error('Full query:', query);
      console.error('Query parameters:', queryParams);
      return res.status(500).json({ 
        error: 'Database query failed',
        details: err.message 
      });
    }
    res.json(results);
  });
});


app.post('/devices', authenticate, authorize(['Read&Write', 'Sudo']), (req, res) => {
  const { device_name, brand, device_type } = req.body;
  const query = 'INSERT INTO devices (device_name, brand, device_type) VALUES (?, ?, ?)';

  db.query(query, [device_name, brand, device_type], (err, result) => {
    if (err) {
      console.error('Error adding device:', err); 
      return res.status(500).json({ error: 'Failed to add device' });
    }
    res.status(201).json({
      message: 'Device added successfully',
      device_id: result.insertId
    });
  });
});

// Delete a device (protected route, requires Sudo role)
app.delete('/devices/:device_id', authenticate, authorize('Sudo'), (req, res) => {
  const device_id = parseInt(req.params.device_id, 10);

  const deleteRepairsQuery = 'DELETE FROM device_repairs WHERE device_id = ?';
  db.query(deleteRepairsQuery, [device_id], (deleteRepairsErr) => {
    if (deleteRepairsErr) {
      console.error('Error deleting device repairs:', deleteRepairsErr);
      return res.status(500).json({ error: 'Failed to delete device repairs' });
    }

    const deleteDeviceQuery = 'DELETE FROM devices WHERE device_id = ?';
    db.query(deleteDeviceQuery, [device_id], (deleteDeviceErr, result) => {
      if (deleteDeviceErr) {
        console.error('Error deleting device:', deleteDeviceErr);
        return res.status(500).json({ error: 'Failed to delete device' });
      }

      if (result.affectedRows === 0) {  
        return res.status(404).json({
          error: 'Device not found',
          message: 'No device matched the given device ID'
        });
      }

      res.json({
        message: 'Device deleted successfully',
        device_id: device_id
      });
    });
  });
});


// Get repairs for a specific device (protected route)
app.get('/devices/:device_id/repairs', authenticate, (req, res) => {
  const device_id = parseInt(req.params.device_id, 10);

  const query = `
    SELECT
      dr.repair_type_id,
      rt.repair_type,
      dr.price,
      dr.sku
    FROM
      device_repairs dr
    JOIN
      repairtypes rt ON dr.repair_type_id = rt.repair_type_id
    WHERE
      dr.device_id = ?
  `;

  db.query(query, [device_id], (err, results) => {
    if (err) {
      console.error('Error fetching device repairs:', err);
      return res.status(500).json({ error: 'Failed to fetch device repairs' });
    }

    res.json(results);
  });
});

app.get('/repairtypes', authenticate, (req, res) => {
  const query = `
    SELECT 
      repair_type_id,
      repair_type,
      code,
      category,
      category_name
    FROM 
      repairtypes
    ORDER BY 
      category,
      repair_type
  `;



  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching repair types:', err);
      return res.status(500).json({ error: 'Failed to fetch repair types' });
    }
    res.json(results);
  });
});


// POST endpoint for creating new repairs
app.post('/devices/:device_id/repairs', authenticate, authorize(['Read&Write', 'Sudo']), (req, res) => {
  const device_id = parseInt(req.params.device_id, 10);
  const { repair_type_id, price, sku } = req.body;

  const query = `
    INSERT INTO device_repairs (device_id, repair_type_id, price, sku)
    VALUES (?, ?, ?, ?)
  `;

  db.query(query, [device_id, repair_type_id, price, sku], (err, result) => {
    if (err) {
      console.error('Error adding repair:', err);
      return res.status(500).json({ error: 'Failed to add repair' });
    }
    res.status(201).json({ message: 'Repair added successfully' });
  });
});

// PUT endpoint for updating existing repairs
app.put('/devices/:device_id/repairs', authenticate, authorize(['Read&Write', 'Sudo']), (req, res) => {
  const device_id = parseInt(req.params.device_id, 10);
  const { repairs } = req.body;

  const query = `
    INSERT INTO device_repairs 
      (device_id, repair_type_id, price, sku)
    VALUES ?
    ON DUPLICATE KEY UPDATE
      price = VALUES(price),
      sku = VALUES(sku)
  `;

  const values = repairs.map(repair => [
    device_id,
    repair.repair_type_id,
    repair.price,
    repair.sku
  ]);

  db.query(query, [values], (err, result) => {
    if (err) {
      console.error('Error updating repairs:', err);
      return res.status(500).json({ error: 'Failed to update repairs' });
    }
    res.json({ 
      message: 'Repairs updated successfully',
      affectedRows: result.affectedRows
    });
  });
});

// Update this endpoint in server.js
app.put('/devices/:device_id/repairs/:repair_type_id', authenticate, authorize(['Read&Write', 'Sudo']), (req, res) => {
  const device_id = parseInt(req.params.device_id, 10);
  const repair_type_id = parseInt(req.params.repair_type_id, 10);
  const { price, sku } = req.body;

  const query = 'UPDATE device_repairs SET price = ?, sku = ? WHERE device_id = ? AND repair_type_id = ?';
  db.query(query, [price, sku, device_id, repair_type_id], (err, result) => {
    if (err) {
      console.error('Error updating repair for device:', err);
      return res.status(500).json({ error: 'Failed to update repair for device' });
    }
    res.json({ message: 'Repair updated successfully' });
  });
});


app.delete('/devices/:device_id/repairs/:repair_type_id', authenticate, authorize('Sudo'), (req, res) => {
  const device_id = parseInt(req.params.device_id, 10);
  const repair_type_id = parseInt(req.params.repair_type_id, 10);

  const query = 'DELETE FROM device_repairs WHERE device_id = ? AND repair_type_id = ?';
  db.query(query, [device_id, repair_type_id], (err, result) => {
    if (err) {
      console.error('Error removing repair from device:', err);
      return res.status(500).json({ error: 'Failed to remove repair from device' });
    }
    res.json({ message: 'Repair removed successfully' });
  }); 
});


app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});


// Get all users
app.get('/users', authenticate, authorize('Sudo'), (req, res) => {
  const query = 'SELECT id, username, role FROM users';
  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch users' });
    }
    res.json(results);
  });
});


// Update user role
app.put('/users/:userId/role', authenticate, authorize('Sudo'), (req, res) => {
  const { userId } = req.params;
  const { role } = req.body;
  
  const query = 'UPDATE users SET role = ? WHERE id = ?';
  db.query(query, [role, userId], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to update user role' });
    }
    res.json({ message: 'User role updated successfully' });
  });
});

// Add a new repair type (protected route)
app.post('/repairtypes', authenticate, authorize(['Read&Write', 'Sudo']), (req, res) => {
  const { repair_type, code, category, category_name } = req.body;
  
  // Validate required fields
  if (!repair_type || !code || !category) {
    return res.status(400).json({ error: 'Missing required fields. repair_type, code, and category are required.' });
  }
  
  // Validate code length (3 characters)
  if (code.length !== 3) {
    return res.status(400).json({ error: 'Code must be exactly 3 characters.' });
  }
  
  // Validate category (should be a single character)
  if (category.length !== 1) {
    return res.status(400).json({ error: 'Category must be a single character.' });
  }
  
  const query = 'INSERT INTO repairtypes (repair_type, code, category, category_name) VALUES (?, ?, ?, ?)';
  
  db.query(query, [repair_type, code, category, category_name], (err, result) => {
    if (err) {
      console.error('Error adding repair type:', err);
      return res.status(500).json({ 
        error: 'Failed to add repair type',
        details: err.message
      });
    }
    
    res.status(201).json({
      message: 'Repair type added successfully',
      repair_type_id: result.insertId,
      repair_type,
      code,
      category,
      category_name
    });
  });
});

// Add multiple repair types (protected route)
app.post('/repairtypes/batch', authenticate, authorize(['Read&Write', 'Sudo']), (req, res) => {
  const { repair } = req.body;  // Using "repair" as the key as requested
  
  if (!Array.isArray(repair) || repair.length === 0) {
    return res.status(400).json({ error: 'Request must include an array of repair types under the "repair" key' });
  }
  
  // Validate all entries
  for (const item of repair) {
    const { repair_type, code, category } = item;
    
    if (!repair_type || !code || !category) {
      return res.status(400).json({ 
        error: 'Missing required fields. Each entry must have repair_type, code, and category.',
        invalidEntry: item
      });
    }
    
    if (code.length !== 3) {
      return res.status(400).json({ 
        error: 'Code must be exactly 3 characters.',
        invalidEntry: item
      });
    }
    
    if (category.length !== 1) {
      return res.status(400).json({ 
        error: 'Category must be a single character.',
        invalidEntry: item
      });
    }
  }
  
  // Prepare values for bulk insert
  const values = repair.map(item => [
    item.repair_type,
    item.code,
    item.category,
    item.category_name || null
  ]);
  
  const query = 'INSERT INTO repairtypes (repair_type, code, category, category_name) VALUES ?';
  
  db.query(query, [values], (err, result) => {
    if (err) {
      console.error('Error adding repair types:', err);
      return res.status(500).json({ 
        error: 'Failed to add repair types',
        details: err.message
      });
    }
    
    res.status(201).json({
      message: `${result.affectedRows} repair types added successfully`,
      firstInsertId: result.insertId
    });
  });
});

// Delete a user (NEW ENDPOINT - ADD THIS)
app.delete('/users/:userId', authenticate, authorize('Sudo'), (req, res) => {
  const { userId } = req.params;
  
  // Prevent deletion of the current user (optional safety check)
  if (parseInt(userId) === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  
  const query = 'DELETE FROM users WHERE id = ?';
  db.query(query, [userId], (err, result) => {
    if (err) {
      console.error('Error deleting user:', err);
      return res.status(500).json({ error: 'Failed to delete user' });
    }
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ message: 'User deleted successfully' });
  });
});

// Reset user password (protected route, requires Sudo role)
app.put('/users/:userId/password', authenticate, authorize('Sudo'), (req, res) => {
  const { userId } = req.params;
  const { newPassword } = req.body;
  
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }
  
  hashPassword(newPassword).then((hashedPassword) => {
    const query = 'UPDATE users SET password_hash = ? WHERE id = ?';
    db.query(query, [hashedPassword, userId], (err, result) => {
      if (err) {
        console.error('Error updating user password:', err);
        return res.status(500).json({ error: 'Failed to update user password' });
      }
      
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json({ message: 'Password updated successfully' });
    });
  }).catch((error) => {
    console.error('Error hashing password:', error);
    res.status(500).json({ error: 'Failed to process password' });
  });
});