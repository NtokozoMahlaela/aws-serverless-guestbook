# Local Job Board

A job board platform connecting South African talent with employment opportunities through local postings and external job API integration.

## Quick Start

**Local Development:**
```bash
npm install
npm start

```


## Features

- Quick search by job title, keywords, or company
- Filter by industry, location, employment type, salary range
- Toggle between local jobs and external job sources
- Free job posting for local businesses


## API Integration

- GitHub Jobs API (completely free, no authentication required)
- Automatically fetches real job opportunities
- No API keys or authentication needed

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

- Supports local businesses in finding talent
- Helps job seekers find opportunities in their communities
- Promotes economic growth through employment
- Provides free access to job opportunities

## License

Built as an AWS Cloud Practitioner portfolio project demonstrating enterprise-level serverless application development while addressing socio-economic challenges in South Africa.
