from dotenv import load_dotenv
load_dotenv()

import base64
import hashlib
import logging
import os
import sys
import threading
import time

from flask import Flask, render_template, request, redirect, url_for, session, flash, jsonify
from pymongo import MongoClient
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename

from Helper import check_image

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads/'
app.secret_key = os.getenv("FLASK_SECRET_KEY")

# Configure basic logging to terminal only (no file creation)
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s  %(levelname)-8s  %(name)s  %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    stream=sys.stdout
)

# Silence noisy third-party loggers
logging.getLogger('pymongo').setLevel(logging.WARNING)
logging.getLogger('urllib3').setLevel(logging.WARNING)

# Configure MongoDB (adjust connection details)
client = MongoClient("mongodb://localhost:27017/", serverSelectionTimeoutMS=5000)
db = client["contact_db"]
collection = db["contacts"]
collection_ms = db["messages"]
collection_user = db["users"]
collection_results = db["results"]


def delete_files(file_path):
    time.sleep(300)
    if os.path.exists(file_path):
        os.remove(file_path)


@app.route('/')
def home():
    return render_template('home.html')


@app.route('/home_logged')
def home_logged():
    email = session.get("email")
    user = collection_user.find_one({"email": email})

    return render_template('home_logged_in.html', name=user["full_name"])


@app.route('/check')
def check():
    if not session.get('email'):
        return redirect(url_for('login'))
    return render_template('check.html')


@app.route('/about')
def about():
    return render_template('about.html')


@app.route('/about_logged')
def about_logged():
    return render_template('about_logged.html')


@app.route('/wiki')
def wiki():
    return render_template('wiki.html')


@app.route('/saliency')
def saliency():
    return render_template('saliency.html')


@app.route('/contact', methods=['GET', 'POST'])
def contact():
    if request.method == 'POST':
        # Get form data
        name = request.form['name']
        email = request.form['email']
        message = request.form['message']

        # Insert data into MongoDB
        collection_ms.insert_one({"name": name, "email": email, "message": message})

        # Redirect or give some confirmation message
        return redirect(url_for('home'))

    # Render the contact form page
    return render_template('contact.html')


@app.route('/contact_logged', methods=['GET', 'POST'])
def contact_logged():
    if request.method == 'POST':
        # Get form data
        name = request.form['name']
        email = request.form['email']
        message = request.form['message']

        # Insert data into MongoDB
        collection_ms.insert_one({"name": name, "email": email, "message": message})

        # Redirect or give some confirmation message
        return redirect(url_for('home_logged'))

    # Render the contact form page
    return render_template('contact_logged.html')


@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        # Get email and password from form
        email = request.form['email']
        password = request.form['password']

        # Query the database to find a user with the given email
        user = collection_user.find_one({"email": email})

        if user and check_password_hash(user["password"], password):
            # Login successful, set a session cookie with the user's ID
            session['email'] = user['email']
            return redirect(url_for('home_logged'))
        else:
            # Login failed
            flash('Invalid email or password', 'error')  # Flash an error message

    return render_template('login.html')


@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        # Get form data
        full_name = request.form['fullName']
        nic = request.form['nic']
        age = int(request.form['age'])
        gender = request.form['gender']
        contact_number = request.form['contactNumber']
        email = request.form['email']
        address = request.form['address']
        password = request.form['password']

        hashed_password = generate_password_hash(password)
        # Create user document for MongoDB
        user = {
            "full_name": full_name,
            "nic": nic,
            "age": age,
            "gender": gender,
            "contact_number": contact_number,
            "email": email,
            "address": address,
            "password": hashed_password,
        }

        # Insert user into MongoDB
        collection_user.insert_one(user)

        # Flash a success message (optional)
        flash('Registration successful! Please login to continue.')

        # Redirect to login page
        return redirect(url_for('login'))
    return render_template('register.html')


@app.route('/logout')
def logout():
    # Remove 'email' from session
    session.pop('email', None)

    # Redirect to the home page
    return redirect(url_for('home'))


