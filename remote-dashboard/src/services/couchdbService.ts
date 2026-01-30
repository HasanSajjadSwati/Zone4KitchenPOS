import axios from 'axios';

const COUCHDB_URL = process.env.COUCHDB_URL || 'http://localhost:5984';
const COUCHDB_USER = process.env.COUCHDB_USER || 'posapp';
const COUCHDB_PASSWORD = process.env.COUCHDB_PASSWORD || 'posapp_password_123';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Determine database name based on environment
const DB_NAME = NODE_ENV === 'production' ? 'pos' : 'pos-dev';
const DB_URL = `${COUCHDB_URL}/${DB_NAME}`;

// Helper to get auth URL
function getAuthURL() {
  if (DB_URL.includes('@')) {
    return DB_URL;
  }
  const [protocol, rest] = DB_URL.split('://');
  return `${protocol}://${COUCHDB_USER}:${COUCHDB_PASSWORD}@${rest}`;
}

// Get all documents from a design document view
export async function queryView(designDoc: string, viewName: string) {
  try {
    const url = `${getAuthURL()}/_design/${designDoc}/_view/${viewName}`;
    const response = await axios.get(url);
    return response.data.rows.map((row: any) => row.value);
  } catch (error) {
    console.error(`Error querying view ${designDoc}/${viewName}:`, error);
    throw error;
  }
}

// Get all documents of a specific type
export async function getAllDocuments(type: string) {
  try {
    const url = `${getAuthURL()}/_find`;
    const response = await axios.post(url, {
      selector: { type: type },
      limit: 10000,
    });
    return response.data.docs;
  } catch (error) {
    console.error(`Error getting documents of type ${type}:`, error);
    throw error;
  }
}

// Get a specific document by ID
export async function getDocument(id: string) {
  try {
    const url = `${getAuthURL()}/${encodeURIComponent(id)}`;
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error(`Error getting document ${id}:`, error);
    throw error;
  }
}

// Create or update a document
export async function saveDocument(doc: any) {
  try {
    const url = `${getAuthURL()}/${encodeURIComponent(doc._id)}`;
    const response = await axios.put(url, doc);
    return { ...doc, _rev: response.data.rev };
  } catch (error) {
    console.error(`Error saving document:`, error);
    throw error;
  }
}

// Delete a document
export async function deleteDocument(id: string, rev: string) {
  try {
    const url = `${getAuthURL()}/${encodeURIComponent(id)}?rev=${rev}`;
    await axios.delete(url);
    return { success: true };
  } catch (error) {
    console.error(`Error deleting document ${id}:`, error);
    throw error;
  }
}

// Query documents by a specific field
export async function queryDocuments(type: string, field: string, value: any) {
  try {
    const url = `${getAuthURL()}/_find`;
    const response = await axios.post(url, {
      selector: {
        type: type,
        [field]: value,
      },
      limit: 10000,
    });
    return response.data.docs;
  } catch (error) {
    console.error(`Error querying documents:`, error);
    throw error;
  }
}

// Get database info
export async function getDatabaseInfo() {
  try {
    const url = getAuthURL();
    const response = await axios.get(url);
    return {
      name: response.data.db_name,
      documentsCount: response.data.doc_count,
      updateSequence: response.data.update_seq,
      compactRunning: response.data.compact_running,
    };
  } catch (error) {
    console.error('Error getting database info:', error);
    throw error;
  }
}

export { DB_NAME, DB_URL };
