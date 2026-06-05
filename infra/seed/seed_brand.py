#!/usr/bin/env python3
"""
Seed brand documents into Firestore.

Usage:
  # Seed all known brands
  python seed_brand.py --project <project-id>

  # Seed a single brand
  python seed_brand.py --project <project-id> --brand personiq

  # Dry-run (print without writing)
  python seed_brand.py --project <project-id> --dry-run

Subdomain note: subdomains are per-brand, decided at setup time — no fixed prefix.
Update a brand's domains/senders below when its subdomain is confirmed in Resend.
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone

# ---------------------------------------------------------------------------
# Brand registry
# Subdomains and sender addresses: fill in / confirm as each is set up in Resend.
# webhookSecretRef: the env-var name that holds the whsec_… signing secret.
# ---------------------------------------------------------------------------
DEFAULT_POLICY = {
    "autoSendEnabled": False,
    "confidenceThreshold": 0.75,
    "retrievalThreshold": 0.70,
    "sentimentFloor": -0.3,
    "hardEscalateIntents": [
        "billing_dispute",
        "cancellation",
        "refund",
        "privacy_request",
        "legal",
        "complaint",
    ],
}

BRANDS: dict[str, dict] = {
    "personiq": {
        "name": "PersonIQ",
        "status": "active",
        "domains": {
            "sendingDomain": "personiq.io",
            "supportSubdomain": "app.personiq.io",  # ✓ verified in Resend
        },
        "senders": {
            "support": "support@app.personiq.io",
            "noReply": "no-reply@app.personiq.io",
        },
        "resend": {
            "domainId": "placeholder_domain_id",
            "webhookSecretRef": "RESEND_WEBHOOK_SECRET_PERSONIQ",
        },
        "voiceProfileId": None,
        "policy": DEFAULT_POLICY,
    },
    "whoscalling": {
        "name": "WhosCalling",
        "status": "active",
        "domains": {
            "sendingDomain": "whoscalling.io",
            "supportSubdomain": "app.whoscalling.io",  # ✓ verified in Resend
        },
        "senders": {
            "support": "support@app.whoscalling.io",
            "noReply": "no-reply@app.whoscalling.io",
        },
        "resend": {
            "domainId": "placeholder_domain_id",
            "webhookSecretRef": "RESEND_WEBHOOK_SECRET_WHOSCALLING",
        },
        "voiceProfileId": None,
        "policy": DEFAULT_POLICY,
    },
    "trustmatch": {
        "name": "TrustMatch",
        "status": "paused",  # subdomain not yet set up — flip to active when verified
        "domains": {
            "sendingDomain": "trustmatch.io",
            "supportSubdomain": "TBD",  # update when subdomain verified in Resend
        },
        "senders": {
            "support": "TBD",
            "noReply": "TBD",
        },
        "resend": {
            "domainId": "placeholder_domain_id",
            "webhookSecretRef": "RESEND_WEBHOOK_SECRET_TRUSTMATCH",
        },
        "voiceProfileId": None,
        "policy": DEFAULT_POLICY,
    },
}


def _serialise(obj: object) -> str:
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Not serialisable: {type(obj)}")


def seed_brand(db, brand_id: str, data: dict, dry_run: bool) -> None:
    now = datetime.now(tz=timezone.utc)
    doc = {**data, "createdAt": now, "updatedAt": now}

    if dry_run:
        print(f"\n── Would write to: brands/{brand_id} ──")
        print(json.dumps(doc, indent=2, default=_serialise))
        return

    ref = db.collection("brands").document(brand_id)
    ref.set(doc, merge=True)
    print(f"Upserted  brands/{brand_id}  ({data['name']})")


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed brand documents into Firestore")
    parser.add_argument("--project", required=True, help="Google Cloud project ID")
    parser.add_argument(
        "--brand",
        choices=list(BRANDS.keys()),
        help="Seed a single brand (omit to seed all)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would be written without writing",
    )
    args = parser.parse_args()

    to_seed = {args.brand: BRANDS[args.brand]} if args.brand else BRANDS

    if args.dry_run:
        for brand_id, data in to_seed.items():
            seed_brand(None, brand_id, data, dry_run=True)
        return

    try:
        from google.cloud import firestore
    except ImportError:
        print(
            "google-cloud-firestore is not installed.\n"
            "Run: pip install google-cloud-firestore",
            file=sys.stderr,
        )
        sys.exit(1)

    db = firestore.Client(project=args.project)
    for brand_id, data in to_seed.items():
        seed_brand(db, brand_id, data, dry_run=False)

    print(f"\nDone — seeded {len(to_seed)} brand(s) into project '{args.project}'")


if __name__ == "__main__":
    main()
