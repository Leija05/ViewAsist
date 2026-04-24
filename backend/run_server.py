import os

import uvicorn


if __name__ == "__main__":
    host = os.getenv("BACKEND_HOST", "127.0.0.1")
    port = int(os.getenv("BACKEND_PORT", "8000"))
    uvicorn.run("server:app", host=host, port=port)
