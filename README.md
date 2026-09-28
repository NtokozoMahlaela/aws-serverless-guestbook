# Serverless Guestbook Application

A full-stack guestbook app built with AWS serverless technologies (S3, API Gateway, Lambda, DynamoDB).

## Quick Start

**Local Development:**
```bash
npm install
npm start

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
guestbook-sam-app/
├── frontend/          # HTML, CSS, JavaScript
├── src/              # Lambda functions (Python)
├── tests/            # Unit tests
├── .github/          # CI/CD pipeline
├── local-server.js   # Local dev server
├── template.yaml     # AWS SAM template
└── deploy.sh         # Deployment script
```

## Features

- Clean, separated code (HTML, CSS, JavaScript)
- Responsive design
- Input validation and sanitization
- AWS SDK integration with CloudWatch metrics
- Security headers and rate limiting
- CI/CD pipeline with automated testing
- Environment-specific configuration

## Testing

```bash
pip install -r src/requirements.txt
pytest tests/ -v --cov=src
```

## Configuration

- **Environment**: dev, staging, prod
- **LogLevel**: DEBUG, INFO, WARNING, ERROR
- **AllowedOrigins**: CORS origins
- **RateLimit**: API rate limit per minute

## Tech Stack

- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Python Lambda functions
- **Database**: DynamoDB
- **Hosting**: S3 static website
- **API**: API Gateway
- **Monitoring**: CloudWatch

Built as an AWS Cloud Practitioner portfolio project.
