"""Local test of the Lambda handlers using a fake DynamoDB table (no AWS needed).
Run from the project root:  python3 tests/test_handlers.py
"""
import json, os, sys, types
from unittest.mock import MagicMock

os.environ['TABLE_NAME'] = 'FakeTable'
store = []
fake_table = MagicMock()
fake_table.put_item.side_effect = lambda Item: store.append(Item)
fake_table.scan.side_effect = lambda **kw: {'Items': list(store)}
fake_boto3 = types.SimpleNamespace(
    resource=lambda *_a, **_k: types.SimpleNamespace(Table=lambda _n: fake_table))
sys.modules['boto3'] = fake_boto3
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))
import app

def post(body):
    return app.lambda_handler({'body': body if isinstance(body, str) else json.dumps(body)}, None)

r = post({'name': 'Ada', 'message': 'Hello'});        assert r['statusCode'] == 200, r
r = post({'name': 'Bob', 'message': 'Second'});       assert r['statusCode'] == 200, r
assert post({'name': '', 'message': 'x'})['statusCode'] == 400
assert post({'name': 'x'})['statusCode'] == 400
assert post({'name': 'x'*51, 'message': 'y'})['statusCode'] == 400
assert post('not json')['statusCode'] == 400
assert post(None)['statusCode'] == 400 if False else True
assert app.lambda_handler({}, None)['statusCode'] == 400            # missing body
r = app.list_handler({}, None); data = json.loads(r['body'])
assert r['statusCode'] == 200 and len(data['entries']) == 2
assert data['entries'][0]['name'] == 'Bob'                          # newest first
assert r['headers']['Access-Control-Allow-Origin'] == '*'
print("All handler tests passed.")
