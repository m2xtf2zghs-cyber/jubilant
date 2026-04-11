from enum import Enum


class JobStatus(str, Enum):
    QUEUED = "QUEUED"
    PROCESSING = "PROCESSING"
    PARSED = "PARSED"
    EXPORTED = "EXPORTED"
    FAILED = "FAILED"


class FileStatus(str, Enum):
    UPLOADED = "UPLOADED"
    PARSED = "PARSED"
    FAILED = "FAILED"


class Direction(str, Enum):
    DEBIT = "DEBIT"
    CREDIT = "CREDIT"
    ZERO = "ZERO"


class ConfidenceBand(str, Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class WorkbookStatus(str, Enum):
    CREATED = "CREATED"
    FAILED = "FAILED"
