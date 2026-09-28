// Change this to YOUR_API_URL_HERE when deploying to AWS
const API_BASE = "http://localhost:3000";

// Grab our DOM elements
const form = document.getElementById('jobForm');
const statusEl = document.getElementById('status');
const jobsEl = document.getElementById('jobs');
const submitBtn = document.getElementById('submitBtn');
const descriptionEl = document.getElementById('description');
const counterEl = document.getElementById('counter');

// Filter elements
const filterCategory = document.getElementById('filterCategory');
const filterLocation = document.getElementById('filterLocation');
const filterJobType = document.getElementById('filterJobType');
const filterSalary = document.getElementById('filterSalary');
const filterBtn = document.getElementById('filterBtn');
const clearFiltersBtn = document.getElementById('clearFiltersBtn');

// Source toggle elements
const sourceToggle = document.getElementById('sourceToggle');
const localBtn = document.getElementById('localBtn');
const apiBtn = document.getElementById('apiBtn');
const allBtn = document.getElementById('allBtn');

// Quick search elements
const quickSearch = document.getElementById('quickSearch');
const quickLocation = document.getElementById('quickLocation');
const quickSearchBtn = document.getElementById('quickSearchBtn');

// Stats elements
const totalJobsEl = document.getElementById('totalJobs');
const totalCompaniesEl = document.getElementById('totalCompanies');
const totalCategoriesEl = document.getElementById('totalCategories');
const resultsCountEl = document.getElementById('resultsCount');
const headerJobCountEl = document.getElementById('headerJobCount');
const headerCompanyCountEl = document.getElementById('headerCompanyCount');

// Current source filter
let currentSource = 'all';

// Character counter for the description field
descriptionEl.addEventListener('input', () => {
  counterEl.textContent = `${descriptionEl.value.length}/1000`;
});

// Update the status message with styling
function setStatus(text, className) {
  statusEl.textContent = text;
  statusEl.className = className || '';
}

// Build a single job listing element
function createJobElement(job) {
  const jobDiv = document.createElement('div');
  jobDiv.className = 'job';

  const urgencyClass = `urgency-${job.urgency || 'normal'}`;
  const urgencyText = job.urgency === 'immediate' ? 'Immediate' : 
                      job.urgency === 'urgent' ? 'Urgent' : 'Normal';

  const sourceBadge = job.source === 'api' ? 
    '<span class="source-badge api">External Job</span>' : 
    '<span class="source-badge local">Local Job</span>';

  const contactHtml = job.source === 'api' && job.externalUrl ?
    `<div class="job-contact">
      <strong>Apply:</strong> <a href="${job.externalUrl}" target="_blank" rel="noopener noreferrer">View on external site</a>
    </div>` :
    `<div class="job-contact">
      <strong>Apply:</strong> ${job.contact}
    </div>`;

  jobDiv.innerHTML = `
    <div class="job-header">
      <div>
        <div class="job-title">${job.jobTitle}</div>
        <div class="job-company">${job.company}</div>
      </div>
      <div class="job-badges">
        <span class="urgency-badge ${urgencyClass}">${urgencyText}</span>
        ${sourceBadge}
      </div>
    </div>
    
    <div class="job-meta">
      <span class="job-meta-item">Location: ${job.location}</span>
      <span class="job-meta-item">Type: ${job.jobType}</span>
      <span class="job-meta-item">Industry: ${job.category}</span>
      ${job.salary ? `<span class="job-meta-item">Salary: ${job.salary}</span>` : ''}
    </div>
    
    <div class="job-description">${job.description}</div>
    
    ${contactHtml}
    
    <div class="job-posted">
      Posted: ${new Date(job.timestamp).toLocaleDateString()}
    </div>
  `;

  return jobDiv;
}

// Show all jobs or empty state
function displayJobs(jobs) {
  jobsEl.replaceChildren();

  if (!jobs || jobs.length === 0) {
    const message = currentSource === 'local' ? 
      'No local job opportunities yet. Be the first to post and help our community grow!' :
      currentSource === 'api' ?
      'No external jobs found. Try different filters or check back later.' :
      'No job opportunities found. Try adjusting your filters or post a local job!';
    
    jobsEl.innerHTML = `<p class="empty">${message}</p>`;
    resultsCountEl.textContent = '0';
    return;
  }

  jobs.forEach(job => {
    jobsEl.appendChild(createJobElement(job));
  });
  
  resultsCountEl.textContent = jobs.length;
}

// Update statistics
function updateStats(jobs) {
  if (!jobs || jobs.length === 0) {
    totalJobsEl.textContent = '0';
    totalCompaniesEl.textContent = '0';
    totalCategoriesEl.textContent = '0';
    headerJobCountEl.textContent = '0';
    headerCompanyCountEl.textContent = '0';
    return;
  }

  const uniqueCompanies = new Set(jobs.map(job => job.company));
  const uniqueCategories = new Set(jobs.map(job => job.category));

  totalJobsEl.textContent = jobs.length;
  totalCompaniesEl.textContent = uniqueCompanies.size;
  totalCategoriesEl.textContent = uniqueCategories.size;
  headerJobCountEl.textContent = jobs.length;
  headerCompanyCountEl.textContent = uniqueCompanies.size;
}

