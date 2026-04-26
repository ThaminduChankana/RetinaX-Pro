import axios from 'axios';
import { API_BASE_URL, API_TOKEN } from '../config';

const client = axios.create({ baseURL: API_BASE_URL, timeout: 120000 });

export async function loginUser(email, password) {
  const { data } = await client.post('/api/login', { email, password });
  return data;
}

export async function registerUser(fields) {
  const { data } = await client.post('/api/register', fields);
  return data;
}

export async function sendContact(name, email, message) {
  const { data } = await client.post('/api/contact', { name, email, message });
  return data;
}

export async function analyzeImage(image, patientData) {
  const form = new FormData();
  // Send raw base64 so the server always gets a clean JPEG regardless of device format.
  // Also include the file URI as fallback for older server versions.
  if (image.base64) {
    form.append('image_b64', image.base64);
  } else {
    form.append('image', {
      uri:  image.uri,
      name: image.name || 'scan.jpg',
      type: 'image/jpeg',
    });
  }
  form.append('name',          patientData.name);
  form.append('age',           patientData.age);
  form.append('gender',        patientData.gender);
  form.append('contactNumber', patientData.contactNumber);

  const { data } = await client.post('/api/analyze', form, {
    headers: { 'Content-Type': 'multipart/form-data', 'X-RNX-Token': API_TOKEN },
  });
  return data;
}
