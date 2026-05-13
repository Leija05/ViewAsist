import os
import uvicorn


def main() -> None:
    host = os.getenv('BACKEND_HOST', '127.0.0.1')
    port = int(os.getenv('BACKEND_PORT', '8000'))
    os.environ.setdefault('MONGO_URL', 'mongodb://127.0.0.1:27017')
    os.environ.setdefault('DB_NAME', 'viewasist')
    os.environ.setdefault('FRONTEND_URL', 'http://localhost:3000')
    uvicorn.run('backend.server:app', host=host, port=port)


if __name__ == '__main__':
    main()
