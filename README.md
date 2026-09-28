# Local Job Board

A professional job board platform connecting South African talent with employment opportunities through local postings and external job API integration.

## Purpose

This platform addresses unemployment by:
- Providing free job posting for local businesses
- Connecting job seekers with real opportunities from multiple sources
- Supporting various industries across South Africa
- Offering accessible job search for all skill levels

## Quick Start

**Local Development:**
```bash
npm install
npm start
# Open http://localhost:3000
```

**AWS Deployment:**
```bash
# Manual
./deploy.sh dev   # or prod

# CI/CD (GitHub Actions)
# Add AWS credentials as secrets, push to main/develop branches
```

## Project Structure

```
local-job-board/
├── frontend/          # HTML, CSS, JavaScript
├── src/              # Lambda functions (Python)
├── tests/            # Unit tests
├── .github/          # CI/CD pipeline
├── local-server.js   # Local dev server with API integration
├── template.yaml     # AWS SAM template
└── deploy.sh         # Deployment script
```

## Features

**Job Search & Discovery**
- Quick search by job title, keywords, or company
- Filter by industry, location, employment type, salary range
- Toggle between local jobs and external job sources
- Real-time job availability from multiple sources

**For Job Seekers**
- Browse opportunities from local businesses and major employers
- Advanced filtering to find relevant positions
- Clear job descriptions and requirements
- Direct application methods

**For Employers**
- Free job posting for local businesses
- Targeted reach to South African job seekers
- Support for various employment types (full-time, part-time, contract, internship, freelance)
- Urgency level indicators for time-sensitive positions

**Industry Coverage**
- Retail & Sales
- Technology & IT
- Healthcare & Medical
- Education & Training
- Hospitality & Tourism
- Construction & Trades
- Admin & Office
- Agriculture & Farming
- Transport & Logistics

## API Integration

The platform integrates with external job APIs to provide real job opportunities:

**Current Integration:**
- GitHub Jobs API (completely free, no authentication required)

**How It Works:**
- Automatically fetches real job opportunities from GitHub Jobs
- No API keys or authentication needed
- Real-time access to programming and tech jobs worldwide
- Can be extended with additional free job APIs

## Configuration

- **Environment**: dev, staging, prod
- **LogLevel**: DEBUG, INFO, WARNING, ERROR
- **AllowedOrigins**: CORS origins
- **RateLimit**: API rate limit per minute

## Testing

```bash
pip install -r src/requirements.txt
pytest tests/ -v --cov=src
```

## Tech Stack

- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Python Lambda functions
- **Database**: DynamoDB
- **Hosting**: S3 static website
- **API**: API Gateway with external job API integration
- **Monitoring**: CloudWatch

## Social Impact

This platform:
- Supports local businesses in finding talent
- Helps job seekers find opportunities in their communities
- Promotes economic growth through employment
- Provides free access to job opportunities
- Connects various industries across South Africa

## License

Built as an AWS Cloud Practitioner portfolio project demonstrating enterprise-level serverless application development while addressing socio-economic challenges in South Africa.