// Filter jobs based on criteria
function filterJobs(jobs) {
  const category = filterCategory.value.toLowerCase();
  const location = filterLocation.value.toLowerCase();
  const jobType = filterJobType.value.toLowerCase();
  const salaryRange = filterSalary.value;
  const quickSearchTerm = quickSearch.value.toLowerCase();
  const quickLocationTerm = quickLocation.value.toLowerCase();

  return jobs.filter(job => {
    const matchCategory = !category || job.category.toLowerCase() === category;
    const matchLocation = !location || job.location.toLowerCase().includes(location);
    const matchJobType = !jobType || job.jobType.toLowerCase() === jobType;
    const matchQuickLocation = !quickLocationTerm || job.location.toLowerCase().includes(quickLocationTerm);
    const matchQuickSearch = !quickSearchTerm || 
                           job.jobTitle.toLowerCase().includes(quickSearchTerm) ||
                           job.company.toLowerCase().includes(quickSearchTerm) ||
                           job.description.toLowerCase().includes(quickSearchTerm);
    
    let matchSalary = true;
    if (salaryRange) {
      matchSalary = checkSalaryRange(job.salary, salaryRange);
    }
    
    return matchCategory && matchLocation && matchJobType && matchSalary && matchQuickLocation && matchQuickSearch;
  });
}

// Check if job salary matches the selected range
function checkSalaryRange(jobSalary, range) {
  if (!jobSalary) return true;
  
  const salary = parseSalary(jobSalary);
  if (!salary) return true;
  
  switch(range) {
    case '0-10000':
      return salary <= 10000;
    case '10000-20000':
      return salary >= 10000 && salary <= 20000;
    case '20000-30000':
      return salary >= 20000 && salary <= 30000;
    case '30000-50000':
      return salary >= 30000 && salary <= 50000;
    case '50000+':
      return salary >= 50000;
    default:
      return true;
  }
}

// Parse salary string to number (handles various formats)
function parseSalary(salaryStr) {
  if (!salaryStr) return null;
  
  // Remove currency symbols and common text
  const cleaned = salaryStr.replace(/[R$£€,\s]/g, '');
  
  // Extract numbers
  const numbers = cleaned.match(/\d+/g);
  if (!numbers || numbers.length === 0) return null;
  
  // Convert to numbers and find the maximum (salary range is usually max)
  const parsedNumbers = numbers.map(Number);
  const max = Math.max(...parsedNumbers);
  
  return max;
}

// Fetch jobs from the API
async function loadJobs() {
  try {
    const locationParam = quickLocation.value || filterLocation.value || 'South Africa';
    const response = await fetch(`${API_BASE}/jobs?source=${currentSource}&location=${encodeURIComponent(locationParam)}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const allJobs = data.jobs || [];
    const filteredJobs = filterJobs(allJobs);
    
    displayJobs(filteredJobs);
    updateStats(allJobs);
  } catch (error) {
    console.error('Error loading jobs:', error);
    jobsEl.innerHTML = '<p class="empty">Could not load job opportunities. Please try again later.</p>';
  }
}

// Submit a new job posting
async function submitJob(jobData) {
  const response = await fetch(`${API_BASE}/jobs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(jobData)
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'Submission failed');
  }

  return data;
}

// Handle form submission
async function handleFormSubmit(event) {
  event.preventDefault();
  
  submitBtn.disabled = true;
  setStatus('Posting job opportunity...');

  try {
    const jobData = {
      company: document.getElementById('company').value.trim(),
      jobTitle: document.getElementById('jobTitle').value.trim(),
      category: document.getElementById('category').value,
      location: document.getElementById('location').value.trim(),
      jobType: document.getElementById('jobType').value,
      salary: document.getElementById('salary').value.trim(),
      description: descriptionEl.value.trim(),
      contact: document.getElementById('contact').value.trim(),
      urgency: document.getElementById('urgency').value
    };

    await submitJob(jobData);

    setStatus('Job posted successfully! Thank you for supporting local employment.', 'ok');
    form.reset();
    counterEl.textContent = '0/1000';
    
    // Switch to local view to see the new job
    if (currentSource !== 'local') {
      currentSource = 'local';
      updateSourceButtons();
    }
    
    await loadJobs();
  } catch (error) {
    console.error('Error submitting job:', error);
    setStatus(error.message || 'Network error — please try again.', 'err');
  } finally {
    submitBtn.disabled = false;
  }
}

// Update source button styles
function updateSourceButtons() {
  localBtn.classList.toggle('active', currentSource === 'local');
  apiBtn.classList.toggle('active', currentSource === 'api');
  allBtn.classList.toggle('active', currentSource === 'all');
}

// Handle source button clicks
localBtn.addEventListener('click', () => {
  currentSource = 'local';
  updateSourceButtons();
  loadJobs();
});

apiBtn.addEventListener('click', () => {
  currentSource = 'api';
  updateSourceButtons();
  loadJobs();
});

allBtn.addEventListener('click', () => {
  currentSource = 'all';
  updateSourceButtons();
  loadJobs();
});

// Handle filter button click
filterBtn.addEventListener('click', loadJobs);

// Handle clear filters button
clearFiltersBtn.addEventListener('click', () => {
  filterCategory.value = '';
  filterLocation.value = '';
  filterJobType.value = '';
  filterSalary.value = '';
  quickSearch.value = '';
  quickLocation.value = '';
  loadJobs();
});

// Handle quick search
quickSearchBtn.addEventListener('click', loadJobs);

quickSearch.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    loadJobs();
  }
});

quickLocation.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    loadJobs();
  }
});

// Set up event listeners and load initial data
form.addEventListener('submit', handleFormSubmit);
document.addEventListener('DOMContentLoaded', () => {
  updateSourceButtons();
  loadJobs();
});
