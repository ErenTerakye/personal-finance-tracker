"""Export the FastAPI OpenAPI document for frontend type generation."""

import json
import sys
from pathlib import Path
from tempfile import TemporaryDirectory

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from finance_tracker.web.app import create_app


def main() -> None:
    output = Path("build/openapi.json")
    output.parent.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory() as directory:
        app = create_app(Path(directory) / "openapi.sqlite3")
        output.write_text(json.dumps(app.openapi(), indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
