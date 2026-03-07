from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import AuditLog, Borrower, GstProfile, LoanCase, VendorPayload
from app.providers.gst import ClearGSTProvider, GSTProvider, KarzaGSTProvider


class GSTProviderError(Exception):
    pass


def sync_case_gst_profile(
    db: Session,
    *,
    org_id: str,
    case_id: str,
    gstin: str | None,
    user_id: str | None,
) -> GstProfile:
    case = db.scalar(select(LoanCase).where(LoanCase.id == case_id, LoanCase.org_id == org_id))
    if not case:
        raise GSTProviderError("Case not found")

    if not gstin:
        borrower = db.get(Borrower, case.borrower_id)
        gstin = borrower.gstin if borrower else None

    if not gstin:
        raise GSTProviderError("GSTIN is required")

    providers: list[GSTProvider] = [ClearGSTProvider(), KarzaGSTProvider()]
    last_error: str | None = None

    for provider in providers:
        try:
            verify_payload = provider.verify_gstin(gstin)
            summary_payload = provider.fetch_gstr_summary(gstin)
            canonical = provider.to_canonical_profile(verify_payload, summary_payload)

            external_reference = f"GST:{gstin}:{provider.provider_name}:PROFILE"
            raw_payload = {
                "verify": verify_payload,
                "summary": summary_payload,
            }
            vendor_payload = db.scalar(
                select(VendorPayload)
                .where(VendorPayload.case_id == case_id)
                .where(VendorPayload.provider_name == provider.provider_name)
                .where(VendorPayload.payload_type == "GST_PROFILE")
                .where(VendorPayload.external_reference == external_reference)
            )
            if not vendor_payload:
                vendor_payload = VendorPayload(
                    id=str(uuid.uuid4()),
                    org_id=org_id,
                    case_id=case_id,
                    provider_name=provider.provider_name,
                    payload_type="GST_PROFILE",
                    external_reference=external_reference,
                    payload=raw_payload,
                    status="PROCESSED",
                )
                db.add(vendor_payload)
            else:
                vendor_payload.payload = raw_payload
                vendor_payload.status = "PROCESSED"
                vendor_payload.error_message = None

            profile = db.scalar(select(GstProfile).where(GstProfile.case_id == case_id))
            if not profile:
                profile = GstProfile(org_id=org_id, case_id=case_id, provider_name=provider.provider_name, gstin=gstin, legal_name=canonical.legal_name, registration_status=canonical.registration_status)
                db.add(profile)

            profile.source_vendor_payload_id = vendor_payload.id
            profile.provider_name = canonical.provider_name
            profile.gstin = canonical.gstin
            profile.legal_name = canonical.legal_name
            profile.registration_status = canonical.registration_status
            profile.filing_frequency = canonical.filing_frequency
            profile.last_filed_period = canonical.last_filed_period
            profile.gstr1_turnover = canonical.gstr1_turnover
            profile.gstr3b_turnover = canonical.gstr3b_turnover
            profile.confidence = canonical.confidence
            profile.canonical_payload = {
                "gstin": canonical.gstin,
                "legal_name": canonical.legal_name,
                "registration_status": canonical.registration_status,
                "filing_frequency": canonical.filing_frequency,
                "last_filed_period": canonical.last_filed_period,
                "gstr1_turnover": canonical.gstr1_turnover,
                "gstr3b_turnover": canonical.gstr3b_turnover,
            }

            db.add(
                AuditLog(
                    org_id=org_id,
                    user_id=user_id,
                    case_id=case_id,
                    action="GST_PROFILE_SYNCED",
                    entity_type="gst_profile",
                    entity_id=profile.id,
                    details={"provider": canonical.provider_name, "gstin": canonical.gstin},
                )
            )
            db.flush()
            return profile
        except Exception as exc:  # noqa: BLE001
            last_error = f"{provider.provider_name}: {exc}"
            continue

    raise GSTProviderError(last_error or "GST provider failed")
