from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class MenuItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    restaurant = db.Column(db.String, nullable=False)
    name = db.Column(db.String, nullable=False)
    calories = db.Column(db.Integer, nullable=False)
    brand = db.Column(db.String, nullable=True)
    category = db.Column(db.String, nullable=True)
