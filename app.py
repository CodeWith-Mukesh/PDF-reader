from logging import debug
from flask import Flask,request,jsonify,render_template
from dotenv import load_dotenv
from db import vectorstore as build_vectorstore, load_vector
from chain import get_prompt
import os
load_dotenv()

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
os.makedirs('uploads',exist_ok =True)

vectorstore = None

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=["POST"])
def upload_pdf():
    global vectorstore
    file = request.files['pdf']
    if file.filename == '':
        return jsonify({'error':'No file selected'}),400
    path = os.path.join(app.config['UPLOAD_FOLDER'],file.filename)
    file.save(path)

    try:
        vectorstore = build_vectorstore(path)
        return jsonify({'message':'PDF uploaded and processed successfully'})
    except Exception as e:
        return jsonify({'error':str(e)}),500

@app.route('/query',methods=['POST'])
def query():
    global vectorstore
    if vectorstore is None:
        return jsonify({'error':'No PDF uploaded'}),400
    data = request.get_json()
    question = data.get('question','')

    try:
        chain = get_prompt(vectorstore)
        result = chain.invoke({'query':question})
        return jsonify({'answer':result.get('result', '')})
    except Exception as e:
        error_str = str(e)
        if "RESOURCE_EXHAUSTED" in error_str and "429" in error_str:
            error_msg = "Gemini API free tier quota exceeded. Please upgrade your Google Cloud billing plan at https://console.cloud.google.com/billing or wait for quota reset."
        else:
            error_msg = error_str
        return jsonify({'error': error_msg}), 500

@app.route('/ask', methods=['POST'])
def ask():
    return query()

@app.route('/about')
def about():
    return render_template('about.html')


if __name__ =='__main__':
    app.run(debug=True)