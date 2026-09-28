"""
Lambda functions for the guestbook app
Handles entry submission and retrieval with validation and security
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
MAX_NAME = 50
MAX_MESSAGE = 500
MAX_ENTRIES = 50

# Security patterns
NAME_PATTERN = re.compile(r'^[a-zA-Z\s\-\'\.]+$')
MESSAGE_PATTERN = re.compile(r'^[\w\s\.\,\!\?\-\@\:]+$')

table = dynamodb.Table(TABLE_NAME)

def put_metric(metric_name, value, unit='Count'):
    """Send a metric to CloudWatch (don't fail if this breaks)"""
    try:
        cloudwatch.put_metric_data(
            Namespace='GuestbookApp',
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

def validate_name(name):
    """Check if name is valid"""
    if not name or not name.strip():
        return False, "Name is required"
    
    name = name.strip()
    
    if len(name) > MAX_NAME:
        return False, f"Name must be {MAX_NAME} characters or less"
    
    if not NAME_PATTERN.match(name):
        return False, "Name contains invalid characters"
    
    return True, None

def validate_message(message):
    """Check if message is valid"""
    if not message or not message.strip():
        return False, "Message is required"
    
    message = message.strip()
    
    if len(message) > MAX_MESSAGE:
        return False, f"Message must be {MAX_MESSAGE} characters or less"
    
    if not MESSAGE_PATTERN.match(message):
        return False, "Message contains invalid characters"
    
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
    """POST /submit - Save a new guestbook entry"""
    request_id = getattr(context, 'request_id', 'unknown')
    
    log("Submit function called", "INFO", {'request_id': request_id})
    
    try:
        body = json.loads(event.get('body') or '{}')
        name = str(body.get('name', '')).strip()
        message = str(body.get('message', '')).strip()
        
        # Validate inputs
        name_valid, name_error = validate_name(name)
        if not name_valid:
            log(f"Name validation failed: {name_error}", "WARNING")
            put_metric('ValidationError', 1)
            return response(400, {'error': name_error})
        
        message_valid, message_error = validate_message(message)
        if not message_valid:
            log(f"Message validation failed: {message_error}", "WARNING")
            put_metric('ValidationError', 1)
            return response(400, {'error': message_error})
        
        # Sanitize inputs
        name = sanitize_input(name)
        message = sanitize_input(message)
        
        # Create and save entry
        entry_id = str(uuid.uuid4())
        item = {
            'entryId': entry_id,
            'name': name,
            'message': message,
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'environment': ENVIRONMENT
        }
        
        table.put_item(Item=item)
        
        log("Entry saved successfully", "INFO", {'entry_id': entry_id, 'name': name})
        put_metric('SuccessfulSubmission', 1)
        
        return response(200, {
            'success': True,
            'entry': {
                'entryId': entry_id,
                'name': name,
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
    """GET /entries - Get recent guestbook entries"""
    request_id = getattr(context, 'request_id', 'unknown')
    
    log("List function called", "INFO", {'request_id': request_id})
    
    try:
        items = []
        scan_kwargs = {}
        
        # Scan with pagination
        while True:
            response = table.scan(**scan_kwargs)
            items.extend(response.get('Items', []))
            
            if len(items) >= MAX_ENTRIES or 'LastEvaluatedKey' not in response:
                break
            
            scan_kwargs['ExclusiveStartKey'] = response['LastEvaluatedKey']
        
        # Sort newest first and limit
        items.sort(key=lambda i: i.get('timestamp', ''), reverse=True)
        items = items[:MAX_ENTRIES]
        
        log(f"Retrieved {len(items)} entries", "INFO")
        put_metric('EntriesRetrieved', len(items))
        
        return response(200, {'entries': items})
        
    except ClientError as e:
        log(f"DynamoDB error: {str(e)}", "ERROR")
        put_metric('DynamoDBError', 1)
        return response(500, {'error': 'Database error occurred.'})
    
    except Exception as e:
        log(f"Unexpected error: {str(e)}", "ERROR")
        put_metric('UnexpectedError', 1)
        return response(500, {'error': 'Internal server error.'})
