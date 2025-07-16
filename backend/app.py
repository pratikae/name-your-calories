from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv
from database import db
from routes import routes 

import os

load_dotenv()

app = Flask(__name__)
CORS(app, origins=["http://localhost:5173"])

app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///menu_items.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

app.register_blueprint(routes)

if __name__ == "__main__":
    app.run(debug=True, host="localhost", port=5000)
