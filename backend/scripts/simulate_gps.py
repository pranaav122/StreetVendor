"""Send a synthetic route to a verified local vendor account, then stop sharing."""
import argparse
import json
import time
from datetime import datetime, timezone
from getpass import getpass
from urllib.error import HTTPError
from urllib.request import Request, urlopen


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api-url", default="http://127.0.0.1:8000")
    parser.add_argument("--email", required=True)
    parser.add_argument("--steps", type=int, default=4)
    parser.add_argument("--interval", type=float, default=5)
    parser.add_argument("--share", action="store_true", help="Explicitly consent to synthetic location sharing")
    args = parser.parse_args(argv)
    if not args.share or not 1 <= args.steps <= 100 or not .1 <= args.interval <= 60:
        parser.error("Use --share, 1–100 steps and a 0.1–60 second interval.")
    # Leave time for network calls and cleanup before the 600-second access expiry.
    if (args.steps-1)*args.interval > 480:
        parser.error("Keep a simulation within eight minutes.")
    token = None

    def call(method, path, body):
        headers = {"Content-Type": "application/json"}
        if token:
            headers["Authorization"] = "Bearer "+token
        request = Request(args.api_url.rstrip("/")+"/api/v1/"+path, method=method,
                          headers=headers, data=json.dumps(body).encode())
        with urlopen(request, timeout=10) as response:
            raw = response.read()
            return json.loads(raw) if raw else None

    sharing = False
    try:
        token = call("POST", "auth/login", {"email": args.email, "password": getpass("Vendor password: ")})["access_token"]
        for index in range(args.steps):
            fix = {"latitude": 13.0827, "longitude": 80.2707+index*.0001,
                   "accuracy_m": 10, "captured_at": datetime.now(timezone.utc).isoformat()}
            if not sharing:
                call("PATCH", "vendors/me/availability", {"is_available": True, "location_sharing_enabled": True, "location": fix})
                sharing = True
            else:
                call("PUT", "vendors/me/location", fix)
            print(f"Accepted synthetic fix {index+1}/{args.steps}")
            if index+1 < args.steps:
                time.sleep(args.interval)
        return 0
    except HTTPError as error:
        print(f"API rejected the simulation (HTTP {error.code}); check account approval and availability.")
        return 1
    finally:
        if sharing:
            # Stop even after interruption so a finished simulator cannot leave discoverable GPS.
            try:
                call("PATCH", "vendors/me/availability", {"is_available": False, "location_sharing_enabled": False})
                print("Sharing stopped")
            except (HTTPError, OSError):
                print("Could not confirm offline state. Open the Partner app and stop sharing.")


if __name__ == "__main__":
    raise SystemExit(main())