@app.route('/analyze_image', methods=['POST'])
def analyze_image():
    if not session.get('email'):
        return redirect(url_for('login'))

    if 'image' not in request.files:
        return redirect(request.url)
    file = request.files['image']
    if file.filename == '':
        return redirect(request.url)

    if file:
        # Retrieving text field values
        name = request.form['name']
        age = request.form['age']
        gender = request.form['gender']
        contact_number = request.form['contactNumber']

        # Image handling
        filename = secure_filename(file.filename)
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(file_path)

        # Rename file with its hash value
        hash_name = hashlib.sha256(filename.encode()).hexdigest()
        new_file_path = os.path.join(app.config['UPLOAD_FOLDER'], hash_name + os.path.splitext(filename)[1])
        os.rename(file_path, new_file_path)

        threading.Thread(target=delete_files, args=(new_file_path,)).start()

        # Process Image and Get Disease Prediction
        # Result may have 9 values (normal) or 10 values (multi-disease mode with severity_map)
        result = check_image(new_file_path, age, gender)
        if len(result) == 11:
            disease, probability, disease_scores, severity, sev_conf, heatmap_original, impact_pct, clinical_report, modality, severity_map, discriminator_info = result
        elif len(result) == 10:
            disease, probability, disease_scores, severity, sev_conf, heatmap_original, impact_pct, clinical_report, modality, discriminator_info = result
            severity_map = None
        else:
            disease, probability, disease_scores, severity, sev_conf, heatmap_original, impact_pct, clinical_report, modality = result
            severity_map = None
            discriminator_info = ""

        with open(new_file_path, "rb") as image_file:
            encoded_string = base64.b64encode(image_file.read()).decode("utf-8")
        image_uri = f"data:image/jpeg;base64,{encoded_string}"
        
        heatmap_uri = ""
        if heatmap_original and os.path.exists(heatmap_original):
            with open(heatmap_original, "rb") as hm_file:
                encoded_heatmap = base64.b64encode(hm_file.read()).decode("utf-8")
            heatmap_uri = f"data:image/jpeg;base64,{encoded_heatmap}"
            threading.Thread(target=delete_files, args=(heatmap_original,)).start()

        # Create a document to save in MongoDB
        result_document = {
            "name": name,
            "age": age,
            "gender": gender,
            "contact_number": contact_number,
            "disease": disease,
            "probability": probability,
            "severity": severity,
            "severity_confidence": sev_conf,
            "impact_percentage": impact_pct,
            "clinical_report": clinical_report,
            "image": image_uri,
            "heatmap": heatmap_uri,
            "modality": modality,
            "severity_map": severity_map or {},
            "discriminator_info": discriminator_info
        }

        # Save the document in MongoDB
        collection_results.insert_one(result_document)

        # Find the saved document to get its _id
        saved_document = collection_results.find_one(result_document)
        report_id = str(saved_document['_id'])

        # Pass the data to the results template
        return render_template('results.html', name=name, age=age, gender=gender,
                               contact_number=contact_number, disease=disease,
                               probability=probability,
                               severity=severity,
                               severity_confidence=sev_conf,
                               impact_percentage=impact_pct,
                               clinical_report=clinical_report,
                               image_uri=image_uri, heatmap_uri=heatmap_uri,
                               report_id=report_id, disease_scores=disease_scores,
                               modality=modality,
                               severity_map=severity_map or {},
                               discriminator_info=discriminator_info)

    return 'File upload failed'


@app.route('/api/login', methods=['POST'])
def api_login():
    data     = request.get_json(force=True)
    email    = data.get('email', '').strip()
    password = data.get('password', '')
    user = collection_user.find_one({"email": email})
    if not user or not check_password_hash(user["password"], password):
        return jsonify({'error': 'Invalid email or password'}), 401
    return jsonify({
        "full_name":      user.get("full_name", ""),
        "email":          user.get("email", ""),
        "nic":            user.get("nic", ""),
        "age":            user.get("age", ""),
        "gender":         user.get("gender", ""),
        "contact_number": user.get("contact_number", ""),
        "address":        user.get("address", ""),
    })


@app.route('/api/register', methods=['POST'])
def api_register():
    data = request.get_json(force=True)
    email = data.get('email', '').strip()
    if collection_user.find_one({"email": email}):
        return jsonify({'error': 'Email already registered'}), 409
    user = {
        "full_name":      data.get("fullName", ""),
        "nic":            data.get("nic", ""),
        "age":            int(data.get("age", 0)),
        "gender":         data.get("gender", ""),
        "contact_number": data.get("contactNumber", ""),
        "email":          email,
        "address":        data.get("address", ""),
        "password":       generate_password_hash(data.get("password", "")),
    }
    collection_user.insert_one(user)
    return jsonify({"success": True})


@app.route('/api/contact', methods=['POST'])
def api_contact():
    data = request.get_json(force=True)
    collection_ms.insert_one({
        "name":    data.get("name", ""),
        "email":   data.get("email", ""),
        "message": data.get("message", ""),
    })
    return jsonify({"success": True})


