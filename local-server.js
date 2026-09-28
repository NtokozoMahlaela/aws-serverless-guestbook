const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'local-data.json');
const FRONTEND_DIR = path.join(__dirname, 'frontend');
const ENVIRONMENT = 'dev';

// GitHub Jobs API Configuration (completely free, no authentication required)
const GITHUB_JOBS_API = 'https://jobs.github.com/api/positions.json';

// Security settings
const MAX_COMPANY = 100;
const MAX_TITLE = 100;
const MAX_LOCATION = 100;
const MAX_SALARY = 50;
const MAX_DESCRIPTION = 1000;
const MAX_CONTACT = 200;
const MAX_JOBS_RETURNED = 100;

const COMPANY_PATTERN = /^[a-zA-Z0-9\s\-\&\'\.]+$/;
const TEXT_PATTERN = /^[\w\s\.\,\!\?\-\@\:\/\(\)\+]+$/;

const app = express();

// Basic middleware
app.use(cors());
app.use(express.json({ limit: '10kb' }));
app.use(express.static(FRONTEND_DIR));

// Add some security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Simple input sanitization
function sanitizeInput(input) {
  let sanitized = input.replace(/<script.*?>.*?<\/script>/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=/gi, '');
  return sanitized.trim();
}

// Validate company name
function validateCompany(company) {
  if (!company || !company.trim()) {
    return { isValid: false, error: 'Company name is required' };
  }
  
  company = company.trim();
  
  if (company.length > MAX_COMPANY) {
    return { isValid: false, error: `Company name must be ${MAX_COMPANY} characters or less` };
  }
  
  if (!COMPANY_PATTERN.test(company)) {
    return { isValid: false, error: 'Company name contains invalid characters' };
  }
  
  return { isValid: true, error: null };
}

// Validate job title
function validateTitle(title) {
  if (!title || !title.trim()) {
    return { isValid: false, error: 'Job title is required' };
  }
  
  title = title.trim();
  
  if (title.length > MAX_TITLE) {
    return { isValid: false, error: `Job title must be ${MAX_TITLE} characters or less` };
  }
  
  return { isValid: true, error: null };
}

// Validate description
function validateDescription(description) {
  if (!description || !description.trim()) {
    return { isValid: false, error: 'Job description is required' };
  }
  
  description = description.trim();
  
  if (description.length > MAX_DESCRIPTION) {
    return { isValid: false, error: `Description must be ${MAX_DESCRIPTION} characters or less` };
  }
  
  return { isValid: true, error: null };
}

// Validate required fields
function validateRequiredFields(data) {
  const required = ['company', 'jobTitle', 'category', 'location', 'jobType', 'description', 'contact'];
  const fieldNames = {
    company: 'Company name',
    jobTitle: 'Job title',
    category: 'Category',
    location: 'Location',
    jobType: 'Job type',
    description: 'Description',
    contact: 'Contact method'
  };

  for (const field of required) {
    if (!data[field] || !data[field].trim()) {
      return { isValid: false, error: `${fieldNames[field]} is required` };
    }
  }

  return { isValid: true, error: null };
}

// Create data file if it doesn't exist
async function initDataFile() {
  try {
    await fs.access(DATA_FILE);
  } catch {
    const initialData = { 
      jobs: [],
      metadata: {
        created: new Date().toISOString(),
        environment: 'dev',
        purpose: 'Local Job Board - Supporting South African employment'
      }
    };
    await fs.writeFile(DATA_FILE, JSON.stringify(initialData, null, 2));
    console.log('Created new data file:', DATA_FILE);
  }
}

// Read jobs from file
async function readJobs() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading data file:', error);
    throw new Error('Failed to read jobs');
  }
}

// Write jobs to file
async function writeJobs(data) {
  try {
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error writing data file:', error);
    throw new Error('Failed to save jobs');
  }
}

