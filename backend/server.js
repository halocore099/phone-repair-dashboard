const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');

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

// Delete a device and its associated repairs
app.delete('/devices/:device_id', (req, res) => {
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

// Start the server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
