# Tencent Cloud Lighthouse API Documentation

> API Reference for Plan/Dashboard Implementation
> Last Updated: March 2026

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Dashboard APIs](#dashboard-apis)
   - Instance Management
   - Resource Quotas
   - Regions & Zones
4. [Plan/Deployment APIs](#plandeployment-apis)
   - Instance Lifecycle
   - Blueprints (Images)
   - Bundles (Plans)
5. [Network & Security APIs](#network--security-apis)
6. [Storage APIs](#storage-apis)
7. [Error Codes](#error-codes)
8. [Rate Limits](#rate-limits)

---

## Overview

### API Endpoint
```
https://lighthouse.tencentcloudapi.com
```

### API Version
```
2020-03-24
```

### Content-Type
```
application/json; charset=utf-8
```

### Required Headers
| Header | Description | Example |
|--------|-------------|---------|
| X-TC-Action | API name | DescribeInstances |
| X-TC-Version | API version | 2020-03-24 |
| X-TC-Timestamp | UNIX timestamp | 1551113065 |
| X-TC-Region | Region code | ap-guangzhou |
| Authorization | Signature | TC3-HMAC-SHA256 ... |

---

## Authentication

### TC3-HMAC-SHA256 Signature

Tencent Cloud uses signature version 3 (TC3-HMAC-SHA256) for API authentication.

#### Required Credentials
- **SecretId**: API key identifier (e.g., `AKIDxxxxxxxxxxxxxxxx`)
- **SecretKey**: API key secret used for signing

#### Signature Calculation Steps

1. **Create Canonical Request**
```
CanonicalRequest =
    HTTPRequestMethod + '\n' +
    CanonicalURI + '\n' +
    CanonicalQueryString + '\n' +
    CanonicalHeaders + '\n' +
    SignedHeaders + '\n' +
    HashedRequestPayload
```

2. **Create String to Sign**
```
StringToSign =
    Algorithm + '\n' +
    RequestTimestamp + '\n' +
    CredentialScope + '\n' +
    HashedCanonicalRequest
```

3. **Calculate Signature**
```python
SecretDate = HMAC_SHA256("TC3" + SecretKey, Date)
SecretService = HMAC_SHA256(SecretDate, Service)
SecretSigning = HMAC_SHA256(SecretService, "tc3_request")
Signature = HexEncode(HMAC_SHA256(SecretSigning, StringToSign))
```

4. **Build Authorization Header**
```
Authorization: TC3-HMAC-SHA256
    Credential={SecretId}/{CredentialScope},
    SignedHeaders={SignedHeaders},
    Signature={Signature}
```

#### Python Example
```python
import hashlib
import hmac
import json
from datetime import datetime
import requests

def sign(key, msg):
    return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()

def get_signature(secret_id, secret_key, service, host, region, action, version, timestamp, payload):
    date = datetime.utcfromtimestamp(timestamp).strftime("%Y-%m-%d")

    # Step 1: Canonical Request
    hashed_payload = hashlib.sha256(payload.encode("utf-8")).hexdigest()
    canonical_request = f"""POST
/

content-type:application/json; charset=utf-8
host:{host}

content-type;host
{hashed_payload}"""

    # Step 2: String to Sign
    credential_scope = f"{date}/{service}/tc3_request"
    hashed_canonical = hashlib.sha256(canonical_request.encode("utf-8")).hexdigest()
    string_to_sign = f"""TC3-HMAC-SHA256
{timestamp}
{credential_scope}
{hashed_canonical}"""

    # Step 3: Calculate Signature
    secret_date = sign(("TC3" + secret_key).encode("utf-8"), date)
    secret_service = sign(secret_date, service)
    secret_signing = sign(secret_service, "tc3_request")
    signature = hmac.new(secret_signing, string_to_sign.encode("utf-8"), hashlib.sha256).hexdigest()

    return f"TC3-HMAC-SHA256 Credential={secret_id}/{credential_scope}, SignedHeaders=content-type;host, Signature={signature}"

# Usage
headers = {
    "Authorization": get_signature(secret_id, secret_key, "lighthouse", "lighthouse.tencentcloudapi.com", "ap-guangzhou", "DescribeInstances", "2020-03-24", int(datetime.now().timestamp()), '{}'),
    "Content-Type": "application/json; charset=utf-8",
    "Host": "lighthouse.tencentcloudapi.com",
    "X-TC-Action": "DescribeInstances",
    "X-TC-Version": "2020-03-24",
    "X-TC-Timestamp": str(int(datetime.now().timestamp())),
    "X-TC-Region": "ap-guangzhou"
}

response = requests.post("https://lighthouse.tencentcloudapi.com", headers=headers, data='{}')
```

---

## Dashboard APIs

### 1. DescribeInstances
Query instance list and status for dashboard display.

**Action**: `DescribeInstances`
**Rate Limit**: 100 requests/second
**Method**: POST

#### Request Parameters
```json
{
  "InstanceIds": ["lhins-xxxxxxxx"],
  "Filters": [
    {
      "Name": "instance-state",
      "Values": ["RUNNING", "STOPPED"]
    }
  ],
  "Offset": 0,
  "Limit": 100
}
```

#### Available Filters
| Filter Name | Description |
|-------------|-------------|
| instance-name | Filter by instance name |
| private-ip-address | Filter by private IP |
| public-ip-address | Filter by public IP |
| zone | Filter by availability zone |
| instance-state | RUNNING, STOPPED, STARTING, STOPPING |
| tag-key | Filter by tag key |
| tag-value | Filter by tag value |
| tag:tag-key | Filter by specific tag |

#### Response Structure
```json
{
  "Response": {
    "InstanceSet": [
      {
        "InstanceId": "lhins-xxxxxxxx",
        "InstanceName": "WebServer-01",
        "BundleId": "bundle-gen-001",
        "BlueprintId": "lhbp-xxxxxxxx",
        "Zone": "ap-guangzhou-3",
        "InstanceState": "RUNNING",
        "CPU": 2,
        "Memory": 4,
        "SystemDisk": {
          "DiskType": "CLOUD_SSD",
          "DiskSize": 50
        },
        "PrivateAddresses": ["10.0.0.1"],
        "PublicAddresses": ["119.xx.xx.xx"],
        "InternetAccessible": {
          "InternetMaxBandwidthOut": 5,
          "InternetChargeType": "TRAFFIC_POSTPAID_BY_HOUR"
        },
        "RenewFlag": "NOTIFY_AND_AUTO_RENEW",
        "InstanceChargeType": "PREPAID",
        "CreatedTime": "2024-01-15T10:00:00Z",
        "ExpiredTime": "2025-01-15T10:00:00Z",
        "LatestOperation": "StartInstances",
        "LatestOperationState": "SUCCESS",
        "Tags": [
          {
            "Key": "Environment",
            "Value": "Production"
          }
        ]
      }
    ],
    "TotalCount": 10,
    "RequestId": "c1d6c45e-4e37-4c0f-bc48-a7e1b1e2c"
  }
}
```

#### Dashboard Use Cases
- Display instance list with status
- Show resource allocation (CPU, Memory, Disk)
- Monitor instance expiration dates
- Track operation states

---

### 2. DescribeInstancesTrafficPackages
Query traffic package usage for billing dashboard.

**Action**: `DescribeInstancesTrafficPackages`
**Method**: POST

#### Request
```json
{
  "InstanceIds": ["lhins-xxxxxxxx"]
}
```

#### Response
```json
{
  "Response": {
    "InstanceTrafficPackageSet": [
      {
        "InstanceId": "lhins-xxxxxxxx",
        "TrafficPackageSet": [
          {
            "TrafficPackageId": "tbp-xxxxxxxx",
            "TrafficUsed": 1073741824,
            "TrafficPackageTotal": 107374182400,
            "TrafficPackageRemaining": 106300440576,
            "TrafficOverflow": 0,
            "StartTime": "2024-01-01T00:00:00Z",
            "EndTime": "2024-02-01T00:00:00Z",
            "Status": "AVAILABLE"
          }
        ]
      }
    ],
    "RequestId": "xxxxx"
  }
}
```

---

### 3. DescribeGeneralResourceQuotas
Query resource quotas for capacity planning.

**Action**: `DescribeGeneralResourceQuotas`
**Rate Limit**: 10 requests/second
**Method**: POST

#### Request
```json
{
  "ResourceNames": [
    "GENERAL_BUNDLE_INSTANCE",
    "STORAGE_BUNDLE_INSTANCE",
    "SNAPSHOT",
    "BLUEPRINT",
    "DATA_DISK",
    "FIREWALL_RULE"
  ]
}
```

#### Available Resource Names
| Resource Name | Description |
|---------------|-------------|
| GENERAL_BUNDLE_INSTANCE | General purpose instances |
| STORAGE_BUNDLE_INSTANCE | Storage-optimized instances |
| ENTERPRISE_BUNDLE_INSTANCE | Enterprise instances |
| BEFAST_BUNDLE_INSTANCE | BeFast instances |
| USER_KEY_PAIR | SSH key pairs |
| SNAPSHOT | Instance snapshots |
| BLUEPRINT | Custom images |
| DATA_DISK | Cloud disks |
| FIREWALL_RULE | Firewall rules |

#### Response
```json
{
  "Response": {
    "GeneralResourceQuotaSet": [
      {
        "ResourceName": "GENERAL_BUNDLE_INSTANCE",
        "ResourceNameDescription": "General Bundle Instance",
        "ResourceQuotaAvailable": 5,
        "ResourceQuotaTotal": 10
      }
    ],
    "RequestId": "xxxxx"
  }
}
```

---

### 4. DescribeRegions
Query available regions for region selector.

**Action**: `DescribeRegions`
**Method**: POST

#### Request
```json
{}
```

#### Response
```json
{
  "Response": {
    "RegionSet": [
      {
        "Region": "ap-guangzhou",
        "RegionName": "Guangzhou",
        "RegionState": "AVAILABLE"
      },
      {
        "Region": "ap-beijing",
        "RegionName": "Beijing",
        "RegionState": "AVAILABLE"
      },
      {
        "Region": "ap-hongkong",
        "RegionName": "Hong Kong",
        "RegionState": "AVAILABLE"
      },
      {
        "Region": "ap-singapore",
        "RegionName": "Singapore",
        "RegionState": "AVAILABLE"
      }
    ],
    "RequestId": "xxxxx"
  }
}
```

---

### 5. DescribeZones
Query availability zones within a region.

**Action**: `DescribeZones`
**Method**: POST

#### Request
```json
{}
```

#### Response
```json
{
  "Response": {
    "ZoneSet": [
      {
        "Zone": "ap-guangzhou-3",
        "ZoneName": "Guangzhou Zone 3",
        "ZoneState": "AVAILABLE"
      }
    ],
    "RequestId": "xxxxx"
  }
}
```

---

## Plan/Deployment APIs

### 1. DescribeBundles
Query available plans/bundles for instance creation.

**Action**: `DescribeBundles`
**Rate Limit**: 5 requests/second
**Method**: POST

#### Request
```json
{
  "Filters": [
    {
      "Name": "bundle-type",
      "Values": ["GENERAL_BUNDLE"]
    },
    {
      "Name": "support-platform-type",
      "Values": ["LINUX_UNIX"]
    }
  ],
  "Zones": ["ap-guangzhou-3"],
  "Offset": 0,
  "Limit": 100
}
```

#### Bundle Types
| Type | Description |
|------|-------------|
| GENERAL_BUNDLE | General purpose |
| STORAGE_BUNDLE | Storage optimized |
| ENTERPRISE_BUNDLE | Enterprise grade |
| EXCLUSIVE_BUNDLE | Dedicated resources |
| BEFAST_BUNDLE | High performance |
| STARTER_BUNDLE | Entry level |

#### Response
```json
{
  "Response": {
    "BundleSet": [
      {
        "BundleId": "bundle-gen-001",
        "Memory": 4,
        "CPU": 2,
        "SystemDiskType": "CLOUD_SSD",
        "SystemDiskSize": 50,
        "InternetMaxBandwidthOut": 5,
        "InternetChargeType": "TRAFFIC_POSTPAID_BY_HOUR",
        "BundleSalesState": "AVAILABLE",
        "BundleType": "GENERAL_BUNDLE",
        "BundleTypeDescription": "General Purpose",
        "Price": {
          "OriginalPrice": 50.00,
          "DiscountPrice": 45.00
        },
        "SupportLinuxUnixPlatform": true,
        "SupportWindowsPlatform": true
      }
    ],
    "RequestId": "xxxxx"
  }
}
```

---

### 2. DescribeBlueprints
Query available OS images/blueprints.

**Action**: `DescribeBlueprints`
**Method**: POST

#### Request
```json
{
  "Filters": [
    {
      "Name": "blueprint-type",
      "Values": ["APP_OS", "CUSTOM"]
    },
    {
      "Name": "platform-type",
      "Values": ["LINUX_UNIX"]
    }
  ]
}
```

#### Blueprint Types
| Type | Description |
|------|-------------|
| APP_OS | Operating System |
| APP_APP | Application image |
| CUSTOM | Custom blueprint |
| SHARED | Shared blueprint |

#### Response
```json
{
  "Response": {
    "BlueprintSet": [
      {
        "BlueprintId": "lhbp-xxxxxxxx",
        "BlueprintName": "Ubuntu 22.04 LTS",
        "BlueprintType": "APP_OS",
        "PlatformType": "LINUX_UNIX",
        "Platform": "Ubuntu",
        "BlueprintState": "NORMAL",
        "RequiredSystemDiskSize": 20,
        "Description": "Ubuntu 22.04 LTS with basic configuration"
      }
    ],
    "RequestId": "xxxxx"
  }
}
```

---

### 3. CreateInstances
Create new instances (async operation).

**Action**: `CreateInstances`
**Rate Limit**: 5 requests/second
**Method**: POST
**Async**: Yes

#### Request
```json
{
  "BundleId": "bundle-gen-001",
  "BlueprintId": "lhbp-xxxxxxxx",
  "InstanceChargePrepaid": {
    "Period": 1,
    "RenewFlag": "NOTIFY_AND_AUTO_RENEW"
  },
  "InstanceName": "WebServer-01",
  "InstanceCount": 1,
  "Zones": ["ap-guangzhou-3"],
  "LoginConfiguration": {
    "KeyIds": ["lhkp-xxxxxxxx"]
  },
  "DryRun": false,
  "ClientToken": "unique-token-12345"
}
```

#### Parameters
| Parameter | Required | Description |
|-----------|----------|-------------|
| BundleId | Yes | Plan/package ID |
| BlueprintId | Yes | OS image ID |
| InstanceChargePrepaid | Yes | Billing: Period (1-60 months), RenewFlag |
| InstanceName | No | Display name (max 60 chars) |
| InstanceCount | No | 1-30 instances (default: 1) |
| Zones | No | Availability zones |
| LoginConfiguration | No | Key pairs or password |
| DryRun | No | Validate only (no creation) |
| ClientToken | No | Idempotency token |

#### Response
```json
{
  "Response": {
    "InstanceIdSet": ["lhins-xxxxxxxx"],
    "RequestId": "xxxxx"
  }
}
```

#### Async Monitoring
Poll `DescribeInstances` with the returned `InstanceIdSet` to check creation status.

---

### 4. StartInstances
Start stopped instances.

**Action**: `StartInstances`
**Rate Limit**: 10 requests/second
**Method**: POST
**Async**: Yes

#### Request
```json
{
  "InstanceIds": ["lhins-xxxxxxxx"]
}
```

#### Response
```json
{
  "Response": {
    "RequestId": "xxxxx"
  }
}
```

---

### 5. StopInstances
Stop running instances.

**Action**: `StopInstances`
**Rate Limit**: 10 requests/second
**Method**: POST
**Async**: Yes

#### Request
```json
{
  "InstanceIds": ["lhins-xxxxxxxx"]
}
```

---

### 6. RebootInstances
Restart running instances.

**Action**: `RebootInstances`
**Rate Limit**: 10 requests/second
**Method**: POST
**Async**: Yes

#### Request
```json
{
  "InstanceIds": ["lhins-xxxxxxxx"]
}
```

---

### 7. ResetInstance
Reinstall OS (system disk will be formatted).

**Action**: `ResetInstance`
**Rate Limit**: 10 requests/second
**Method**: POST
**Async**: Yes

#### Request
```json
{
  "InstanceId": "lhins-xxxxxxxx",
  "BlueprintId": "lhbp-xxxxxxxx",
  "LoginConfiguration": {
    "Password": "NewSecurePassword123!"
  }
}
```

**Warning**: System disk data will be lost. Cannot switch between Linux and Windows.

---

### 8. TerminateInstances
Delete/terminate instances.

**Action**: `TerminateInstances`
**Method**: POST
**Async**: Yes

#### Request
```json
{
  "InstanceIds": ["lhins-xxxxxxxx"]
}
```

---

## Network & Security APIs

### 1. DescribeFirewallRules
Query firewall rules for an instance.

**Action**: `DescribeFirewallRules`
**Method**: POST

#### Request
```json
{
  "InstanceId": "lhins-xxxxxxxx"
}
```

#### Response
```json
{
  "Response": {
    "FirewallRuleSet": [
      {
        "FirewallRuleId": "lhfw-xxxxxxxx",
        "Protocol": "TCP",
        "Port": "22,80,443",
        "CidrBlock": "0.0.0.0/0",
        "Action": "ACCEPT",
        "FirewallRuleDescription": "SSH and Web"
      }
    ],
    "RequestId": "xxxxx"
  }
}
```

---

### 2. CreateFirewallRules
Add new firewall rules.

**Action**: `CreateFirewallRules`
**Method**: POST

#### Request
```json
{
  "InstanceId": "lhins-xxxxxxxx",
  "FirewallRules": [
    {
      "Protocol": "TCP",
      "Port": "3306",
      "CidrBlock": "10.0.0.0/8",
      "Action": "ACCEPT",
      "FirewallRuleDescription": "MySQL Access"
    }
  ]
}
```

#### Protocol Values
- TCP
- UDP
- ICMP
- ALL

#### Action Values
- ACCEPT
- DROP

---

### 3. DeleteFirewallRules
Remove firewall rules.

**Action**: `DeleteFirewallRules`
**Method**: POST

#### Request
```json
{
  "InstanceId": "lhins-xxxxxxxx",
  "FirewallRuleIds": ["lhfw-xxxxxxxx"]
}
```

---

### 4. DescribeKeyPairs
Query SSH key pairs.

**Action**: `DescribeKeyPairs`
**Method**: POST

#### Request
```json
{
  "KeyIds": ["lhkp-xxxxxxxx"],
  "Offset": 0,
  "Limit": 100
}
```

#### Response
```json
{
  "Response": {
    "KeyPairSet": [
      {
        "KeyId": "lhkp-xxxxxxxx",
        "KeyName": "prod-key",
        "PublicKey": "ssh-rsa AAAA...",
        "AssociatedInstanceIds": ["lhins-xxxxxxxx"],
        "CreatedTime": "2024-01-15T10:00:00Z"
      }
    ],
    "TotalCount": 5,
    "RequestId": "xxxxx"
  }
}
```

---

### 5. CreateKeyPair
Generate new SSH key pair.

**Action**: `CreateKeyPair`
**Method**: POST

#### Request
```json
{
  "KeyName": "new-prod-key"
}
```

#### Response
```json
{
  "Response": {
    "KeyId": "lhkp-xxxxxxxx",
    "PrivateKey": "-----BEGIN RSA PRIVATE KEY-----\n...",
    "RequestId": "xxxxx"
  }
}
```

**Important**: Private key is only returned once. Store it securely.

---

### 6. ImportKeyPair
Import existing public key.

**Action**: `ImportKeyPair`
**Method**: POST

#### Request
```json
{
  "KeyName": "existing-key",
  "PublicKey": "ssh-rsa AAAA... user@host"
}
```

---

### 7. AssociateInstancesKeyPairs
Associate key pairs with instances.

**Action**: `AssociateInstancesKeyPairs`
**Method**: POST

#### Request
```json
{
  "InstanceIds": ["lhins-xxxxxxxx"],
  "KeyId": "lhkp-xxxxxxxx"
}
```

---

### 8. ResetInstancesPassword
Reset instance password.

**Action**: `ResetInstancesPassword`
**Rate Limit**: 20 requests/second
**Method**: POST
**Async**: Yes

#### Request
```json
{
  "InstanceIds": ["lhins-xxxxxxxx"],
  "Password": "NewPassword123!",
  "UserName": "root"
}
```

#### Password Requirements
- **Linux**: 8-30 chars, at least 3 of: lowercase, uppercase, digits, special chars
- **Windows**: 12-30 chars, same complexity rules
- Cannot start with `/` (Linux)
- Cannot contain username (Windows)

---

## Storage APIs

### 1. DescribeDisks
Query cloud disk information.

**Action**: `DescribeDisks`
**Method**: POST

#### Request
```json
{
  "DiskIds": ["lhdisk-xxxxxxxx"],
  "Filters": [
    {
      "Name": "instance-id",
      "Values": ["lhins-xxxxxxxx"]
    }
  ]
}
```

#### Response
```json
{
  "Response": {
    "DiskSet": [
      {
        "DiskId": "lhdisk-xxxxxxxx",
        "DiskName": "DataDisk-01",
        "DiskType": "CLOUD_SSD",
        "DiskSize": 100,
        "DiskState": "ATTACHED",
        "InstanceId": "lhins-xxxxxxxx",
        "CreatedTime": "2024-01-15T10:00:00Z",
        "DiskChargeType": "PREPAID",
        "DiskDeduction": "1"
      }
    ],
    "TotalCount": 2,
    "RequestId": "xxxxx"
  }
}
```

---

### 2. CreateDisks
Create new cloud disks.

**Action**: `CreateDisks`
**Method**: POST
**Async**: Yes

#### Request
```json
{
  "DiskType": "CLOUD_SSD",
  "DiskSize": 100,
  "DiskChargePrepaid": {
    "Period": 1,
    "RenewFlag": "NOTIFY_AND_AUTO_RENEW"
  },
  "DiskName": "DataDisk-01",
  "Zones": ["ap-guangzhou-3"],
  "DiskCount": 1
}
```

#### Disk Types
| Type | Description |
|------|-------------|
| CLOUD_SSD | SSD cloud disk |
| CLOUD_PREMIUM | Premium cloud disk |
| CLOUD_BSSD | Balanced SSD |
| CLOUD_HSSD | High-performance SSD |

---

### 3. AttachDisks
Attach disk to instance.

**Action**: `AttachDisks`
**Method**: POST
**Async**: Yes

#### Request
```json
{
  "DiskId": "lhdisk-xxxxxxxx",
  "InstanceId": "lhins-xxxxxxxx"
}
```

---

### 4. DetachDisks
Detach disk from instance.

**Action**: `DetachDisks`
**Method**: POST
**Async**: Yes

#### Request
```json
{
  "DiskId": "lhdisk-xxxxxxxx"
}
```

---

### 5. ResizeDisks
Expand disk capacity (hot resize).

**Action**: `ResizeDisks`
**Method**: POST
**Async**: Yes

#### Request
```json
{
  "DiskId": "lhdisk-xxxxxxxx",
  "DiskSize": 200
}
```

---

### 6. DescribeSnapshots
Query snapshots.

**Action**: `DescribeSnapshots`
**Method**: POST

#### Request
```json
{
  "SnapshotIds": ["lhsp-xxxxxxxx"],
  "Filters": [
    {
      "Name": "instance-id",
      "Values": ["lhins-xxxxxxxx"]
    }
  ]
}
```

#### Response
```json
{
  "Response": {
    "SnapshotSet": [
      {
        "SnapshotId": "lhsp-xxxxxxxx",
        "SnapshotName": "Pre-Update-Backup",
        "InstanceId": "lhins-xxxxxxxx",
        "CreatedTime": "2024-01-15T10:00:00Z",
        "SnapshotState": "NORMAL",
        "Percent": 100,
        "LatestOperation": "CreateInstanceSnapshot",
        "LatestOperationState": "SUCCESS"
      }
    ],
    "TotalCount": 5,
    "RequestId": "xxxxx"
  }
}
```

---

### 7. CreateInstanceSnapshot
Create instance snapshot.

**Action**: `CreateInstanceSnapshot`
**Method**: POST
**Async**: Yes

#### Request
```json
{
  "InstanceId": "lhins-xxxxxxxx",
  "SnapshotName": "Pre-Update-Backup"
}
```

---

### 8. ApplyInstanceSnapshot
Restore instance from snapshot.

**Action**: `ApplyInstanceSnapshot`
**Method**: POST
**Async**: Yes

#### Request
```json
{
  "InstanceId": "lhins-xxxxxxxx",
  "SnapshotId": "lhsp-xxxxxxxx"
}
```

---

## Error Codes

### Common Error Codes

| Error Code | Description | Solution |
|------------|-------------|----------|
| AuthFailure.InvalidAuthorization | Invalid auth header | Check Authorization format |
| AuthFailure.SecretIdNotFound | Key doesn't exist | Verify SecretId |
| AuthFailure.SignatureExpire | Signature expired | Sync system time |
| AuthFailure.SignatureFailure | Invalid signature | Recalculate signature |
| InvalidParameter | Invalid parameter | Check parameter format |
| MissingParameter | Missing required param | Add missing parameter |
| ResourceNotFound | Resource not found | Verify resource ID |
| ResourceNotFound.InstanceIdNotFound | Instance doesn't exist | Check instance ID |
| InvalidParameterValue.InstanceIdMalformed | Bad instance ID format | Correct ID format |
| UnsupportedOperation.InvalidInstanceState | Wrong instance status | Wait for correct state |
| UnsupportedOperation.LatestOperationUnfinished | Operation in progress | Wait for completion |
| LimitExceeded.InstanceQuotaLimitExceeded | Quota exceeded | Request quota increase |
| ResourcesSoldOut.BundleSoldOut | Plan sold out | Choose different plan |
| InvalidParameter.BundleAndBlueprintNotMatch | Plan/image mismatch | Select compatible pair |
| OperationDenied.InstanceOperationInProgress | Instance busy | Wait for current operation |
| UnauthorizedOperation.NoPermission | No permission | Check IAM policies |
| InternalError | Server error | Retry with backoff |

### Instance States

| State | Description |
|-------|-------------|
| PENDING | Creating |
| RUNNING | Running |
| STOPPED | Stopped |
| STARTING | Starting |
| STOPPING | Stopping |
| REBOOTING | Rebooting |
| SHUTDOWN | Shut down |
| TERMINATING | Terminating |

---

## Rate Limits

| API | Rate Limit |
|-----|------------|
| CreateInstances | 5 req/sec |
| StartInstances | 10 req/sec |
| StopInstances | 10 req/sec |
| RebootInstances | 10 req/sec |
| ResetInstance | 10 req/sec |
| ResetInstancesPassword | 20 req/sec |
| DescribeInstances | 100 req/sec |
| DescribeBundles | 5 req/sec |
| DescribeBlueprints | 100 req/sec |
| DescribeFirewallRules | 100 req/sec |
| CreateFirewallRules | 10 req/sec |
| DeleteFirewallRules | 10 req/sec |
| DescribeKeyPairs | 100 req/sec |
| CreateKeyPair | 10 req/sec |
| DescribeDisks | 100 req/sec |
| CreateDisks | 10 req/sec |
| AttachDisks | 10 req/sec |
| DetachDisks | 10 req/sec |
| ResizeDisks | 10 req/sec |
| DescribeSnapshots | 100 req/sec |
| CreateInstanceSnapshot | 10 req/sec |
| DescribeRegions | 20 req/sec |
| DescribeZones | 20 req/sec |
| DescribeGeneralResourceQuotas | 10 req/sec |

---

## SDK Support

Official SDKs available:
- Python: `pip install tencentcloud-sdk-python`
- Node.js: `npm install tencentcloud-sdk-nodejs`
- Go: `go get github.com/tencentcloud/tencentcloud-sdk-go`
- Java: Maven/Gradle
- PHP: Composer
- .NET: NuGet
- C++

### Python SDK Example
```python
from tencentcloud.common import credential
from tencentcloud.common.profile.client_profile import ClientProfile
from tencentcloud.common.profile.http_profile import HttpProfile
from tencentcloud.lighthouse.v20200324 import lighthouse_client, models

# Credentials
cred = credential.Credential("SecretId", "SecretKey")

# HTTP Profile
httpProfile = HttpProfile()
httpProfile.endpoint = "lighthouse.tencentcloudapi.com"

# Client Profile
clientProfile = ClientProfile()
clientProfile.httpProfile = httpProfile

# Client
client = lighthouse_client.LighthouseClient(cred, "ap-guangzhou", clientProfile)

# Request
req = models.DescribeInstancesRequest()
params = {}
req.from_json_string(json.dumps(params))

# Response
resp = client.DescribeInstances(req)
print(resp.to_json_string())
```

---

## References

- [Tencent Cloud Lighthouse Product](https://www.tencentcloud.com/document/product/1103)
- [API Documentation](https://www.tencentcloud.com/document/api/1103)
- [SDK Documentation](https://www.tencentcloud.com/document/sdk)
- [Quotas and Limits](https://www.tencentcloud.com/document/product/213/67624)
