#!/usr/bin/env python3
"""
Create inbound webhooks for PersonIQ and WhosCalling in Resend,
then print the signing secrets to copy into api/.env.

Usage:
  pip install requests
  python create_webhooks.py --url https://your-cloud-run-url.run.app

  # If Cloud Run isn't deployed yet, use a placeholder and update later:
  python create_webhooks.py --url https://placeholder.example.com

  # Update an existing webhook's endpoint URL:
  python create_webhooks.py --update-only --url https://real-url.run.app
"""
from __future__ import annotations

import argparse
import json
import sys

try:
    import requests
except ImportError:
    print("pip install requests", file=sys.stderr)
    sys.exit(1)

API_KEY = "re_YhBJPUca_G1UqEMBZZ68CpTNw9xNUKYtb"
WEBHOOK_PATH = "/webhooks/resend/inbound"
EVENTS = ["email.received"]

BRANDS = [
    {"id": "personiq",    "env_var": "RESEND_WEBHOOK_SECRET_PERSONIQ"},
    {"id": "whoscalling", "env_var": "RESEND_WEBHOOK_SECRET_WHOSCALLING"},
]

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
}


def list_webhooks() -> list[dict]:
    r = requests.get("https://api.resend.com/webhooks", headers=headers)
    r.raise_for_status()
    return r.json().get("data", [])


def create_webhook(endpoint_url: str) -> dict:
    r = requests.post(
        "https://api.resend.com/webhooks",
        headers=headers,
        json={"endpoint": endpoint_url, "events": EVENTS},
    )
    r.raise_for_status()
    return r.json()


def update_webhook(webhook_id: str, endpoint_url: str) -> None:
    r = requests.patch(
        f"https://api.resend.com/webhooks/{webhook_id}",
        headers=headers,
        json={"endpoint": endpoint_url},
    )
    r.raise_for_status()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--url",
        required=True,
        help="Base URL of your Cloud Run service (e.g. https://api-abc123.run.app)",
    )
    parser.add_argument(
        "--update-only",
        action="store_true",
        help="Only update the endpoint URL on existing webhooks (don't create new ones)",
    )
    args = parser.parse_args()

    webhook_url = args.url.rstrip("/") + WEBHOOK_PATH

    # Show existing webhooks
    print("Fetching existing webhooks…")
    existing = list_webhooks()
    print(f"Found {len(existing)} existing webhook(s):")
    for w in existing:
        print(f"  {w['id']}  {w.get('endpoint', '?')}")

    if args.update_only:
        print(f"\nUpdating all webhooks to: {webhook_url}")
        for w in existing:
            update_webhook(w["id"], webhook_url)
            print(f"  Updated {w['id']}")
        print("\nDone.")
        return

    # Create new webhooks
    print(f"\nCreating webhooks pointing to: {webhook_url}")
    print("=" * 60)
    print("Copy these into api/.env:")
    print("=" * 60)

    for brand in BRANDS:
        result = create_webhook(webhook_url)
        secret = result.get("signing_secret", "ERROR — check response")
        webhook_id = result.get("id", "?")
        print(f"\n# {brand['id']} — webhook ID: {webhook_id}")
        print(f"{brand['env_var']}={secret}")

    print("\n" + "=" * 60)
    print("Done. Paste the lines above into api/.env, then run: cd api && pytest")


if __name__ == "__main__":
    main()
