const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const crypto = require('crypto'); // Add this for password hashing

// Initialize express app
const app = express();
app.use(cors());
app.use(express.json());

// MySQL database connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'repair_dashboard'
});

// Connect to the database
db.connect((err) => {
  if (err) {
    console.error('Database connection failed:', err);
    return;
  }
  console.log('Connected to the database');
});
  const verifyAdmin = (req, res, next) => {
    const adminEmail = req.headers['adminemail'];
    const adminPassword = req.headers['adminpassword'];

    console.log('Received Headers:', {
      timestamp: new Date().toISOString(),
      adminEmail,
      adminPasswordLength: adminPassword?.length || 0
    });

    if (!adminEmail || !adminPassword) {
      return res.status(401).json({ 
        error: 'Admin credentials required',
        missing: {
          email: !adminEmail,
          password: !adminPassword
        }
      });
    }

    const hashedPassword = crypto.createHash('sha256').update(adminPassword).digest('hex');

    console.log('Hashed Password:', hashedPassword);

    const query = 'SELECT * FROM admins WHERE email = ? AND password = ?';

    db.query(query, [adminEmail, hashedPassword], (err, results) => {
      if (err) {
        console.error('Database Query Error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      console.log('Query Results:', {
        resultsCount: results.length,
        results: results
      });
    
      if (results.length === 0) {
        return res.status(401).json({ 
          error: 'Invalid admin credentials',
          details: {
            email: adminEmail,
            hashedPassword: hashedPassword
          }
        });
      }
    
      next();
    });
};// Add a new repair type
app.post('/repairtypes', (req, res) => {
  const { repair_type } = req.body;

  if (!repair_type) {
    return res.status(400).json({ error: 'Repair type is required' });
  }

  const query = 'INSERT INTO repairtypes (repair_type) VALUES (?)';
  db.query(query, [repair_type], (err, result) => {
    if (err) {
      console.error('Error adding repair type:', err);
      return res.status(500).json({ error: 'Failed to add repair type' });
    }
    res.status(201).json({
      message: 'Repair type added successfully',
      repair_type_id: result.insertId
    });
  });
});
// Update a repair type
app.put('/repairtypes/:id', (req, res) => {
  const { repair_type, price } = req.body;
  const id = parseInt(req.params.id);

  const query = 'UPDATE repairtypes SET repair_type = ?, price = ? WHERE repair_type_id = ?';
  db.query(query, [repair_type, price, id], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to update repair type' });
    }
    res.json({ message: 'Repair type updated successfully' });
  });
});

// Delete a repair type
app.delete('/repairtypes/:id', verifyAdmin, (req, res) => {
  const id = parseInt(req.params.id);

  const query = 'DELETE FROM repairtypes WHERE repair_type_id = ?';
  db.query(query, [id], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to delete repair type' });
    }
    res.json({ message: 'Repair type deleted successfully' });
  });
});

// Get all repair types
app.get('/repairtypes', (req, res) => {
  const query = 'SELECT * FROM repairtypes';

  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching repair types:', err);
      return res.status(500).json({ error: 'Failed to fetch repair types' });
    }
    res.json(results);
  });
});
// Get all devices with their repairs
app.get('/devices', (req, res) => {
  const { search, limit = 20, offset = 0, brand } = req.query;

  let query = `
    SELECT 
      devices.device_id, 
      devices.device_name, 
      devices.brand, 
      COUNT(device_repairs.repair_type_id) as repair_count
    FROM 
      devices
    LEFT JOIN 
      device_repairs ON devices.device_id = device_repairs.device_id
  `;

  if (search) {
    query += ` WHERE devices.device_name LIKE ? OR devices.brand LIKE ?`;
  }
  if (brand) {
    query += search ? ` AND` : ` WHERE`;
    query += ` devices.brand = ?`;
  }

  query += ` GROUP BY 
    devices.device_id, 
    devices.device_name, 
    devices.brand
    LIMIT ? OFFSET ?
  `;

  const queryParams = [];
  if (search) {
    queryParams.push(`%${search}%`, `%${search}%`);
  }
  if (brand) {
    queryParams.push(brand);
  }
  queryParams.push(parseInt(limit), parseInt(offset));

  db.query(query, queryParams, (err, results) => {
    if (err) {
      console.error('Error fetching devices:', err);
      return res.status(500).json({ error: 'Failed to fetch devices' });
    }
    res.json(results);
  });
});

