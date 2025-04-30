from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime
import json
import uuid
import random
import string

app = Flask(__name__)
CORS(app)  # Enable CORS for extension access

# Session data storage (in a production environment, you should use a database)
sessions = {}  # domain: { 'cookies': [], 'lastUpdated': timestamp }

# User tokens storage
tokens = {}  # token: { 'domain': domain }

# Function to generate a unique token
def generate_token(length=16):
    """Generate a unique token with specified length"""
    chars = string.ascii_letters + string.digits
    token = ''.join(random.choice(chars) for _ in range(length))
    return token

@app.route('/api/sessions/<domain>', methods=['GET'])
def get_session(domain):
    """Get sessions for a specific domain"""
    if domain in sessions:
        return jsonify(sessions[domain])
    else:
        return jsonify({'cookies': [], 'lastUpdated': None})

@app.route('/api/sessions/<domain>', methods=['POST'])
def update_session(domain):
    """Update sessions for a specific domain"""
    data = request.json
    
    if 'cookies' not in data or not isinstance(data['cookies'], list):
        return jsonify({'error': 'Invalid data format'}), 400
    
    sessions[domain] = {
        'cookies': data['cookies'],
        'lastUpdated': datetime.now().isoformat()
    }
    
    return jsonify({'success': True, 'message': 'Session updated successfully'})

@app.route('/api/status', methods=['GET'])
def get_status():
    """Check server status"""
    return jsonify({
        'status': 'online',
        'domains': list(sessions.keys()),
        'tokens_count': len(tokens)
    })

@app.route('/api/token/create', methods=['POST'])
def create_token():
    """Create a new token for a specific domain"""
    data = request.json
    
    if 'domain' not in data:
        return jsonify({'error': 'Domain is required'}), 400
    
    domain = data['domain']
    
    # Generate a unique token
    token = generate_token()
    while token in tokens:
        token = generate_token()
    
    # Store the token
    tokens[token] = {
        'domain': domain,
        'createdAt': datetime.now().isoformat()
    }
    
    return jsonify({
        'success': True,
        'token': token,
        'domain': domain
    })

@app.route('/api/token/<token>/session', methods=['GET'])
def get_session_by_token(token):
    """Get session using a token"""
    if token not in tokens:
        return jsonify({'error': 'Invalid token'}), 404
    
    domain = tokens[token]['domain']
    
    if domain not in sessions:
        return jsonify({'error': 'No session found for this token'}), 404
    
    return jsonify({
        'domain': domain,
        'session': sessions[domain]
    })

@app.route('/api/token/<token>/sync', methods=['POST'])
def sync_session_by_token(token):
    """Update session using a token"""
    if token not in tokens:
        return jsonify({'error': 'Invalid token'}), 404
    
    data = request.json
    
    if 'cookies' not in data or not isinstance(data['cookies'], list):
        return jsonify({'error': 'Invalid data format'}), 400
    
    domain = tokens[token]['domain']
    
    sessions[domain] = {
        'cookies': data['cookies'],
        'lastUpdated': datetime.now().isoformat()
    }
    
    return jsonify({
        'success': True,
        'message': 'Session synced successfully',
        'domain': domain
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3000, debug=True) 