@app.route('/api/analyze', methods=['POST'])
def api_analyze():
    """JSON endpoint for the React Native mobile app.
    Accepts multipart/form-data (same fields as /analyze_image).
    Returns a JSON payload — no session required, uses X-RNX-Token header.
    """
    token = request.headers.get('X-RNX-Token', '')
    if token != os.environ.get('RNX_API_TOKEN', 'retinax-mobile-dev'):
        return jsonify({'error': 'Unauthorized'}), 401

    name           = request.form.get('name', 'Unknown')
    age            = request.form.get('age', '0')
    gender         = request.form.get('gender', 'Unknown')
    contact_number = request.form.get('contactNumber', '')

    upload_dir = os.path.abspath(app.config['UPLOAD_FOLDER'])
    os.makedirs(upload_dir, exist_ok=True)

    image_b64 = request.form.get('image_b64', '')
    if image_b64:
        # Mobile path: base64-encoded JPEG from expo-image-picker.
        # Decode → PIL RGB → re-save as clean JPEG to strip malformed EXIF.
        from PIL import Image as _PILImg
        import io as _io
        img_bytes = base64.b64decode(image_b64)
        hash_name = hashlib.sha256(img_bytes[:512]).hexdigest()
        new_file_path = os.path.join(upload_dir, hash_name + '.jpg')
        with _PILImg.open(_io.BytesIO(img_bytes)) as _img:
            _img.convert('RGB').save(new_file_path, 'JPEG', quality=95)
        threading.Thread(target=delete_files, args=(new_file_path,)).start()
    elif 'image' in request.files and request.files['image'].filename != '':
        # Fallback: multipart file upload
        file      = request.files['image']
        filename  = secure_filename(file.filename) or 'scan.jpg'
        file_path = os.path.join(upload_dir, filename)
        file.save(file_path)
        hash_name = hashlib.sha256(filename.encode()).hexdigest()
        new_file_path = os.path.join(upload_dir,
                                     hash_name + os.path.splitext(filename)[1])
        os.rename(file_path, new_file_path)
        threading.Thread(target=delete_files, args=(new_file_path,)).start()
    else:
        return jsonify({'error': 'No image uploaded'}), 400

    result = check_image(new_file_path, age, gender)
    if len(result) == 11:
        disease, probability, disease_scores, severity, sev_conf, \
            heatmap_original, impact_pct, clinical_report, modality, severity_map, discriminator_info = result
    elif len(result) == 10:
        disease, probability, disease_scores, severity, sev_conf, \
            heatmap_original, impact_pct, clinical_report, modality, discriminator_info = result
        severity_map = None
    else:
        disease, probability, disease_scores, severity, sev_conf, \
            heatmap_original, impact_pct, clinical_report, modality = result
        severity_map = None
        discriminator_info = ""

    with open(new_file_path, "rb") as f:
        image_b64 = base64.b64encode(f.read()).decode("utf-8")

    heatmap_b64 = ""
    if heatmap_original and os.path.exists(heatmap_original):
        with open(heatmap_original, "rb") as f:
            heatmap_b64 = base64.b64encode(f.read()).decode("utf-8")
        threading.Thread(target=delete_files, args=(heatmap_original,)).start()

    doc = {
        "name": name, "age": age, "gender": gender,
        "contact_number": contact_number, "disease": disease,
        "probability": probability, "severity": severity,
        "severity_confidence": sev_conf, "impact_percentage": impact_pct,
        "clinical_report": clinical_report,
        "image": f"data:image/jpeg;base64,{image_b64}",
        "heatmap": f"data:image/jpeg;base64,{heatmap_b64}" if heatmap_b64 else "",
        "modality": modality, "severity_map": severity_map or {},
        "discriminator_info": discriminator_info
    }
    collection_results.insert_one(doc)
    report_id = str(collection_results.find_one(doc)['_id'])

    return jsonify({
        "report_id":          report_id,
        "name":               name,
        "age":                age,
        "gender":             gender,
        "contact_number":     contact_number,
        "disease":            disease,
        "probability":        round(probability, 1),
        "disease_scores":     {k: round(v * 100, 1) for k, v in disease_scores.items()},
        "severity":           severity,
        "severity_confidence": round(sev_conf, 1),
        "impact_percentage":  round(impact_pct, 1),
        "clinical_report":    clinical_report,
        "modality":           modality,
        "image_b64":          image_b64,
        "heatmap_b64":        heatmap_b64,
        "severity_map":       {
            d: {"label": v[0], "confidence": round(v[1], 1)}
            for d, v in (severity_map or {}).items()
        },
        "discriminator_info": discriminator_info
    })


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5005, debug=True)
