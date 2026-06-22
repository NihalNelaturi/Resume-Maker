import json
import sys
from pathlib import Path

# Add backend directory to sys.path to resolve app imports
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import app

def main():
    openapi_schema = app.openapi()
    print(json.dumps(openapi_schema, indent=2))

if __name__ == "__main__":
    main()
