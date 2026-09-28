"""
Unit tests for the Local Job Board Lambda functions
"""

import pytest
import json
from unittest.mock import Mock, patch
import os
import sys

# Add src directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

import app

# Fixtures
@pytest.fixture
def mock_dynamodb():
    """Mock DynamoDB table"""
    with patch('app.table') as mock_table:
        yield mock_table

@pytest.fixture
def mock_cloudwatch():
    """Mock CloudWatch client"""
    with patch('app.cloudwatch') as mock_cw:
        yield mock_cw

@pytest.fixture
def sample_context():
    """Mock Lambda context"""
    context = Mock()
    context.request_id = 'test-request-123'
    return context

# Input validation tests
class TestInputValidation:
    
    def test_valid_company(self):
        is_valid, error = app.validate_company("Tech Solutions SA")
        assert is_valid is True
        assert error is None
    
    def test_empty_company(self):
        is_valid, error = app.validate_company("")
        assert is_valid is False
        assert "required" in error.lower()
    
    def test_company_too_long(self):
        long_company = "A" * 101
        is_valid, error = app.validate_company(long_company)
        assert is_valid is False
        assert "100" in error
    
    def test_company_invalid_chars(self):
        is_valid, error = app.validate_company("Company<script>alert('xss')</script>")
        assert is_valid is False
        assert "invalid" in error.lower()
    
    def test_valid_title(self):
        is_valid, error = app.validate_title("Software Developer")
        assert is_valid is True
        assert error is None
    
    def test_empty_title(self):
        is_valid, error = app.validate_title("")
        assert is_valid is False
        assert "required" in error.lower()
    
    def test_title_too_long(self):
        long_title = "A" * 101
        is_valid, error = app.validate_title(long_title)
        assert is_valid is False
        assert "100" in error
    
    def test_valid_description(self):
        is_valid, error = app.validate_description("Looking for a developer to join our team...")
        assert is_valid is True
        assert error is None
    
    def test_empty_description(self):
        is_valid, error = app.validate_description("")
        assert is_valid is False
        assert "required" in error.lower()
    
    def test_description_too_long(self):
        long_description = "A" * 1001
        is_valid, error = app.validate_description(long_description)
        assert is_valid is False
        assert "1000" in error
    
    def test_sanitize_input(self):
        malicious = "<script>alert('xss')</script>Hello"
        sanitized = app.sanitize_input(malicious)
        assert "<script>" not in sanitized
        assert "Hello" in sanitized

# Lambda handler tests
class TestLambdaHandler:
    
    def test_successful_job_posting(self, mock_dynamodb, mock_cloudwatch, sample_context):
        event = {
            'body': json.dumps({
                'company': 'Tech Solutions SA',
                'jobTitle': 'Software Developer',
                'category': 'technology',
                'location': 'Johannesburg',
                'jobType': 'full-time',
                'description': 'Looking for a developer...',
                'contact': 'jobs@techsolutions.co.za'
            })
        }
        
        response = app.lambda_handler(event, sample_context)
        
        assert response['statusCode'] == 200
        body = json.loads(response['body'])
        assert body['success'] is True
        assert 'job' in body
        mock_dynamodb.put_item.assert_called_once()
    
    def test_missing_company(self, sample_context):
        event = {
            'body': json.dumps({
                'jobTitle': 'Software Developer',
                'category': 'technology',
                'location': 'Johannesburg',
                'jobType': 'full-time',
                'description': 'Looking for a developer...',
                'contact': 'jobs@techsolutions.co.za'
            })
        }
        
        response = app.lambda_handler(event, sample_context)
        
        assert response['statusCode'] == 400
        body = json.loads(response['body'])
        assert 'error' in body
        assert 'Company name' in body['error']
    
    def test_missing_title(self, sample_context):
        event = {
            'body': json.dumps({
                'company': 'Tech Solutions SA',
                'category': 'technology',
                'location': 'Johannesburg',
                'jobType': 'full-time',
                'description': 'Looking for a developer...',
                'contact': 'jobs@techsolutions.co.za'
            })
        }
        
        response = app.lambda_handler(event, sample_context)
        
        assert response['statusCode'] == 400
        body = json.loads(response['body'])
        assert 'error' in body
        assert 'Job title' in body['error']
    
    def test_invalid_json(self, sample_context):
        event = {
            'body': 'invalid json'
        }
        
        response = app.lambda_handler(event, sample_context)
        
        assert response['statusCode'] == 400
        body = json.loads(response['body'])
        assert 'Invalid JSON' in body['error']
    
    def test_company_too_long(self, sample_context):
        event = {
            'body': json.dumps({
                'company': 'A' * 101,
                'jobTitle': 'Software Developer',
                'category': 'technology',
                'location': 'Johannesburg',
                'jobType': 'full-time',
                'description': 'Looking for a developer...',
                'contact': 'jobs@techsolutions.co.za'
            })
        }
        
        response = app.lambda_handler(event, sample_context)
        
        assert response['statusCode'] == 400
        body = json.loads(response['body'])
        assert '100' in body['error']

class TestListHandler:
    
    def test_successful_list(self, mock_dynamodb, sample_context):
        mock_dynamodb.scan.return_value = {
            'Items': [
                {
                    'jobId': '1',
                    'company': 'Tech Solutions SA',
                    'jobTitle': 'Software Developer',
                    'category': 'technology',
                    'location': 'Johannesburg',
                    'jobType': 'full-time',
                    'description': 'Looking for a developer...',
                    'contact': 'jobs@techsolutions.co.za',
                    'timestamp': '2024-01-01T00:00:00Z'
                }
            ]
        }
        
        event = {}
        response = app.list_handler(event, sample_context)
        
        assert response['statusCode'] == 200
        body = json.loads(response['body'])
        assert 'jobs' in body
        assert len(body['jobs']) == 1
        mock_dynamodb.scan.assert_called_once()
    
    def test_empty_list(self, mock_dynamodb, sample_context):
        mock_dynamodb.scan.return_value = {
            'Items': []
        }
        
        event = {}
        response = app.list_handler(event, sample_context)
        
        assert response['statusCode'] == 200
        body = json.loads(response['body'])
        assert body['jobs'] == []

class TestResponseHelper:
    
    def test_response_format(self):
        response = app.response(200, {'test': 'data'})
        
        assert response['statusCode'] == 200
        assert 'headers' in response
        assert 'Access-Control-Allow-Origin' in response['headers']
        assert response['headers']['Content-Type'] == 'application/json'
    
    def test_response_body_serialization(self):
        response = app.response(200, {'key': 'value'})
        
        body = json.loads(response['body'])
        assert body['key'] == 'value'

class TestCloudWatchMetrics:
    
    def test_put_metric_success(self, mock_cloudwatch):
        app.put_metric('JobPosted', 1)
        
        mock_cloudwatch.put_metric_data.assert_called_once()
        call_args = mock_cloudwatch.put_metric_data.call_args
        assert call_args[1]['MetricData'][0]['MetricName'] == 'JobPosted'
    
    def test_put_metric_failure_handling(self, mock_cloudwatch):
        mock_cloudwatch.put_metric_data.side_effect = Exception("CloudWatch error")
        
        # Should not raise exception
        app.put_metric('JobPosted', 1)

if __name__ == '__main__':
    pytest.main([__file__, '-v'])