// Fetch jobs from GitHub Jobs API (completely free, no authentication)
async function fetchGitHubJobs() {
  try {
    console.log('Fetching jobs from GitHub Jobs API...');
    const response = await axios.get(GITHUB_JOBS_API, {
      timeout: 10000
    });
    
    if (response.data && Array.isArray(response.data)) {
      // Transform GitHub jobs to our format
      const transformedJobs = response.data.map(job => ({
        jobId: `github-${job.id}`,
        company: job.company || 'Unknown Company',
        jobTitle: job.title || 'Untitled Position',
        category: mapGitHubCategory(job.type),
        location: job.location || 'Remote',
        jobType: mapGitHubType(job.type),
        salary: '', // GitHub Jobs doesn't typically include salary
        description: job.description || 'No description available',
        contact: job.url || 'Apply via external link',
        urgency: 'normal',
        source: 'github',
        externalUrl: job.url,
        timestamp: job.created_at || new Date().toISOString()
      }));
      
      console.log(`Fetched ${transformedJobs.length} jobs from GitHub Jobs API`);
      return transformedJobs;
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching GitHub jobs:', error.message);
    // Return empty array on API failure - don't break the app
    return [];
  }
}

// Map GitHub job types to our categories
function mapGitHubCategory(githubType) {
  const categoryMap = {
    'Full Time': 'technology',
    'Contract': 'technology',
    'Part Time': 'retail',
    'Internship': 'education'
  };
  
  return categoryMap[githubType] || 'other';
}

// Map GitHub job types to our job types
function mapGitHubType(githubType) {
  const typeMap = {
    'Full Time': 'full-time',
    'Contract': 'contract',
    'Part Time': 'part-time',
    'Internship': 'internship'
  };
  
  return typeMap[githubType] || 'full-time';
}

// GET /jobs - fetch job postings (local + API)
app.get('/jobs', async (req, res) => {
  try {
    const { source = 'all', category = '', location = '', jobType = '' } = req.query;
    
    let allJobs = [];
    
    // Always fetch local jobs
    const localData = await readJobs();
    const localJobs = (localData.jobs || []).map(job => ({
      ...job,
      source: 'local'
    }));
    allJobs = allJobs.concat(localJobs);
    
    // Fetch API jobs if requested
    if (source === 'all' || source === 'api') {
      const apiJobs = await fetchGitHubJobs();
      allJobs = allJobs.concat(apiJobs);
    }
    
    // Filter jobs based on query parameters
    if (category) {
      allJobs = allJobs.filter(job => job.category.toLowerCase() === category.toLowerCase());
    }
    if (location) {
      allJobs = allJobs.filter(job => job.location.toLowerCase().includes(location.toLowerCase()));
    }
    if (jobType) {
      allJobs = allJobs.filter(job => job.jobType.toLowerCase() === jobType.toLowerCase());
    }
    
    // Sort newest first and limit results
    allJobs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    allJobs = allJobs.slice(0, MAX_JOBS_RETURNED);
    
    console.log(`Retrieved ${allJobs.length} total job postings (${localJobs.length} local, ${allJobs.length - localJobs.length} API)`);
    res.json({ jobs: allJobs });
  } catch (error) {
    console.error('Error retrieving jobs:', error);
    res.status(500).json({ error: 'Failed to load job opportunities' });
  }
});

// POST /jobs - add new job posting (local only)
app.post('/jobs', async (req, res) => {
  try {
    const jobData = req.body;

    // Validate required fields
    const requiredValidation = validateRequiredFields(jobData);
    if (!requiredValidation.isValid) {
      console.warn(`Required field validation failed: ${requiredValidation.error}`);
      return res.status(400).json({ error: requiredValidation.error });
    }

    // Validate specific fields
    const companyValidation = validateCompany(jobData.company);
    if (!companyValidation.isValid) {
      console.warn(`Company validation failed: ${companyValidation.error}`);
      return res.status(400).json({ error: companyValidation.error });
    }

    const titleValidation = validateTitle(jobData.jobTitle);
    if (!titleValidation.isValid) {
      console.warn(`Title validation failed: ${titleValidation.error}`);
      return res.status(400).json({ error: titleValidation.error });
    }

    const descriptionValidation = validateDescription(jobData.description);
    if (!descriptionValidation.isValid) {
      console.warn(`Description validation failed: ${descriptionValidation.error}`);
      return res.status(400).json({ error: descriptionValidation.error });
    }

    // Sanitize and save
    const sanitizedData = {
      company: sanitizeInput(jobData.company),
      jobTitle: sanitizeInput(jobData.jobTitle),
      category: sanitizeInput(jobData.category),
      location: sanitizeInput(jobData.location),
      jobType: sanitizeInput(jobData.jobType),
      salary: jobData.salary ? sanitizeInput(jobData.salary) : '',
      description: sanitizeInput(jobData.description),
      contact: sanitizeInput(jobData.contact),
      urgency: jobData.urgency || 'normal'
    };

    const data = await readJobs();

    const newJob = {
      jobId: Date.now().toString(),
      ...sanitizedData,
      timestamp: new Date().toISOString(),
      environment: 'dev',
      source: 'local'
    };

    data.jobs.unshift(newJob);
    await writeJobs(data);

    console.log(`Job posted: ${newJob.jobId} - ${newJob.jobTitle} at ${newJob.company}`);
    
    res.json({ 
      success: true,
      job: {
        jobId: newJob.jobId,
        jobTitle: newJob.jobTitle,
        company: newJob.company,
        timestamp: newJob.timestamp
      }
    });
  } catch (error) {
    console.error('Error saving job:', error);
    res.status(500).json({ error: 'Failed to post job opportunity' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    environment: 'dev',
    purpose: 'Local Job Board - Supporting South African employment',
    features: ['local job posting', 'GitHub Jobs API integration'],
    timestamp: new Date().toISOString()
  });
});

// Start the server
async function startServer() {
  try {
    await initDataFile();

    app.listen(PORT, () => {
      console.log('\n🚀 Local Job Board server running successfully!');
      console.log(`📍 Server URL: http://localhost:${PORT}`);
      console.log(`📁 Frontend directory: ${FRONTEND_DIR}`);
      console.log(`💾 Data file: ${DATA_FILE}`);
      console.log(`🔒 Security: Input validation and sanitization enabled`);
      console.log(`🌐 API Integration: GitHub Jobs API (completely free, no authentication required)`);
      console.log(`💚 Purpose: Supporting local employment and economic growth`);
      console.log(`\n📝 Open http://localhost:${PORT} in your browser`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
