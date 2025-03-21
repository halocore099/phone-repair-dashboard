const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const https = require('https');
const fs = require('fs');
const { authenticate, authorize, hashPassword, comparePassword, generateToken, REGISTRATION_TOKEN } = require('./auth');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const options = {
  key: fs.readFileSync('/var/www/clients/client1/web48/home/c334458admin/backend/key.pem'),
  cert: fs.readFileSync('/var/www/clients/client1/web48/home/c334458admin/backend/cert.pem')
};

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

// Connect to the database
db.connect((err) => {
  if (err) {
    console.error('Database connection failed:', err);
    return;
  }
  console.log('Connected to the database');
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


// Add a new device (protected route)
app.post('/devices', authenticate, authorize(['Read&Write', 'Sudo']), (req, res) => {
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

  Promise.all(
    repairs.map(repair => 
      new Promise((resolve, reject) => {
        const query = ` 
          INSERT INTO device_repairs (device_id, repair_type_id, price, sku) 
          VALUES (?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE price = VALUES(price), sku = VALUES(sku)
        `;
        db.query(query, [device_id, repair.repair_type_id, repair.price, repair.sku], (err, result) => {
          if (err) {
            console.error('Error in repair operation:', err);
            reject(err);
          }
          else resolve(result);
        });
      })
    )
  )
  .then(() => {
    res.json({ message: 'Repairs updated successfully' });
  })
  .catch(error => {
    console.error('Error updating repairs:', error);
    res.status(500).json({ error: 'Failed to update repairs' });
  });
});

app.put('/devices/:device_id/repairs/:repair_type_id', authenticate, authorize('Read&Write'), (req, res) => {
  const device_id = parseInt(req.params.device_id, 10);
  const repair_type_id = parseInt(req.params.repair_type_id, 10);
  const { price } = req.body;

  const query = 'UPDATE device_repairs SET price = ? WHERE device_id = ? AND repair_type_id = ?';
  db.query(query, [price, device_id, repair_type_id], (err, result) => {
    if (err) {
      console.error('Error updating repair for device:', err);
      return res.status(500).json({ error: 'Failed to update repair for device' });
    }
    res.json({ message: 'Repair updated successfully' });
  });
});


app.delete('/devices/:device_id/repairs/:repair_type_id', authenticate, authorize('Read&Write'), (req, res) => {
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


// Start the server
const PORT = process.env.PORT || 3001;
https.createServer(options, app).listen(PORT, () => {
  console.log(`Server running on https://localhost:${PORT}`);
});  


app.get('/users', authenticate, authorize('Sudo'), (req, res) => {
  const query = 'SELECT id, username, role FROM users';
  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch users' });
    }
    res.json(results);
  });
});


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