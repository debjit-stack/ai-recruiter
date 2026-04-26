import axios from 'axios';

// 👇 THE FIX: Standardized to match your page.js setup exactly
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const saveJd = (title, text) => apiClient.post('/jobs', { roleTitle: title, text });

export const uploadCsv = async (file, roleTitle) => {
  const formData = new FormData();
  formData.append('roleTitle', roleTitle); // TEXT GOES FIRST!
  formData.append('csvFile', file);        // FILE GOES SECOND!

  // 👇 THE FIX: Replaced the hardcoded localhost string with the dynamic apiClient
  return apiClient.post('/candidates/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const getCandidates = () => apiClient.get('/candidates');

export const updateCandidateRole = (id, roleTitle) => apiClient.put(`/candidates/${id}/role`, { roleTitle });

export const sendOutreach = (candidateIds) => apiClient.post('/outreach/send', { candidateIds });

export const syncInbox = () => apiClient.post('/outreach/sync'); 

export const deleteCandidates = (candidateIds) => apiClient.post('/candidates/delete', { candidateIds });

export default apiClient;