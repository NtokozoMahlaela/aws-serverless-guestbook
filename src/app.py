"""
Lambda functions for the Local Job Board
Supporting South African employment and economic growth
"""

import json
import os
import uuid
import re
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError

# AWS clients
dynamodb = boto3.resource('dynamodb')
cloudwatch = boto3.client('cloudwatch')

# Environment config
TABLE_NAME = os.environ['TABLE_NAME']
ENVIRONMENT = os.environ.get('ENVIRONMENT', 'dev')
LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO')

# Validation limits
MAX_COMPANY = 100
MAX_TITLE = 100
MAX_LOCATION = 100
MAX_SALARY = 50
MAX_DESCRIPTION = 1000
MAX_CONTACT = 200
MAX_JOBS_RETURNED = 100

# Security patterns
COMPANY_PATTERN = re.compile(r'^[a-zA-Z0-9\s\-\&\'\.]+$')
TEXT_PATTERN = re.compile(r'^[\w\s\.\,\!\?\-\@\:\/\(\)\+]+$')

table = dynamodb.Table(TABLE_NAME)

def put_metric(metric_name, value, unit='Count'):
    """Send a metric to CloudWatch (don't fail if this breaks)"""
    try:
        cloudwatch.put_metric_data(
            Namespace='LocalJobBoard',
            MetricData=[{
                'MetricName': metric_name,
                'Value': value,
                'Unit': unit,
                'Dimensions': [{'Name': 'Environment', 'Value': ENVIRONMENT}]
            }]
        )
    except Exception as e:
        print(f"Failed to send metric {metric_name}: {e}")

def log(message, level='INFO', context=None):
    """Simple structured logging"""
    log_entry = {
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'level': level,
        'message': message,
        'environment': ENVIRONMENT
    }
    if context:
        log_entry.update(context)
    print(json.dumps(log_entry))

def validate_company(company):
    """Check if company name is valid"""
    if not company or not company.strip():
        return False, "Company name is required"
    
    company = company.strip()
    
    if len(company) > MAX_COMPANY:
        return False, f"Company name must be {MAX_COMPANY} characters or less"
    
    if not COMPANY_PATTERN.match(company):
        return False, "Company name contains invalid characters"
    
    return True, None

def validate_title(title):
    """Check if job title is valid"""
    if not title or not title.strip():
        return False, "Job title is required"
    
    title = title.strip()
    
    if len(title) > MAX_TITLE:
        return False, f"Job title must be {MAX_TITLE} characters or less"
    
    return True, None

def validate_description(description):
    """Check if description is valid"""
    if not description or not description.strip():
        return False, "Job description is required"
    
    description = description.strip()
    
    if len(description) > MAX_DESCRIPTION:
        return False, f"Description must be {MAX_DESCRIPTION} characters or less"
    
    return True, None

def validate_required_fields(data):
    """Check if all required fields are present"""
    required = ['company', 'jobTitle', 'category', 'location', 'jobType', 'description', 'contact']
    field_names = {
        'company': 'Company name',
        'jobTitle': 'Job title',
        'category': 'Category',
        'location': 'Location',
        'jobType': 'Job type',
        'description': 'Description',
        'contact': 'Contact method'
    }

    for field in required:
        if not data.get(field) or not data[field].strip():
            return False, f"{field_names[field]} is required"
    
    return True, None

def sanitize_input(input_string):
    """Basic sanitization to prevent injection attacks"""
    sanitized = re.sub(r'<script.*?>.*?</script>', '', input_string, flags=re.IGNORECASE)
    sanitized = re.sub(r'on\w+\s*=', '', sanitized, flags=re.IGNORECASE)
    return sanitized.strip()

def response(status_code, body_dict):
    """Standard HTTP response with CORS headers"""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key',
            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'X-XSS-Protection': '1; mode=block'
        },
        'body': json.dumps(body_dict)
    }

