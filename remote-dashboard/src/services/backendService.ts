import axios from 'axios';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

// Get all orders from the backend
export async function getAllOrders() {
  try {
    const response = await axios.get(`${BACKEND_URL}/api/orders`);
    // Map id to _id for compatibility with frontend
    return response.data.map((order: any) => ({
      ...order,
      _id: order.id,
    }));
  } catch (error) {
    console.error('Error getting orders:', error);
    throw error;
  }
}

// Get order by ID
export async function getOrder(id: string) {
  try {
    const response = await axios.get(`${BACKEND_URL}/api/orders/${id}`);
    return { ...response.data, _id: response.data.id };
  } catch (error) {
    console.error(`Error getting order ${id}:`, error);
    throw error;
  }
}

// Get all customers
export async function getAllCustomers() {
  try {
    const response = await axios.get(`${BACKEND_URL}/api/customers`);
    return response.data.map((customer: any) => ({
      ...customer,
      _id: customer.id,
    }));
  } catch (error) {
    console.error('Error getting customers:', error);
    throw error;
  }
}

// Get customer by ID
export async function getCustomer(id: string) {
  try {
    const response = await axios.get(`${BACKEND_URL}/api/customers/${id}`);
    return { ...response.data, _id: response.data.id };
  } catch (error) {
    console.error(`Error getting customer ${id}:`, error);
    throw error;
  }
}

// Get all menu items
export async function getAllMenuItems() {
  try {
    const response = await axios.get(`${BACKEND_URL}/api/menu-items`);
    return response.data.map((item: any) => ({
      ...item,
      _id: item.id,
    }));
  } catch (error) {
    console.error('Error getting menu items:', error);
    throw error;
  }
}

// Get menu item by ID
export async function getMenuItem(id: string) {
  try {
    const response = await axios.get(`${BACKEND_URL}/api/menu-items/${id}`);
    return { ...response.data, _id: response.data.id };
  } catch (error) {
    console.error(`Error getting menu item ${id}:`, error);
    throw error;
  }
}

// Get all categories
export async function getAllCategories() {
  try {
    const response = await axios.get(`${BACKEND_URL}/api/categories`);
    return response.data.map((category: any) => ({
      ...category,
      _id: category.id,
    }));
  } catch (error) {
    console.error('Error getting categories:', error);
    throw error;
  }
}

// Get all settings
export async function getAllSettings() {
  try {
    const response = await axios.get(`${BACKEND_URL}/api/settings`);
    return response.data;
  } catch (error) {
    console.error('Error getting settings:', error);
    throw error;
  }
}

// Get setting by key
export async function getSetting(key: string) {
  try {
    const response = await axios.get(`${BACKEND_URL}/api/settings/${key}`);
    return response.data;
  } catch (error) {
    console.error(`Error getting setting ${key}:`, error);
    throw error;
  }
}

// Check backend health
export async function checkBackendHealth() {
  try {
    const response = await axios.get(`${BACKEND_URL}/api/health`);
    return response.data;
  } catch (error) {
    console.error('Backend health check failed:', error);
    throw error;
  }
}

export { BACKEND_URL };
