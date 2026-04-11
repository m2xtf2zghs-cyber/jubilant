from __future__ import annotations

from importlib import import_module

__all__ = [
    "Account",
    "AnalystOverride",
    "AuditEvent",
    "EntityMaster",
    "Job",
    "ParseException",
    "PartyAlias",
    "SourceFile",
    "Transaction",
    "WorkbookExport",
]

_MODULE_MAP = {
    "Account": "app.models.account",
    "AnalystOverride": "app.models.analyst_override",
    "AuditEvent": "app.models.audit_event",
    "EntityMaster": "app.models.entity_master",
    "Job": "app.models.job",
    "ParseException": "app.models.parse_exception",
    "PartyAlias": "app.models.party_alias",
    "SourceFile": "app.models.source_file",
    "Transaction": "app.models.transaction",
    "WorkbookExport": "app.models.workbook_export",
}


def __getattr__(name: str):
    module_name = _MODULE_MAP.get(name)
    if not module_name:
        raise AttributeError(name)
    module = import_module(module_name)
    return getattr(module, name)


for _module_name in dict.fromkeys(_MODULE_MAP.values()):
    import_module(_module_name)