def lambda_handler(event, context):
    """POST /jobs - Post a new job opportunity"""
    request_id = getattr(context, 'request_id', 'unknown')
    
    log("Job posting function called", "INFO", {'request_id': request_id})
    
    try:
        body = json.loads(event.get('body') or '{}')
        
        # Validate required fields
        required_valid, required_error = validate_required_fields(body)
        if not required_valid:
            log(f"Required field validation failed: {required_error}", "WARNING")
            put_metric('ValidationError', 1)
            return response(400, {'error': required_error})
        
        # Validate specific fields
        company_valid, company_error = validate_company(body['company'])
        if not company_valid:
            log(f"Company validation failed: {company_error}", "WARNING")
            put_metric('ValidationError', 1)
            return response(400, {'error': company_error})
        
        title_valid, title_error = validate_title(body['jobTitle'])
        if not title_valid:
            log(f"Title validation failed: {title_error}", "WARNING")
            put_metric('ValidationError', 1)
            return response(400, {'error': title_error})
        
        description_valid, description_error = validate_description(body['description'])
        if not description_valid:
            log(f"Description validation failed: {description_error}", "WARNING")
            put_metric('ValidationError', 1)
            return response(400, {'error': description_error})
        
        # Sanitize inputs
        sanitized_data = {
            'company': sanitize_input(body['company']),
            'jobTitle': sanitize_input(body['jobTitle']),
            'category': sanitize_input(body['category']),
            'location': sanitize_input(body['location']),
            'jobType': sanitize_input(body['jobType']),
            'salary': sanitize_input(body.get('salary', '')),
            'description': sanitize_input(body['description']),
            'contact': sanitize_input(body['contact']),
            'urgency': body.get('urgency', 'normal')
        }
        
        # Create and save job
        job_id = str(uuid.uuid4())
        item = {
            'jobId': job_id,
            **sanitized_data,
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'environment': ENVIRONMENT
        }
        
        table.put_item(Item=item)
        
        log("Job posted successfully", "INFO", {'job_id': job_id, 'title': item['jobTitle'], 'company': item['company']})
        put_metric('JobPosted', 1)
        
        return response(200, {
            'success': True,
            'job': {
                'jobId': job_id,
                'jobTitle': item['jobTitle'],
                'company': item['company'],
                'timestamp': item['timestamp']
            }
        })
        
    except json.JSONDecodeError:
        log("Invalid JSON in request body", "ERROR")
        put_metric('JSONDecodeError', 1)
        return response(400, {'error': 'Invalid JSON body.'})
    
    except ClientError as e:
        log(f"DynamoDB error: {str(e)}", "ERROR")
        put_metric('DynamoDBError', 1)
        return response(500, {'error': 'Database error occurred.'})
    
    except Exception as e:
        log(f"Unexpected error: {str(e)}", "ERROR")
        put_metric('UnexpectedError', 1)
        return response(500, {'error': 'Internal server error.'})

def list_handler(event, context):
    """GET /jobs - Get job postings"""
    request_id = getattr(context, 'request_id', 'unknown')
    
    log("Job listing function called", "INFO", {'request_id': request_id})
    
    try:
        items = []
        scan_kwargs = {}
        
        # Scan with pagination
        while True:
            response = table.scan(**scan_kwargs)
            items.extend(response.get('Items', []))
            
            if len(items) >= MAX_JOBS_RETURNED or 'LastEvaluatedKey' not in response:
                break
            
            scan_kwargs['ExclusiveStartKey'] = response['LastEvaluatedKey']
        
        # Sort newest first and limit
        items.sort(key=lambda i: i.get('timestamp', ''), reverse=True)
        items = items[:MAX_JOBS_RETURNED]
        
        log(f"Retrieved {len(items)} job postings", "INFO")
        put_metric('JobsRetrieved', len(items))
        
        return response(200, {'jobs': items})
        
    except ClientError as e:
        log(f"DynamoDB error: {str(e)}", "ERROR")
        put_metric('DynamoDBError', 1)
        return response(500, {'error': 'Database error occurred.'})
    
    except Exception as e:
        log(f"Unexpected error: {str(e)}", "ERROR")
        put_metric('UnexpectedError', 1)
        return response(500, {'error': 'Internal server error.'})
