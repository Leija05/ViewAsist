import os
import uvicorn


def main():
    host = os.environ.get("BACKEND_HOST", "127.0.0.1")
    port = int(os.environ.get("BACKEND_PORT", "8000"))
    uvicorn.run("backend.server:app", host=host, port=port, log_level="info")


if __name__ == "__main__":
    main()
