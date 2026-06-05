#!/usr/bin/env python3
"""
Seed the TrustMatch brand into Firestore.
Usage: python seed_brand.py --project <project-id>
"""
from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed TrustMatch brand into Firestore")
    parser.add_argument("--project", required=True, help="Google Cloud project ID")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the document that would be written without actually writing",
    )
    args = parser.parse_args()

    brand_data = {
        "name": "TrustMatch",
        "status": "active",
        "domains": {
            "sendingDomain": "trustmatch.io",
            "supportSubdomain": "hey.trustmatch.io",
        },
        "senders": {
            "support": "support@hey.trustmatch.io",
            "noReply": "no-reply@hey.trustmatch.io",
        },
        "resend": {
            "domainId": "placeholder_domain_id",
            "webhookSecretRef": "RESEND_WEBHOOK_SECRET_TRUSTMATCH",
        },
        "voiceProfileId": None,
        "policy": {
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
        },
        "createdAt": datetime.now(tz=timezone.utc),
        "updatedAt": datetime.now(tz=timezone.utc),
    }

    if args.dry_run:
        import json

        def _serialise(obj):
            if isinstance(obj, datetime):
                return obj.isoformat()
            raise TypeError(f"Not serialisable: {type(obj)}")

        print(f"Would write to: brands/trustmatch (project={args.project})")
        print(json.dumps(brand_data, indent=2, default=_serialise))
        return

    try:
        from google.cloud import firestore
    except ImportError:
        print(
            "google-cloud-firestore is not installed. "
            "Run: pip install google-cloud-firestore",
            file=sys.stderr,
        )
        sys.exit(1)

    db = firestore.Client(project=args.project)
    ref = db.collection("brands").document("trustmatch")
    ref.set(brand_data, merge=True)
    print(f"Upserted brands/trustmatch in project '{args.project}'")


if __name__ == "__main__":
    main()