// Add a new device
app.post('/devices', (req, res) => {
  const { device_name, brand } = req.body;
  const query = 'INSERT INTO devices (device_name, brand) VALUES (?, ?)';

  db.query(query, [device_name, brand], (err, result) => {
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

// Update device repairs
app.put('/devices/:device_id/repairs', (req, res) => {
  const { device_id } = req.params;
  const { repairs } = req.body;

  const deleteQuery = 'DELETE FROM device_repairs WHERE device_id = ?';

  db.query(deleteQuery, [device_id], (deleteErr) => {
    if (deleteErr) {
      console.error('Error deleting existing repairs:', deleteErr);
      return res.status(500).json({ error: 'Failed to update repairs' });
    }

    if (!repairs || repairs.length === 0) {
      return res.json({ message: 'Repairs updated successfully' });
    }

    const values = repairs.map(repair => [
      device_id,
      repair.repair_type_id,
      repair.price
    ]);

    const insertQuery = 'INSERT INTO device_repairs (device_id, repair_type_id, price) VALUES ?';

    db.query(insertQuery, [values], (insertErr) => {
      if (insertErr) {
        console.error('Error inserting new repairs:', insertErr);
        return res.status(500).json({ error: 'Failed to update repairs' });
      }

      res.json({ message: 'Repairs updated successfully' });
    });
  });
});

// Remove a specific repair from a device
app.delete('/devices/:device_id/repairs/:repair_type_id', (req, res) => {
  const device_id = parseInt(req.params.device_id, 10);
  const repair_type_id = parseInt(req.params.repair_type_id, 10);

  const query = 'DELETE FROM device_repairs WHERE device_id = ? AND repair_type_id = ?';

  db.query(query, [device_id, repair_type_id], (err, result) => {
    if (err) {
      console.error('Error removing repair:', err);
      return res.status(500).json({
        error: 'Failed to remove repair',
        details: err.message
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: 'Repair not found',
        message: 'No repair matched the given device and repair type'
      });
    }

    res.json({
      message: 'Repair removed successfully',
      device_id: device_id,
      repair_type_id: repair_type_id
    });
  });
});

app.delete('/devices/batch', verifyAdmin, (req, res) => {
  const { deviceIds } = req.body;
  
  if (!deviceIds || !Array.isArray(deviceIds) || deviceIds.length === 0) {
    return res.status(400).json({ error: 'Valid device IDs array is required' });
  }

  // First delete repairs
  const deleteRepairsQuery = 'DELETE FROM device_repairs WHERE device_id IN (?)';
  db.query(deleteRepairsQuery, [deviceIds], (deleteRepairsErr) => {
    if (deleteRepairsErr) {
      console.error('Error deleting repairs:', deleteRepairsErr);
      return res.status(500).json({ error: 'Failed to delete device repairs' });
    }

    // Then delete devices
    const deleteDevicesQuery = 'DELETE FROM devices WHERE device_id IN (?)';
    db.query(deleteDevicesQuery, [deviceIds], (deleteDevicesErr, result) => {
      if (deleteDevicesErr) {
        console.error('Error deleting devices:', deleteDevicesErr);
        return res.status(500).json({ error: 'Failed to delete devices' });
      }

      res.json({
        message: 'Devices deleted successfully',
        deletedCount: result.affectedRows
      });
    });
  });
});
// Delete a device and its associated repairs
app.delete('/devices/:device_id', verifyAdmin, (req, res) => {
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

// Get repairs for a specific device
app.get('/devices/:device_id/repairs', (req, res) => {
  const device_id = parseInt(req.params.device_id, 10);

  const query = `
    SELECT
      dr.repair_type_id,
      rt.repair_type,
      dr.price
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

// Add this endpoint to help with admin registration
app.post('/register-admin', (req, res) => {
  const { email, password } = req.body; 
  const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
  
  console.log('Registering admin with:', {
    email,
    hashedPassword
  });

  const query = 'INSERT INTO admins (email, password) VALUES (?, ?)';
  db.query(query, [email, hashedPassword], (err, result) => {
    if (err) {
      console.error('Admin registration error:', err);
      return res.status(500).json({ error: 'Failed to register admin' });
    }
    res.status(201).json({ 
      message: 'Admin registered successfully',
      hashedPassword // Sending back for verification
    });
  });
});

// Start the serverww
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Enhanced admin aut hentication endpoint
app.post('/admin/login', (req, res) => {
  const { email, password } = req.body;
  
  console.log('Login attempt:', {
    timestamp: new Date().toISOString(),
    email,
    hasPassword: !!password
  });

  const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
  const query = 'SELECT * FROM admins WHERE email = ? AND password = ?';

  db.query(query, [email, hashedPassword], (err, results) => {
    if (err) {
      console.error('Database error during login:', {
        error: err.message,
        code: err.code,
        timestamp: new Date().toISOString()
      });
      return res.status(500).json({
        error: 'Login failed',
        details: 'Database error occurred',
        code: err.code
      });
    }

    if (results.length === 0) {
      return res.status(401).json({
        error: 'Authentication failed',
        details: 'Invalid email or password'
      });
    }

    res.json({ 
      success: true, 
      message: 'Login successful',
      adminId: results[0].id
    });
  });  
});


app.post('/repairtypes', (req, res) => {
  const { repair_type, code } = req.body;

  if (!repair_type) {
    return res.status(400).json({ error: 'Repair type is required' });
  }

  const query = 'INSERT INTO repairtypes (repair_type, code) VALUES (?, ?)';
  db.query(query, [repair_type, code], (err, result) => {
    if (err) {
      console.error('Error adding repair type:', err);
      return res.status(500).json({ error: 'Failed to add repair type' });
    }
    res.status(201).json({
      message: 'Repair type added successfully',
      repair_type_id: result.insertId
    });
  });
});

app.post('/repairtypes/batch', (req, res) => {
  const { repair_types } = req.body;

  if (!repair_types || !Array.isArray(repair_types)) {
    return res.status(400).json({ error: 'Array of repair types is required' });
  }

  const values = repair_types.map(item => [item.repair_type, item.code]);
  const query = 'INSERT INTO repairtypes (repair_type, code) VALUES ?';

  db.query(query, [values], (err, result) => {
    if (err) {
      console.error('Error adding repair types:', err);
      return res.status(500).json({ error: 'Failed to add repair types' });
    }
    res.status(201).json({
      message: 'Repair types added successfully',
      insertedCount: result.affectedRows
    });
  });
});

app.post('/devices/batch', (req, res) => {
  const { devices } = req.body;

  if (!devices || !Array.isArray(devices)) {
    return res.status(400).json({ error: 'Array of devices is required' });
  }

  const values = devices.map(device => [device.device_name, device.brand]);
  const query = 'INSERT INTO devices (device_name, brand) VALUES ?';

  db.query(query, [values], (err, result) => {
    if (err) {
      console.error('Error adding devices:', err);
      return res.status(500).json({ error: 'Failed to add devices' });
    }
    res.status(201).json({
      message: 'Devices added successfully',
      insertedCount: result.affectedRows
    });
  });
});

app.post('/device-repairs/batch', (req, res) => {
  const { device_repairs } = req.body;

  if (!device_repairs || !Array.isArray(device_repairs)) {
    return res.status(400).json({ error: 'Array of device repairs is required' });
  }

  const values = device_repairs.map(repair => [
    repair.device_id,
    repair.repair_type_id,
    repair.price
  ]);

  const query = 'INSERT INTO device_repairs (device_id, repair_type_id, price) VALUES ?';

  db.query(query, [values], (err, result) => {
    if (err) {
      console.error('Error adding device repairs:', err);
      return res.status(500).json({ error: 'Failed to add device repairs' });
    }
    res.status(201).json({
      message: 'Device repairs added successfully',
      insertedCount: result.affectedRows
    });
  });
});
