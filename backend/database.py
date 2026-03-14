from flask_mysqldb import MySQL

mysql = MySQL()

def init_db(app):
    app.config['MYSQL_HOST'] = 'localhost'
    app.config['MYSQL_USER'] = 'root'
    app.config['MYSQL_PASSWORD'] = 'Vikas@2005'
    app.config['MYSQL_DB'] = 'learnifydb'
    mysql.init_app(app)

def get_db():
    return mysql.connection
