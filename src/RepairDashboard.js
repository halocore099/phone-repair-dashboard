import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { useTheme } from 'next-themes';
import { Card, CardHeader, CardTitle, CardContent } from './components/ui/Card';
import Button from './components/ui/Button';
import Input from './components/ui/Input';
import { Plus, Edit, Eye, Trash2, Moon, Sun, ChevronDown } from 'lucide-react';

const RepairDashboard = () => {
  const { theme, setTheme } = useTheme();
  const [devices, setDevices] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [selectedDevices, setSelectedDevices] = useState([]);
  const [newDevice, setNewDevice] = useState({ device_name: "", brand: "", device_type: "" });
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [totalRepairs, setTotalRepairs] = useState(0);
  const [deviceTypeFilter, setDeviceTypeFilter] = useState('');

  // Theme Toggle Component
  const ThemeToggle = () => (
    <Button
      variant="outline"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="ml-2"
    >
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </Button>
  );


  // Login Handler
  const handleLogin = async () => {
    try {

      const token = localStorage.getItem('token');
      const response = await axios.post('https://k98j70.meinserver.io/login', { username, password }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      localStorage.setItem('token', response.data.token);
      setUserRole(response.data.role);
      setIsLoggedIn(true);
    } catch (error) {
      console.error('Login failed:', error);
      alert('Invalid username or password.');
    }
  };
  const handleLoginKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  const triggerServerEventWithIframe = () => {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = 'https://k98j70.meinserver.io:3002/debug-sync';
    document.body.appendChild(iframe);

    // Remove the iframe after it has loaded
    iframe.onload = () => {
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    };
  };


  // Logout Handler
  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsLoggedIn(false);
    setUserRole('');
  };

  // Load Devices from API
  const loadDevices = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setIsLoggedIn(false);
        return;
      }
      const response = await axios.get('https://k98j70.meinserver.io/devices', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDevices(response.data);

      // Calculate total repairs
      const totalRepairCount = response.data.reduce((sum, device) =>
        sum + (device.repair_count || 0), 0);
      setTotalRepairs(totalRepairCount);
    } catch (error) {
      console.error('Error loading devices:', error);
      if (error.response?.status === 401) {
        setIsLoggedIn(false);
      }
    }
  };

  // Handle Device Selection
  const handleDeviceSelect = (deviceId) => {
    setSelectedDevices(prev => {
      if (prev.includes(deviceId)) {
        return prev.filter(id => id !== deviceId);
      }
      return [...prev, deviceId];
    });
  };

  // Handle Export to CSV
  const handleExportCSV = async () => {
    if (selectedDevices.length === 0) return;

    const devicesWithRepairs = await Promise.all(
      selectedDevices.map(async (deviceId) => {
        const device = devices.find(d => d.device_id === deviceId);
        const token = localStorage.getItem('token');
        const repairResponse = await axios.get(`https://k98j70.meinserver.io/devices/${deviceId}/repairs`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        return repairResponse.data.map(repair => ({
          ID: device.device_id,
          'Device Name': device.device_name,
          Brand: device.brand,
          'Repair Type': repair.repair_type,
          Price: repair.price
        }));
      })
    );

    const flattenedData = devicesWithRepairs.flat();
    const csvContent = [
      ['ID', 'Device Name', 'Brand', 'Repair Type', 'Price'].join(','),
      ...flattenedData.map(row => [
        row.ID,
        row['Device Name'],
        row.Brand,
        row['Repair Type'],
        row.Price
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    link.href = URL.createObjectURL(blob);
    link.download = `device-repairs-${timestamp}.csv`;
    link.click();
  };

  // Handle Export to Excel
  const handleExportExcel = async () => {
    if (selectedDevices.length === 0) return;

    const devicesWithRepairs = await Promise.all(
      selectedDevices.map(async (deviceId) => {
        const device = devices.find(d => d.device_id === deviceId);
        const token = localStorage.getItem('token');
        const repairResponse = await axios.get(`https://k98j70.meinserver.io/devices/${deviceId}/repairs`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        return repairResponse.data.map(repair => ({
          ID: device.device_id,
          'Device Name': device.device_name,
          Brand: device.brand,
          'Repair Type': repair.repair_type,
          Price: parseFloat(repair.price).toFixed(2)
        }));
      })
    );

    const flattenedData = devicesWithRepairs.flat();
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(flattenedData, {
      header: ['ID', 'Device Name', 'Brand', 'Repair Type', 'Price']
    });

    XLSX.utils.book_append_sheet(workbook, worksheet, "Repairs");
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    XLSX.writeFile(workbook, `device-repairs-${timestamp}.xlsx`);
  };

  // Handle Add Device
  const handleAddDevice = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('https://k98j70.meinserver.io/devices',
        newDevice,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setDevices([...devices, { device_id: response.data.device_id, ...newDevice, repair_count: 0 }]);
      setNewDevice({ device_name: "", brand: "" });
      setShowAddDevice(false);
    } catch (error) {
      console.error('Error adding device:', error);
    }
  };

  // Handle Mass Delete
  const handleMassDelete = async () => {
    if (selectedDevices.length === 0) return;

    const confirmDelete = window.confirm(`Are you sure you want to delete ${selectedDevices.length} devices and their repairs?`);
    if (confirmDelete) {
      try {
        const token = localStorage.getItem('token');
        await axios.delete('https://k98j70.meinserver.io/devices/batch', {
          headers: { Authorization: `Bearer ${token}` },
          data: { deviceIds: selectedDevices }
        });
        await loadDevices();
        setSelectedDevices([]);
      } catch (error) {
        console.error('Error deleting devices:', error);
      }
    }
  };

  // Handle Delete Single Device
  const handleDeleteDevice = async (deviceId) => {
    const confirmDelete = window.confirm('Are you sure you want to delete this device and all its repairs?');
    if (confirmDelete) {
      try {
        const token = localStorage.getItem('token');
        await axios.delete(`https://k98j70.meinserver.io/devices/${deviceId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        await loadDevices();
      } catch (error) {
        console.error('Error deleting device:', error);
      }
    }
  };

  // View Modal Component
  const ViewModal = ({ device, onClose }) => {
    const [repairs, setRepairs] = useState([]);

    useEffect(() => {
      const fetchRepairs = async () => {
        try {
          const token = localStorage.getItem('token');
          const response = await axios.get(`https://k98j70.meinserver.io/devices/${device.device_id}/repairs`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setRepairs(response.data);
        } catch (error) {
          console.error('Error fetching repairs:', error);
        }
      };

      fetchRepairs();
    }, [device.device_id]);

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">
              {device.device_name} - {device.brand} (ID: {device.device_id})
            </h2>
            <Button variant="ghost" onClick={onClose}>×</Button>
          </div>

          <div className="flex-1 overflow-y-auto mb-4 pr-2">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-300">Repair Type</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-300">Price</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {repairs.map((repair) => (
                  <tr key={repair.repair_type_id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">{repair.repair_type}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                      €{!isNaN(repair.price) ? parseFloat(repair.price).toFixed(2) : '0.00'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        </div>
      </div>
    );
  };

  // Edit Modal Component
  const REPAIR_CATEGORIES = {
    'A': 'Analysen',
    'D': 'Display',
    'F': 'Festplatten',
    'G': 'Allgemein',
    'L': 'Laufwerke',
    'N': 'Netzteil',
    'O': 'Sonstige Reparaturen',
    'R': 'RAM',
    'S': 'Software',
    'Z': 'Zubehör',
  };


  const EditModal = ({ device, onClose }) => {
    const [editedRepairs, setEditedRepairs] = useState([]);
    const [selectedRepairType, setSelectedRepairType] = useState(null);
    const [repairTypes, setRepairTypes] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Fetch repair types
    useEffect(() => {
      const fetchRepairTypes = async () => {
        try {
          const token = localStorage.getItem('token');
          const response = await axios.get('https://k98j70.meinserver.io/repairtypes', {
            headers: { Authorization: `Bearer ${token}` }
          });
          setRepairTypes(response.data);
        } catch (error) {
          console.error('Error fetching repair types:', error);
        }
      };
      fetchRepairTypes();
    }, []);

    // Fetch repairs
    useEffect(() => {
      const fetchRepairs = async () => {
        try {
          const token = localStorage.getItem('token');
          const response = await axios.get(`https://k98j70.meinserver.io/devices/${device.device_id}/repairs`, {
            headers: { Authorization: `Bearer ${token}` }
          });

          // Don't process the SKUs, just use them as they are
          setEditedRepairs(response.data);
        } catch (error) {
          console.error('Error fetching repairs:', error);
        }
      };

      if (repairTypes.length > 0) {
        fetchRepairs();
      }
    }, [device.device_id, repairTypes]);

    const handleSKUChange = (repairTypeId, skuValue) => {
      setEditedRepairs(prev =>
        prev.map(repair =>
          repair.repair_type_id === repairTypeId
            ? { ...repair, sku: skuValue }
            : repair
        )
      );
    };

    const handlePriceChange = (repairTypeId, newPrice) => {
      setEditedRepairs(prev =>
        prev.map(repair =>
          repair.repair_type_id === repairTypeId
            ? { ...repair, price: parseFloat(newPrice) || 0 }
            : repair
        )
      );
    };

    const handleAddRepair = () => {
      if (selectedRepairType && !editedRepairs.some(r => r.repair_type_id === selectedRepairType.repair_type_id)) {
        const newRepair = {
          repair_type_id: selectedRepairType.repair_type_id,
          repair_type: selectedRepairType.repair_type,
          price: selectedRepairType.price || 0,
          sku: "",
        };
        setEditedRepairs([...editedRepairs, newRepair]);
        setSelectedRepairType(null);
        setSearchTerm('');
      } else if (selectedRepairType) {
        alert('This repair type already exists for this device');
      } else {
        setSearchTerm(' '); // Show dropdown if nothing selected
      }
    };

    const handleRemoveRepair = async (deviceId, repairTypeId) => {
      try {
        const token = localStorage.getItem('token');
        await axios.delete(
          `https://k98j70.meinserver.io/devices/${deviceId}/repairs/${repairTypeId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        setEditedRepairs(prev => prev.filter(repair => repair.repair_type_id !== repairTypeId));
      } catch (error) {
        console.error('Error removing repair:', error);
        alert(`Error: ${error.response?.data?.error || error.message}`);
      }
    };

    const handleSave = async () => {
      setIsSaving(true);
      try {
        const token = localStorage.getItem('token');
        const repairsToSave = editedRepairs.map(repair => {
          return {
            repair_type_id: repair.repair_type_id,
            price: repair.price,
            sku: repair.sku || "" // Just use the SKU as entered, no prefix or suffix
          };
        });

        await axios.put(
          `https://k98j70.meinserver.io/devices/${device.device_id}/repairs`,
          { repairs: repairsToSave },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        alert('Repairs updated successfully');
        onClose();
      } catch (error) {
        console.error('Error saving repairs:', error);
        alert('Failed to save repairs. Please try again.');
      } finally {
        setIsSaving(false);
      }
    };

    const groupedRepairTypes = Object.entries(
      repairTypes.reduce((acc, repair) => {
        const category = repair.category || 'O';
        if (!acc[category]) {
          acc[category] = {
            name: repair.category_name || 'Other Repairs',
            repairs: []
          };
        }
        acc[category].repairs.push(repair);
        return acc;
      }, {})
    );

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">
              {device.device_name} - {device.brand} (ID: {device.device_id})
            </h2>
            <Button variant="ghost" onClick={onClose}>×</Button>
          </div>

          {/* Scrollable repairs list */}
          <div className="flex-1 overflow-y-auto mb-4 pr-2">
            {editedRepairs.map((repair) => {
              return (
                <div key={`${repair.repair_type_id}-${device.device_id}`} className="p-3 border rounded dark:border-gray-700 mb-2">
                  <div className="flex items-center gap-4">
                    <span className="min-w-[200px]">{repair.repair_type}</span>
                    <Input
                      type="number"
                      value={repair.price}
                      onChange={(e) => handlePriceChange(repair.repair_type_id, e.target.value)}
                      className="w-32"
                      step="0.01"
                    />
                    <Button
                      variant="outline"
                      onClick={() => handleRemoveRepair(device.device_id, repair.repair_type_id)}
                    >
                      Remove
                    </Button>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span>SKU:</span>
                    <Input
                      type="text"
                      placeholder="Enter SKU"
                      value={repair.sku || ""}
                      onChange={(e) => handleSKUChange(repair.repair_type_id, e.target.value)}
                      className="w-48"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Search and dropdown */}
          <div className="relative mb-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  type="text"
                  placeholder="Search repair types..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full"
                />
                <button
                  type="button"
                  onClick={() => setSearchTerm(searchTerm ? '' : ' ')}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1"
                >
                  <ChevronDown size={20} className="text-gray-500" />
                </button>
                {(searchTerm || searchTerm === ' ') && (
                  <div className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto border rounded-md bg-white dark:bg-gray-900 shadow-lg">
                    {groupedRepairTypes.map(([category, data]) => {
                      const filteredRepairs = data.repairs.filter(repair =>
                        repair.repair_type.toLowerCase().includes(searchTerm.toLowerCase())
                      );
                      if (filteredRepairs.length === 0) return null;

                      return (
                        <div key={category} className="p-2">
                          <div className="font-medium text-gray-700 dark:text-gray-300">
                            {category} - {data.name}
                          </div>
                          {filteredRepairs.map(repair => (
                            <div
                              key={repair.repair_type_id}
                              className="pl-4 py-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                              onClick={() => {
                                setSelectedRepairType(repair);
                                setSearchTerm(repair.repair_type);
                              }}
                            >
                              {repair.repair_type} - €{repair.price}
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <Button
                onClick={handleAddRepair}
                className="rounded-full w-10 h-10 p-0 flex items-center justify-center"
              >
                <Plus size={20} />
              </Button>
            </div>
          </div>

          {/* Footer buttons */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const AdminModal = ({ onClose }) => {
    const [users, setUsers] = useState([]);
    const [changes, setChanges] = useState({});
    const [showAddUser, setShowAddUser] = useState(false);
    const [newUser, setNewUser] = useState({ username: '', password: '', role: 'Read' });
    const roles = ['Read', 'Read&Write', 'Sudo'];

    useEffect(() => {
      const fetchUsers = async () => {
        const token = localStorage.getItem('token');
        const response = await axios.get('https://k98j70.meinserver.io/users', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUsers(response.data);
      };
      fetchUsers();
    }, []);

    const handleAddUser = async () => {
      try {
        const token = localStorage.getItem('token');
        const registrationToken = process.env.REACT_APP_REGISTRATION_TOKEN;

        await axios.post(
          'https://k98j70.meinserver.io/register',
          {
            username: newUser.username,
            password: newUser.password,
            role: newUser.role,
            registrationToken
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const response = await axios.get('https://k98j70.meinserver.io/users', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUsers(response.data);
        setNewUser({ username: '', password: '', role: 'Read' });
        setShowAddUser(false);
        alert('User created successfully!');
      } catch (error) {
        console.error('Error adding user:', error);
        alert('Failed to create user. Please check your permissions and try again.');
      }
    };

    const handleRoleChange = (userId, newRole) => {
      setChanges({ ...changes, [userId]: newRole });
    };

    const handleSaveChanges = async () => {
      const token = localStorage.getItem('token');
      for (const [userId, role] of Object.entries(changes)) {
        await axios.put(
          `https://k98j70.meinserver.io/users/${userId}/role`,
          { role },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
      onClose();
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Admin Panel - User Management</h2>
            <Button variant="ghost" onClick={onClose}>×</Button>
          </div>

          <div className="mb-4">
            <Button
              onClick={() => setShowAddUser(!showAddUser)}
              className="flex items-center gap-2"
            >
              <Plus size={16} />
              Add New User
            </Button>
          </div>

          {showAddUser && (
            <div className="mb-4 p-4 border rounded-lg dark:border-gray-700">
              <div className="grid grid-cols-3 gap-4">
                <Input
                  type="text"
                  placeholder="Username"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  className="w-full dark:bg-gray-700 dark:text-white"
                />
                <Input
                  type="password"
                  placeholder="Password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full dark:bg-gray-700 dark:text-white"
                />
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="border p-2 rounded dark:bg-gray-700"
                >
                  {roles.map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end mt-4">
                <Button onClick={handleAddUser}>Create User</Button>
              </div>
            </div>
          )}

          <div className="overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                <tr>
                  <th className="px-6 py-3 text-left">Username</th>
                  <th className="px-6 py-3 text-left">Role</th>
                </tr>
              </thead>
            </table>
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <tbody>
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4">{user.username}</td>
                    <td className="px-6 py-4">
                      <select
                        value={changes[user.id] || user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        className="border p-2 rounded dark:bg-gray-700"
                      >
                        {roles.map(role => (
                          <option key={role} value={role}>{role}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSaveChanges}>Save Changes</Button>
          </div>
        </div>
      </div>
    );
  };

  const filteredDevices = devices.filter(device => {
    const deviceName = device.device_name ? device.device_name.toLowerCase() : '';
    const searchTermLower = searchTerm ? searchTerm.toLowerCase() : '';
    const deviceBrand = device.brand || '';
    const deviceType = device.device_type || '';

    return (
      deviceName.includes(searchTermLower) &&
      (brandFilter ? deviceBrand === brandFilter : true) &&
      (deviceTypeFilter ? deviceType === deviceTypeFilter : true)
    );
  });


  // Load Devices on Component Mount
  useEffect(() => {
    if (isLoggedIn) {
      loadDevices();
    }
  }, [isLoggedIn]);

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Login to Repair Dashboard</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyPress={handleLoginKeyPress}
                className="w-full dark:bg-gray-700 dark:text-white"
              />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={handleLoginKeyPress}
                className="w-full dark:bg-gray-700 dark:text-white"
              />
              <Button onClick={handleLogin} className="w-full">
                Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main Dashboard
  return (
    <div className="p-4 space-y-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center mb-4">
            <CardTitle>Repair Management Dashboard</CardTitle>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              {userRole === 'Sudo' && (
                <Button
                  onClick={triggerServerEventWithIframe}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  Push Changes
                </Button>
              )}
              <Button
                onClick={handleLogout}
                variant="outline"
                className="flex items-center gap-2"
              >
                Logout
              </Button>
              {userRole === 'Sudo' && (
                <Button
                  onClick={() => setIsAdminModalOpen(true)}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  Admin Panel
                </Button>
              )}
              {(userRole === 'Read&Write' || userRole === 'Sudo') && (
                <Button
                  onClick={() => setShowAddDevice(!showAddDevice)}
                  className="flex items-center gap-2"
                >
                  <Plus size={16} />
                  Add Device
                </Button>

              )}
            </div>
          </div>
          <div className="flex gap-4">
            <Input
              placeholder="Search devices..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
            <select
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
              className="border p-2 rounded dark:bg-gray-700 dark:text-white dark:border-gray-600"
            >
              <option value="">All Brands</option>
              {[...new Set(devices.map(device => device.brand))].map(brand => (
                brand && <option key={brand} value={brand} className="dark:bg-gray-700">{brand}</option>
              ))}
            </select>
            <select
              value={deviceTypeFilter}
              onChange={(e) => setDeviceTypeFilter(e.target.value)}
              className="border p-2 rounded dark:bg-gray-700 dark:text-white dark:border-gray-600"
            >
              <option value="">All Types</option>
              {[...new Set(devices
                .map(device => device.device_type)
                .filter(type => type && type.trim() !== '')
              )].map(type => (
                <option key={type} value={type} className="dark:bg-gray-700">
                  {type}
                </option>
              ))}
            </select>
            <span className="text-sm text-gray-600 dark:text-gray-300 self-center">
              Total Devices: {devices.length}
            </span>
            <span className="text-sm text-gray-600 dark:text-gray-300 self-center">
              Total Repairs: {totalRepairs}
            </span>
          </div>
        </CardHeader>
        {selectedDevices.length > 0 && (
          <div className="bg-gray-50 dark:bg-gray-800 p-4 mb-4 flex items-center justify-between border dark:border-gray-700 rounded-lg">
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {selectedDevices.length} Device(s) selected
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleExportCSV}
                className="flex items-center gap-2 dark:hover:bg-gray-700 dark:text-gray-300"
              >
                Export CSV
              </Button>
              <Button
                variant="outline"
                onClick={handleExportExcel}
                className="flex items-center gap-2 dark:hover:bg-gray-700 dark:text-gray-300"
              >
                Export Excel
              </Button>
              {userRole === 'Sudo' && (
                <Button
                  variant="destructive"
                  onClick={handleMassDelete}
                  className="flex items-center gap-2"
                >
                  Delete Selected
                </Button>
              )}
            </div>
          </div>
        )}
        <CardContent>
          {showAddDevice && (
            <div className="mb-4 flex gap-2">
              <Input
                placeholder="Device Name"
                value={newDevice.device_name}
                onChange={(e) => setNewDevice({ ...newDevice, device_name: e.target.value })}
              />
              <Input
                placeholder="Brand"
                value={newDevice.brand}
                onChange={(e) => setNewDevice({ ...newDevice, brand: e.target.value })}
              />
              <select
                value={newDevice.device_type || ''}
                onChange={(e) => setNewDevice({ ...newDevice, device_type: e.target.value })}
                className="border p-2 rounded dark:bg-gray-700"
              >
                <option value="">Select Type</option>
                {[...new Set(devices
                  .map(device => device.device_type)
                  .filter(type => type && type.trim() !== '')
                )].map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <Button onClick={handleAddDevice}>Save Device</Button>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-300">
                    <input
                      type="checkbox"
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedDevices(filteredDevices.map(d => d.device_id));
                        } else {
                          setSelectedDevices([]);
                        }
                      }}
                      checked={selectedDevices.length === filteredDevices.length}
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-300">ID</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-300">Device</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-300">Brand</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-300">Repairs</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredDevices.map((device) => (
                  <tr key={device.device_id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                      <input
                        type="checkbox"
                        checked={selectedDevices.includes(device.device_id)}
                        onChange={() => handleDeviceSelect(device.device_id)}
                      />
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">{device.device_id}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">{device.device_name}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">{device.brand}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                      {device.repair_count !== undefined
                        ? `${device.repair_count} Repair(s)`
                        : "No repairs"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                      <Button
                        variant="outline"
                        className="mr-2"
                        onClick={() => {
                          setSelectedDevice(device);
                          setIsViewModalOpen(true);
                        }}
                      >
                        <Eye size={16} />
                      </Button>
                      {(userRole === 'Read&Write' || userRole === 'Sudo') && (
                        <Button
                          variant="outline"
                          className="mr-2"
                          onClick={() => {
                            setSelectedDevice(device);
                            setIsEditModalOpen(true);
                          }}
                        >
                          <Edit size={16} />
                        </Button>
                      )}
                      {userRole === 'Sudo' && (
                        <Button
                          variant="outline"
                          onClick={() => handleDeleteDevice(device.device_id)}
                        >
                          <Trash2 size={16} />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {isViewModalOpen && selectedDevice && (
        <ViewModal device={selectedDevice} onClose={() => setIsViewModalOpen(false)} />
      )}
      {isEditModalOpen && selectedDevice && (
        <EditModal device={selectedDevice} onClose={() => setIsEditModalOpen(false)} />
      )}
      {isAdminModalOpen && userRole === 'Sudo' && (
        <AdminModal onClose={() => setIsAdminModalOpen(false)} />
      )}
    </div>
  );
};

export default RepairDashboard;