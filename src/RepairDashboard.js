import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { useTheme } from 'next-themes';
import { Card, CardHeader, CardTitle, CardContent } from './components/ui/Card';
import Button from './components/ui/Button';
import Input from './components/ui/Input';
import { Plus, Edit, Eye, Trash2, Moon, Sun } from 'lucide-react';

const RepairDashboard = () => {
  const ThemeToggle = () => {
    const { theme, setTheme } = useTheme();
    return (
      <Button
        variant="outline"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className="ml-2"
      >
        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      </Button>
    );
  };

  const [devices, setDevices] = useState([]);
  const [adminError, setAdminError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [repairTypes, setRepairTypes] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [selectedDevices, setSelectedDevices] = useState([]);
  const [newDevice, setNewDevice] = useState({
    device_name: "",
    brand: ""
  });
  
  

  const handleExportCSV = async () => {
    if (selectedDevices.length === 0) return;
  
    const devicesWithRepairs = await Promise.all(
      selectedDevices.map(async (deviceId) => {
        const device = devices.find(d => d.device_id === deviceId);
        const repairResponse = await axios.get(`https://k98j70.meinserver.io:3001/devices/${deviceId}/repairs`);
        return repairResponse.data.map(repair => ({
          ID: device.device_id,
          'Device Name': device.device_name,
          Brand: device.brand,
          'Repair Type': repair.repair_type,
          Price: repair.price
        }));
      })
    );
  
    // Add this function to help with registration
const registerAdmin = async () => {
  try {
    const response = await axios.post('https://k98j70.meinserver.io:3001/register-admin', {
      email: adminEmail,
      password: adminPassword 
    });
    console.log('Registration successful:', response.data); 
    // Now try the delete operation again
    await confirmDeviceDeletion();
  } catch (error) {
    setAdminError('Registration failed: ' + error.response?.data?.error || error.message);
  }
};


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
  

  const handleExportExcel = async () => {
    if (selectedDevices.length === 0) return;
  
    const devicesWithRepairs = await Promise.all(
      selectedDevices.map(async (deviceId) => {
        const device = devices.find(d => d.device_id === deviceId);
        const repairResponse = await axios.get(`https://k98j70.meinserver.io:3001/devices/${deviceId}/repairs`);
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
    
    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(flattenedData, {
      header: ['ID', 'Device Name', 'Brand', 'Repair Type', 'Price']
    });
  
    // Format the Price column to show two decimal places
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    const priceCol = 4; // 0-based index for Price column
    for (let row = range.s.r + 1; row <= range.e.r; row++) {
      const cell = worksheet[XLSX.utils.encode_cell({ r: row, c: priceCol })];
      if (cell && cell.v) {
        cell.z = '€#,##0.00'; // Apply currency format
      }
    }
  
    // Add the worksheet to the workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, "Repairs");
  
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    XLSX.writeFile(workbook, `device-repairs-${timestamp}.xlsx`);
  };

    const loadDevices = async () => {
    try {
      const response = await axios.get('https://k98j70.meinserver.io:3001/devices');
      setDevices(response.data);
    } catch (error) {
      console.error('Error loading devices:', error);
    }
  };

  const handleDeviceSelect = (deviceId) => {
    setSelectedDevices(prev => {
      if (prev.includes(deviceId)) {
        return prev.filter(id => id !== deviceId);
      }
      return [...prev, deviceId];
    });
  };
  

  useEffect(() => {
    loadDevices();
  }, []);

  const filteredDevices = devices.filter(
    device =>
      device.device_name.toLowerCase().includes(searchTerm.toLowerCase()) &&
      (brandFilter ? device.brand === brandFilter : true)
  );
    const [adminEmail, setAdminEmail] = useState('');
    const [adminPassword, setAdminPassword] = useState('');
    const [showAdminModal, setShowAdminModal] = useState(false);

    const handleDeleteDevice = async (deviceId) => {
      try {
        const confirmDelete = window.confirm('Are you sure you want to delete this device and all its repairs?');
  
        if (confirmDelete) {
          setShowAdminModal(true);
          setSelectedDevice({ device_id: deviceId });
        }
      } catch (error) {
        console.error('Error deleting device:', error);
        alert('Failed to delete device. Please try again.');
      }
    };
    // Enhanced admin authentication handling
    const confirmDeviceDeletion = async () => {
      try {
        setAdminError('');

        if (!adminEmail || !adminPassword) {
          setAdminError('Email and password are required');
          return;
        }

        const headers = {
          'Content-Type': 'application/json',
          'adminEmail': adminEmail,
          'adminPassword': adminPassword
        };

        let response;
        if (selectedDevices.length > 0) {
          response = await axios.delete(`https://k98j70.meinserver.io:3001/devices/batch`, {
            data: { deviceIds: selectedDevices },
            headers
          });
        } else {
          response = await axios.delete(
            `https://k98j70.meinserver.io:3001/devices/${selectedDevice.device_id}`,
            { headers }
          );
        }
    

        if (response.data) {
          await loadDevices();
          setShowAdminModal(false);
          setAdminEmail('');
          setAdminPassword('');
          setSelectedDevices([]);
          setSelectedDevice(null);
        }

      } catch (error) {
        setAdminError(error.response?.data?.error || 'Authentication failed');
        console.error('Delete Operation Failed:', {
          timestamp: new Date().toISOString(),
          error: error.response?.data || error.message,
          status: error.response?.status
        });
      }
    };
    
    
    // Enhanced admin modal component
    const AdminModal = () => (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-full max-w-md">
          <h2 className="text-xl mb-4 dark:text-white">Admin Authentication Required</h2>
          <div className="space-y-4">
            <Input
              placeholder="Admin Email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              className="w-full dark:bg-gray-700 dark:text-white"
              required
            />
            <Input
              type="password"
              placeholder="Admin Password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              className="w-full dark:bg-gray-700 dark:text-white"
              required
            />
            {adminError && (
              <div className="text-red-500 text-sm">{adminError}</div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAdminModal(false)}>
                Cancel
              </Button>
              <Button onClick={confirmDeviceDeletion}>
                Confirm Delete
              </Button>
            </div>
          </div>
        </div>
      </div>
    );

    {showAdminModal && <AdminModal />}
  const handleAddDevice = async () => {
    try {
      const response = await axios.post('https://k98j70.meinserver.io:3001/devices', newDevice);
      setDevices([
        ...devices,
        {
          device_id: response.data.device_id,
          ...newDevice,
          repair_count: 0 // Initialize with 0 repairs
        }
      ]);
      setNewDevice({ device_name: "", brand: "" });
      setShowAddDevice(false);
    } catch (error) {
      console.error('Error adding device:', error);
    }
  };

  const handleSaveRepairs = async (deviceId, repairs) => {
    try {
      await axios.put(`https://k98j70.meinserver.io:3001/devices/${deviceId}/repairs`, { repairs });

      setDevices(devices.map(device =>
        device.device_id === deviceId ? { ...device, repairs } : device
      ));
    } catch (error) {
      console.error('Error saving repairs:', error);
    }
  };


  const handleMassDelete = async () => {
    if (selectedDevices.length === 0) return;
    
    const confirmDelete = window.confirm(`Are you sure you want to delete ${selectedDevices.length} devices and their repairs?`);
    
    if (confirmDelete) {
      setShowAdminModal(true);
    }
  };
  

  const handleRemoveRepair = async (deviceId, repairId) => {
    try {
      await axios.delete(`https://k98j70.meinserver.io:3001/devices/${deviceId}/repairs/${repairId}`);

      setDevices(devices.map(device => {
        if (device.device_id === deviceId) {
          return {
            ...device,
            repairs: device.repairs.filter(repair => repair.repair_type_id !== repairId)
          };
        }
        return device;
      }));
    } catch (error) {
      console.error('Error removing repair:', error);
    }
  };

  const ViewModal = ({ device, onClose }) => {
    const [repairs, setRepairs] = useState([]);
  
    useEffect(() => {
      const fetchRepairs = async () => {
        try {
          const response = await axios.get(`https://k98j70.meinserver.io:3001/devices/${device.device_id}/repairs`);
          setRepairs(response.data);
        } catch (error) {
          console.error('Error fetching repairs:', error);
        }
      };
  
      fetchRepairs();
    }, [device.device_id]);
  
    return (      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">
              {device.device_name} - {device.brand} (ID: {device.device_id})
            </h2>
            <Button variant="ghost" onClick={onClose}>×</Button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-300">Repair Type</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-300">Price</th>
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
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {repairs.map((repair) => {
                  const price = parseFloat(repair.price);
                  return (
                    <tr key={repair.repair_type_id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">{repair.repair_type}</td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                        €{!isNaN(price) ? price.toFixed(2) : '0.00'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                        <input
                          type="checkbox"
                          checked={selectedDevices.includes(device.device_id)}
                          onChange={() => handleDeviceSelect(device.device_id)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };
        const REPAIR_CATEGORIES = {
          G: 'Allgemein',
          D: 'Display',
          L: 'Laufwerke',
          F: 'Festplatten',
          R: 'RAM',
          N: 'Netzteil',
          Z: 'Zubehör',
          S: 'Software',
          A: 'Analysen',
          O: 'Sonstige Reparaturen'
        };

        const EditModal = ({ device, onClose }) => {
          const [editedRepairs, setEditedRepairs] = useState([]);
          const [selectedRepairType, setSelectedRepairType] = useState(null);
          const [repairTypes, setRepairTypes] = useState([]);
          const [searchTerm, setSearchTerm] = useState('');

          useEffect(() => {
            const fetchRepairTypes = async () => {
              try {
                const response = await axios.get('https://k98j70.meinserver.io:3001/repairtypes');
                setRepairTypes(response.data);
              } catch (error) {
                console.error('Error fetching repair types:', error);
              }
            };

            fetchRepairTypes();
          }, []);
  
          useEffect(() => {
            const fetchRepairs = async () => {
              try {
                const response = await axios.get(`https://k98j70.meinserver.io:3001/devices/${device.device_id}/repairs`);
                setEditedRepairs(response.data);
              } catch (error) {
                console.error('Error fetching repairs:', error);
              }
            };

            fetchRepairs();
          }, [device.device_id]);

          const handleAddRepair = () => {
            if (selectedRepairType) {
              const newRepair = {
                repair_type_id: selectedRepairType.repair_type_id,
                repair_type: selectedRepairType.repair_type,
                price: selectedRepairType.price,
              };
              setEditedRepairs([...editedRepairs, newRepair]);
              setSelectedRepairType(null);
            }
          };

          const handleSave = async () => {
            try {
              const formattedRepairs = editedRepairs.map(repair => ({
                repair_type_id: repair.repair_type_id,
                price: repair.price
              }));

              await handleSaveRepairs(device.device_id, formattedRepairs);
              const response = await axios.get('https://k98j70.meinserver.io:3001/devices');
              setDevices(response.data);
              onClose();
            } catch (error) {
              console.error('Error saving repairs:', error);
            }
          };

          const groupedRepairTypes = repairTypes.reduce((acc, repair) => {
            const category = repair.category || 'O';
            if (!acc[category]) {
              acc[category] = [];
            }
            acc[category].push(repair);
            return acc;
          }, {});

          const filteredRepairTypes = repairTypes.filter(repair => 
            repair.repair_type.toLowerCase().includes(searchTerm.toLowerCase())
          );

          return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold">
                    {device.device_name} - {device.brand} (ID: {device.device_id})
                  </h2>
                  <Button variant="ghost" onClick={onClose}>×</Button>
                </div>
                <div className="space-y-4">
                  {editedRepairs.map((repair, index) => (
                    <div key={repair.repair_type_id} className="flex items-center gap-4">
                      <span className="min-w-[200px]">{repair.repair_type}</span>
                      <Input
                        type="number"
                        value={repair.price}
                        onChange={(e) => {
                          const newRepairs = [...editedRepairs];
                          newRepairs[index] = {
                            ...repair,
                            price: parseFloat(e.target.value) || 0
                          };
                          setEditedRepairs(newRepairs);
                        }}
                        className="w-32"
                      />
                      <Button variant="outline" onClick={() => handleRemoveRepair(device.device_id, repair.repair_type_id)}>
                        Remove
                      </Button>
                    </div>
                  ))}
                    <div className="flex items-center gap-4">
                      <div className="relative w-full">
                        <Input
                          type="text"
                          placeholder="Search or select repair type..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full mb-0"
                        />
                        <div className="mt-1 w-full max-h-60 overflow-y-auto border rounded-md bg-white dark:bg-gray-900">
                          {Object.entries(REPAIR_CATEGORIES).map(([category, categoryName]) => {
                            const repairs = filteredRepairTypes.filter(repair => repair.category === category);
                            if (repairs.length === 0) return null;
                          
                            return (
                              <div key={category} className="p-2">
                                <div className="font-medium text-gray-700 dark:text-gray-300">
                                  {category} - {categoryName}
                                </div>
                                {repairs.map(repair => (
                                  <div
                                    key={repair.repair_type_id}
                                    className="pl-4 py-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                                    onClick={() => {
                                      setSelectedRepairType(repair);
                                      setSearchTerm('');
                                    }}
                                  >
                                    {repair.repair_type} - €{repair.price}
                                  </div>
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <Button onClick={handleAddRepair}>Add Repair</Button>
                    </div>
                  <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave}>Save Changes</Button>
                  </div>
                </div>
              </div>
            </div>
          );
        };
    
    return (
      <div className="p-4 space-y-4">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center mb-4">
              <CardTitle>Phone Repair Management Dashboard</CardTitle>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <Button
                  onClick={() => setShowAddDevice(!showAddDevice)}
                  className="flex items-center gap-2"
                >
                  <Plus size={16} />
                  Add Device
                </Button>
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
                className="border p-2 rounded"
              >
                <option value="">All Brands</option>
                {[...new Set(devices.map(device => device.brand))].map(brand => (
                  brand && <option key={brand} value={brand}>{brand}</option>
                ))}
              </select>
              <span className="text-sm text-gray-600 dark:text-gray-300 self-center">
                Total Devices: {devices.length}
              </span>
            </div>
          </CardHeader>
          {selectedDevices.length > 0 && (
            <div className="bg-gray-50 p-4 mb-4 flex items-center justify-between">
              <span className="text-sm text-gray-700">
                {selectedDevices.length} device(s) selected
              </span>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={handleExportCSV}
                  className="flex items-center gap-2"
                >
                  Export CSV
                </Button>
                <Button
                    variant="outline"
                    onClick={handleExportExcel}
                    className="flex items-center gap-2"
                >
                  Export Excel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleMassDelete}
                  className="flex items-center gap-2"
                >
                  Delete Selected
                </Button>
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
                            setSelectedDevices(filteredDevices.map(d => d.device_id))
                          } else {
                            setSelectedDevices([])
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
                        <Button 
                          variant="outline" 
                          onClick={() => handleDeleteDevice(device.device_id)}
                        >
                          <Trash2 size={16} />
                        </Button>

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
        
        {showAdminModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-wh ite p-6 rounded-lg">
              <h2 className="text-xl mb-4">Admin Authentication</h2>
              <Input
                placeholder="Admin Email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="mb-2"
              />
              <Input
                type="password" 
                placeholder="Admin Password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="mb-4"
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowAdminModal(false)}>Cancel</Button>
                <Button onClick={confirmDeviceDeletion}>Confirm Delete</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

export default RepairDashboard;
