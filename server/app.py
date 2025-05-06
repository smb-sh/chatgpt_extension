from flask import Flask, request, jsonify
import json
import uuid
import os

app = Flask(__name__)

# مسیر فایل برای ذخیره داده‌ها
DATA_FILE = 'cookies_data.json'

# داده‌های کوکی‌ها را از فایل می‌خوانیم اگر موجود باشد
def load_data():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r') as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                print(f"Warning: Could not decode JSON from {DATA_FILE}. Returning empty data.")
                return {}
    return {}

# داده‌های کوکی‌ها را در فایل ذخیره می‌کنیم
def save_data(data):
    with open(DATA_FILE, 'w') as f:
        json.dump(data, f, indent=2)

# داده‌های کوکی‌ها را بارگذاری می‌کنیم
cookies_data = load_data()

@app.route('/api/generate_token', methods=['GET'])
def generate_token():
    # ایجاد توکن یکتا با استفاده از uuid
    token = str(uuid.uuid4())
    
    # توکن جدید به‌طور خودکار ذخیره نمی‌شود، چون ذخیره‌سازی در ارسال کوکی‌ها انجام می‌شود
    
    return jsonify({"token": token}), 200

@app.route('/api/update_cookies', methods=['POST'])
def update_cookies():
    # لاگ کردن بدنه خام درخواست قبل از هرگونه تلاش برای پارس کردن
    raw_request_body = request.data # request.data بدنه را به صورت بایت برمی‌گرداند
    print(f"--- SERVER LOG: /api/update_cookies - Received raw request body (bytes): {raw_request_body} ---")
    
    # تلاش برای تبدیل بایت‌ها به رشته (اگر می‌خواهید محتوای رشته‌ای را ببینید)
    try:
        request_body_str = raw_request_body.decode('utf-8')
        print(f"--- SERVER LOG: /api/update_cookies - Raw request body (decoded string): {request_body_str} ---")
    except UnicodeDecodeError:
        print(f"--- SERVER LOG: /api/update_cookies - Could not decode raw request body as UTF-8. ---")

    data = None
    try:
        data = request.get_json()
    except json.JSONDecodeError as e:
        # این خطا زمانی رخ می‌دهد که بدنه JSON معتبر نباشد
        print(f"--- SERVER LOG: json.JSONDecodeError while calling request.get_json(): {e} ---")
        print(f"--- SERVER LOG: This usually means the request body was empty or not valid JSON. Raw body was: {raw_request_body.decode('utf-8', errors='replace')} ---")
        return jsonify({"message": f"JSONDecodeError: {e.msg}. Ensure body is valid JSON and Content-Type is application/json."}), 400
    
    print(f"--- SERVER LOG: Data after request.get_json(): {data} ---")

    if not data: # اگر request.get_json() به دلیلی None برگرداند (مثلا Content-Type اشتباه و silent=True، یا بدنه {} بود)
        print("--- SERVER LOG: Validation failed - request.get_json() returned None or parsed to an empty dict/list which Python evaluates as False in boolean context if not data:")
        # اگر data یک دیکشنری خالی {} یا لیست خالی [] باشد، `not data` مقدار True برمی‌گرداند.
        # اما اگر یک JSON معتبر مانند `{"token":"t","cookie":{}}` باشد، `not data` مقدار False خواهد بود.
        # ما در اینجا بررسی می‌کنیم که آیا data واقعا None است یا یک ساختار داده خالی.
        if data is None:
             return jsonify({"message": "Invalid JSON payload or incorrect Content-Type; parsed as None."}), 400
        # اگر data یک دیکشنری یا لیست خالی باشد، ممکن است بخواهید خطای دیگری بدهید یا آن را مدیریت کنید.
        # برای سناریوی فعلی، ما انتظار داریم token و cookie وجود داشته باشند.

    token = data.get('token') if isinstance(data, dict) else None
    cookie = data.get('cookie') if isinstance(data, dict) else None
    
    print(f"--- SERVER LOG: Extracted token: {token} (type: {type(token)}) ---")
    print(f"--- SERVER LOG: Extracted cookie object: {cookie} (type: {type(cookie)}) ---")

    error_messages = []
    if not token: 
        error_messages.append("Token is missing, empty, or invalid in JSON payload.")
    if not cookie: 
        error_messages.append("Cookie object is missing or invalid in JSON payload.")
    
    if error_messages:
        full_error_message = "Invalid request content! Issues: " + " | ".join(error_messages)
        print(f"--- SERVER LOG: Validation failed - {full_error_message} ---")
        return jsonify({"message": full_error_message}), 400
    
    if token not in cookies_data:
        cookies_data[token] = []
    
    found_and_updated = False
    if isinstance(cookie, dict):
        for i, existing_cookie in enumerate(cookies_data[token]):
            if (isinstance(existing_cookie, dict) and
                existing_cookie.get('name') == cookie.get('name') and
                existing_cookie.get('domain') == cookie.get('domain') and
                existing_cookie.get('path') == cookie.get('path')):
                cookies_data[token][i] = cookie 
                found_and_updated = True
                break
    if not found_and_updated:
        cookies_data[token].append(cookie) 

    save_data(cookies_data)
    return jsonify({"message": "کوکی‌ها با موفقیت به‌روزرسانی شد."}), 200

@app.route('/api/get_cookies/<token>', methods=['GET'])
def get_cookies(token):
    # بازگشت کوکی‌های مربوط به توکن
    if token in cookies_data:
        return jsonify(cookies_data[token]), 200
    return jsonify({"message": "کوکی‌ها یافت نشد!"}), 404


if __name__ == '__main__':
    app.run(debug=True, port=5151)
