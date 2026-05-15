import os
import re
import cv2
import pytesseract
import numpy as np
from PIL import Image
from flask import Flask, request, jsonify
import requests
from io import BytesIO

app = Flask(__name__)

def preprocess_image(img):
    # Convertit en gris
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    # Agrandit x2 pour meilleure lecture
    scaled = cv2.resize(gray, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
    # Contraste
    _, thresh = cv2.threshold(scaled, 150, 255, cv2.THRESH_BINARY)
    return thresh

def extract_stats(text):
    stats = {
        'kills'  : None,
        'deaths' : None,
        'score'  : None,
        'pseudo' : None,
    }

    lines = text.lower().split('\n')
    lines = [l.strip() for l in lines if l.strip()]

    for i, line in enumerate(lines):
        # Kills
        if 'kill' in line:
            numbers = re.findall(r'\d+', line)
            if numbers:
                stats['kills'] = int(numbers[0])

        # Deaths
        if 'death' in line or 'mort' in line:
            numbers = re.findall(r'\d+', line)
            if numbers:
                stats['deaths'] = int(numbers[0])

        # Score
        if 'score' in line:
            numbers = re.findall(r'\d+', line)
            if numbers:
                stats['score'] = int(numbers[0])

    # K/D calculé
    if stats['kills'] is not None and stats['deaths'] is not None:
        deaths = stats['deaths'] if stats['deaths'] > 0 else 1
        stats['kd'] = round(stats['kills'] / deaths, 2)

    return stats

@app.route('/health', methods=['GET'])
def health():
    return jsonify({ 'status': 'ok' })

@app.route('/ocr', methods=['POST'])
def ocr():
    try:
        data = request.get_json()
        image_url = data.get('image_url')

        if not image_url:
            return jsonify({ 'error': 'image_url manquant' }), 400

        # Télécharge l'image depuis Discord CDN
        response = requests.get(image_url, timeout=10)
        img_array = np.frombuffer(response.content, np.uint8)
        img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)

        if img is None:
            return jsonify({ 'error': 'Image invalide' }), 400

        # Prétraitement + OCR
        processed = preprocess_image(img)
        text = pytesseract.image_to_string(processed, config='--psm 6')

        # Extraction des stats
        stats = extract_stats(text)
        stats['raw_text'] = text  # debug

        return jsonify({ 'success': True, 'stats': stats })

    except Exception as e:
        return jsonify({ 'error': str(e) }), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)