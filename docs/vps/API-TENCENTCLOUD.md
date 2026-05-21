# Tencent Cloud Lighthouse API Documentation

> API Reference for Plan/Dashboard Implementation
> Last Updated: May 2026

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
7. [Pricing & Renewal APIs](#pricing--renewal-apis)
8. [Console & Operability APIs](#console--operability-apis)
9. [Pagination & Common Constraints](#pagination--common-constraints)
10. [Error Codes](#error-codes)
11. [Rate Limits](#rate-limits)
12. [Dashboard Implementation Status](#dashboard-implementation-status)
13. [Dashboard Improvement Roadmap](#dashboard-improvement-roadmap)

---

## Overview

### API Endpoint
```
https://lighthouse.tencentcloudapi.com         # mainland China account
https://lighthouse.intl.tencentcloudapi.com    # international account
```

> The dashboard uses the `.intl.` host (see `src/lib/server/tencent/client.ts`)
> because instances live in international regions like `ap-jakarta` and
> `ap-singapore`. Calling the mainland host with international credentials
> fails with `AuthFailure.SecretIdNotFound`.

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
  "Limit": 20
}
```

> **Pagination defaults**: `Limit` defaults to **20**, max **100**.
> **Constraint**: `InstanceIds` and `Filters` cannot be specified in the
> same request. Max 10 `Filters`, max 100 values per filter.

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
        "Uuid": "abc-123-...",
        "CPU": 2,
        "Memory": 4,
        "OsName": "Ubuntu Server 22.04 LTS 64bit",
        "PlatformType": "LINUX_UNIX",
        "InstanceRestrictState": "NORMAL",
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
        "LoginSettings": { "KeyIds": ["lhkp-xxxxxxxx"] },
        "InstanceChargeType": "PREPAID",
        "CreatedTime": "2024-01-15T10:00:00Z",
        "ExpiredTime": "2025-01-15T10:00:00Z",
        "IsolatedTime": null,
        "LatestOperation": "StartInstances",
        "LatestOperationState": "SUCCESS",
        "LatestOperationRequestId": "req-...",
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
  "InstanceIds": ["lhins-xxxxxxxx"],
  "Offset": 0,
  "Limit": 20
}
```

> Pagination: default `Limit` 20, max 100.

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
    "TotalCount": 1,
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
  "InstanceId": "lhins-xxxxxxxx",
  "Offset": 0,
  "Limit": 20
}
```

#### Response
```json
{
  "Response": {
    "FirewallRuleSet": [
      {
        "FirewallRuleId": "lhfw-xxxxxxxx",
        "AppType": "Linux login (22)",
        "Protocol": "TCP",
        "Port": "22,80,443",
        "CidrBlock": "0.0.0.0/0",
        "Action": "ACCEPT",
        "FirewallRuleDescription": "SSH and Web"
      }
    ],
    "TotalCount": 1,
    "FirewallVersion": 7,
    "RequestId": "xxxxx"
  }
}
```

> **`FirewallVersion`** is an integer that increments on every rule change.
> Pass it back to `CreateFirewallRules`, `DeleteFirewallRules`, and
> `ModifyFirewallRules` to opt into optimistic concurrency. A stale version
> returns `UnsupportedOperation.FirewallVersionMismatch` — re-fetch and retry.

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
  ],
  "FirewallVersion": 7
}
```

> `FirewallVersion` is optional. Omit to skip optimistic locking; pass the
> version returned by the most recent `DescribeFirewallRules` to fail fast
> on concurrent edits.

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
  "FirewallRules": [
    {
      "Protocol": "TCP",
      "Port": "3306",
      "CidrBlock": "10.0.0.0/8",
      "Action": "ACCEPT"
    }
  ],
  "FirewallVersion": 8
}
```

> Lighthouse firewall rules don't have a stable per-rule ID — deletion is by
> rule **shape** (protocol/port/CIDR/action). The doc previously used a
> fictional `FirewallRuleIds` array; the real API matches whole rule objects.

---

### 3a. ModifyFirewallRules
Replace **all** firewall rules on an instance in one call. Useful for a "save
all" UI that lets users edit several rules at once.

**Action**: `ModifyFirewallRules`
**Rate Limit**: 10 requests/second
**Method**: POST

#### Request
```json
{
  "InstanceId": "lhins-xxxxxxxx",
  "FirewallRules": [
    { "Protocol": "TCP", "Port": "22",  "CidrBlock": "0.0.0.0/0", "Action": "ACCEPT", "FirewallRuleDescription": "SSH" },
    { "Protocol": "TCP", "Port": "443", "CidrBlock": "0.0.0.0/0", "Action": "ACCEPT", "FirewallRuleDescription": "HTTPS" }
  ],
  "FirewallVersion": 8
}
```

> This is a **full replace**, not an append. The list you submit becomes the
> entire firewall ruleset.

---

### 3b. ModifyFirewallRuleDescription
Edit just the description of a single rule (no replace).

**Action**: `ModifyFirewallRuleDescription`
**Method**: POST

#### Request
```json
{
  "InstanceId": "lhins-xxxxxxxx",
  "FirewallRule": {
    "Protocol": "TCP",
    "Port": "22",
    "CidrBlock": "0.0.0.0/0",
    "Action": "ACCEPT",
    "FirewallRuleDescription": "SSH (engineering only)"
  },
  "FirewallVersion": 9
}
```

---

### 3c. DescribeFirewallRulesTemplate
Returns Tencent's recommended starter firewall (SSH, HTTP, HTTPS, ICMP).
Useful for the "apply recommended rules" button on a fresh instance.

**Action**: `DescribeFirewallRulesTemplate`
**Rate Limit**: 10 requests/second
**Method**: POST

#### Request
```json
{}
```

#### Response
```json
{
  "Response": {
    "TotalCount": 4,
    "FirewallRuleSet": [
      { "AppType": "Linux login (22)", "Protocol": "TCP", "Port": "22",  "CidrBlock": "0.0.0.0/0", "Action": "ACCEPT", "FirewallRuleDescription": "Linux SSH" }
    ],
    "RequestId": "xxxxx"
  }
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
  "KeyIds": ["lhkp-xxxxxxxx"]
}
```

> **Param shape correction**: `KeyIds` is an array (`KeyIds.N`), not a single
> `KeyId`. Both `InstanceIds` and `KeyIds` accept up to 100 entries.

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

### 9. DisassociateInstancesKeyPairs
Detach key pairs from instances.

**Action**: `DisassociateInstancesKeyPairs`
**Rate Limit**: 20 requests/second
**Method**: POST
**Async**: Yes

#### Request
```json
{
  "InstanceIds": ["lhins-xxxxxxxx"],
  "KeyIds": ["lhkp-xxxxxxxx"]
}
```

> Up to 100 instance IDs and 100 key IDs per call. Linux only — Windows
> instances do not support key-pair login (`UnsupportedOperation.WindowsNotAllowToAssociateKeyPair`).

---

### 10. DeleteKeyPairs
Permanently delete SSH key pairs.

**Action**: `DeleteKeyPairs`
**Rate Limit**: 10 requests/second
**Method**: POST

#### Request
```json
{
  "KeyIds": ["lhkp-xxxxxxxx"]
}
```

> Up to **10** key IDs per call (lower than other batch endpoints). A key
> still bound to an instance returns `ResourceInUse.KeyPairInUse` — call
> `DisassociateInstancesKeyPairs` first.

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
  "DiskIds": ["lhdisk-xxxxxxxx"],
  "InstanceId": "lhins-xxxxxxxx"
}
```

> `DiskIds` is an array, not a single `DiskId`.

---

### 4. DetachDisks
Detach disk from instance.

**Action**: `DetachDisks`
**Method**: POST
**Async**: Yes

#### Request
```json
{
  "DiskIds": ["lhdisk-xxxxxxxx"]
}
```

> `DiskIds` is an array.

---

### 5. ResizeDisks
Expand disk capacity (hot resize, expansion only — cannot shrink).

**Action**: `ResizeDisks`
**Method**: POST
**Async**: Yes

#### Request
```json
{
  "DiskIds": ["lhdisk-xxxxxxxx"],
  "DiskSize": 200
}
```

> `DiskIds` is an array. New `DiskSize` must be greater than the current
> size — otherwise `InvalidParameterValue.DiskSizeSmallerThanCurrentDiskSize`.

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

> If the instance is `RUNNING` it is shut down before the snapshot is applied.

---

## Pricing & Renewal APIs

These power the renewal/upgrade flows. None of them are wired up in the
dashboard yet — see the roadmap section.

### 1. InquirePriceCreateInstances
Get a quote for a `CreateInstances` payload before committing to purchase.

**Action**: `InquirePriceCreateInstances`
**Method**: POST

Mirrors `CreateInstances` parameters and returns `Price.InstancePrice`
(`OriginalPrice`, `DiscountPrice`, `Currency`, `Discount`).

---

### 2. InquirePriceRenewInstances
Get a quote for renewing one or more instances.

**Action**: `InquirePriceRenewInstances`
**Method**: POST

#### Request
```json
{
  "InstanceIds": ["lhins-xxxxxxxx"],
  "InstanceChargePrepaid": { "Period": 3, "RenewFlag": "NOTIFY_AND_AUTO_RENEW" },
  "RenewDataDisk": true,
  "AlignInstanceExpiredTime": false
}
```

> Up to 50 `InstanceIds` per call. Response includes `Price`,
> `DataDiskPriceSet`, `InstancePriceDetailSet`, `TotalPrice`.

---

### 3. RenewInstances
Renew prepaid instances.

**Action**: `RenewInstances`
**Method**: POST
**Async**: Yes

#### Request
```json
{
  "InstanceIds": ["lhins-xxxxxxxx"],
  "InstanceChargePrepaid": { "Period": 3, "RenewFlag": "NOTIFY_AND_AUTO_RENEW" },
  "RenewDataDisk": true,
  "AutoVoucher": false
}
```

> Verify exact param shape via the API Explorer
> (`https://console.tencentcloud.com/api/explorer?Product=lighthouse&Version=2020-03-24&Action=RenewInstances`)
> before relying on this in production — Tencent's HTML page for this Action
> redirected to the wrong content during the most recent doc audit.

---

### 4. DescribeBundleDiscount
Returns tiered pricing for a single bundle (1 / 3 / 12 month tiers etc.).

**Action**: `DescribeBundleDiscount`
**Method**: POST

#### Request
```json
{ "BundleId": "bundle-gen-001" }
```

#### Response
```json
{
  "Response": {
    "Currency": "USD",
    "DiscountDetail": [
      {
        "TimeSpan": 1,  "TimeUnit": "m", "Discount": 100,
        "TotalCost": 50.0, "RealTotalCost": 50.0, "PolicyDetail": null
      },
      {
        "TimeSpan": 12, "TimeUnit": "m", "Discount": 80,
        "TotalCost": 600.0, "RealTotalCost": 480.0, "PolicyDetail": null
      }
    ],
    "RequestId": "xxxxx"
  }
}
```

---

### 5. DescribeModifyInstanceBundles
Returns the bundles an instance can upgrade to.

**Action**: `DescribeModifyInstanceBundles`
**Method**: POST

#### Request
```json
{
  "InstanceId": "lhins-xxxxxxxx",
  "Filters": [
    { "Name": "bundle-state", "Values": ["ONLINE"] }
  ],
  "Offset": 0,
  "Limit": 20
}
```

> Response items include `Bundle`, `ModifyBundleState`,
> `NotSupportModifyMessage`, and `ModifyPrice` so the UI can show
> "Upgrade to X — \$Y/mo" with disabled rows explained.
> Max 10 `Filters`, max 5 values per filter.

---

### 6. DescribeInstancesReturnable
Tells the dashboard whether `TerminateInstances` will yield a refund.

**Action**: `DescribeInstancesReturnable`
**Rate Limit**: 10 requests/second
**Method**: POST

#### Request
```json
{ "InstanceIds": ["lhins-xxxxxxxx"], "Offset": 0, "Limit": 20 }
```

#### Response (excerpt)
```json
{
  "Response": {
    "InstanceReturnableSet": [
      {
        "InstanceId": "lhins-xxxxxxxx",
        "IsReturnable": false,
        "ReturnFailCode": 1003,
        "ReturnFailMessage": "Outside of the refund window"
      }
    ],
    "TotalCount": 1,
    "RequestId": "xxxxx"
  }
}
```

---

## Console & Operability APIs

### 1. ModifyInstancesAttribute
Rename instances in place.

**Action**: `ModifyInstancesAttribute`
**Rate Limit**: 10 requests/second
**Method**: POST

#### Request
```json
{
  "InstanceIds": ["lhins-xxxxxxxx"],
  "InstanceName": "WebServer-Prod"
}
```

> `InstanceName` max 60 chars. Up to 100 instance IDs per call.

---

### 2. DescribeInstanceVncUrl
Returns a single-use URL for the in-browser VNC console.

**Action**: `DescribeInstanceVncUrl`
**Rate Limit**: 10 requests/second
**Method**: POST

#### Request
```json
{ "InstanceId": "lhins-xxxxxxxx" }
```

#### Response
```json
{ "Response": { "InstanceVncUrl": "wss://...", "RequestId": "xxxxx" } }
```

> The URL is valid for **15 seconds** and is single-use. Fetch on button
> click, not on page load. Open in a new tab as
> `https://img.qcloud.com/qcloud/app/active_vnc/index.html?InstanceVncUrl=<url>`.
> Instance must be `RUNNING`.

---

### 3. DescribeInstancesDeniedActions
Returns the list of actions that are currently disallowed for one or more
instances. Use it to dim/disable UI buttons before the user clicks.

**Action**: `DescribeInstancesDeniedActions`
**Method**: POST

#### Request
```json
{ "InstanceIds": ["lhins-xxxxxxxx"] }
```

#### Response (excerpt)
```json
{
  "Response": {
    "InstanceDeniedActionsSet": [
      {
        "InstanceId": "lhins-xxxxxxxx",
        "DeniedActions": [
          { "Action": "StartInstances", "Code": "...", "Message": "Instance is already running" }
        ]
      }
    ],
    "RequestId": "xxxxx"
  }
}
```

---

### 4. DescribeResetInstanceBlueprints
Like `DescribeBlueprints`, but scoped to one instance: returns only the
blueprints that are valid for **that** instance's reinstall (respects
the platform-type lock).

**Action**: `DescribeResetInstanceBlueprints`
**Method**: POST

#### Request
```json
{
  "InstanceId": "lhins-xxxxxxxx",
  "Filters": [
    { "Name": "platform-type", "Values": ["LINUX_UNIX"] }
  ],
  "Offset": 0,
  "Limit": 20
}
```

---

## Pagination & Common Constraints

- All list APIs use **`Offset` + `Limit`** (no cursors).
- Default `Limit` is **20** unless explicitly stated otherwise. Max is **100**
  for most APIs (10 for `DeleteKeyPairs`).
- For most list APIs, `*Ids` arrays and `Filters` are **mutually exclusive**.
  Pick one per request.
- Most filter APIs cap at **10 filters** with **100 values per filter**
  (`DescribeModifyInstanceBundles` is the exception: 5 values per filter).
- Async actions return `RequestId` only; poll `DescribeInstances` (or the
  resource-specific Describe) and watch `LatestOperationState` to detect
  completion.

---

## Error Codes

### Common Error Codes

| Error Code | Description | Solution |
|------------|-------------|----------|
| AuthFailure.InvalidAuthorization | Invalid auth header | Check Authorization format |
| AuthFailure.SecretIdNotFound | Key doesn't exist | Verify SecretId; confirm intl-vs-mainland endpoint matches account |
| AuthFailure.SignatureExpire | Signature expired | Sync system time |
| AuthFailure.SignatureFailure | Invalid signature | Recalculate signature |
| InvalidParameter | Invalid parameter | Check parameter format |
| MissingParameter | Missing required param | Add missing parameter |
| ResourceNotFound | Resource not found | Verify resource ID |
| ResourceNotFound.InstanceIdNotFound | Instance doesn't exist | Check instance ID |
| InvalidParameterValue.InstanceIdMalformed | Bad instance ID format | Correct ID format |
| UnsupportedOperation.InvalidInstanceState | Wrong instance status | Wait for correct state |
| UnsupportedOperation.LatestOperationUnfinished | Operation in progress | Poll and retry |
| UnsupportedOperation.InstanceExpired | Instance is past expiry | Renew first via `RenewInstances` |
| LimitExceeded.InstanceQuotaLimitExceeded | Quota exceeded | Show quota; link to increase request |
| ResourcesSoldOut.BundleSoldOut | Plan sold out | Choose different plan |
| ResourcesSoldOut.ZonesHasNoBundleConfigs | No bundles in zone | Switch zone |
| InvalidParameter.BundleAndBlueprintNotMatch | Plan/image mismatch | Cross-validate via `DescribeBundles`/`DescribeBlueprints` |
| InvalidParameterValue.BundleNotSupportBlueprintPlatform | Bundle/platform mismatch | Pick a compatible blueprint |
| OperationDenied.InstanceOperationInProgress | Instance busy | Wait for current operation |
| FailedOperation.BalanceInsufficient | Wallet too low | Prompt top-up |
| UnauthorizedOperation.NoPermission | No permission | Check IAM policies |
| UnauthorizedOperation.NotCertification | Account not verified | Surface verification flow |
| InternalError | Server error | Retry with backoff |

### Reinstall / Reset

| Error Code | Description |
|------------|-------------|
| InvalidParameterValue.NotAllowToChangePlatformType | Cannot switch Linux ↔ Windows during reinstall |
| UnsupportedOperation.InstanceLinuxUnixCreatingNotSupportPassword | Linux instances created with key auth cannot set password at reinstall |
| UnsupportedOperation.WindowsNotSupportKeyPair | Windows does not support key-pair login |

### Firewall

| Error Code | Description |
|------------|-------------|
| UnsupportedOperation.FirewallVersionMismatch | Stale `FirewallVersion`; re-fetch and retry |
| UnsupportedOperation.FirewallBusy | Another firewall op in progress; retry with backoff |
| LimitExceeded.FirewallRulesLimitExceeded | Per-instance firewall quota hit |
| InvalidParameter.FirewallRulesDuplicated | Deduplicate before submitting |

### Keys

| Error Code | Description |
|------------|-------------|
| ResourceInUse.KeyPairInUse | Key still bound; call `DisassociateInstancesKeyPairs` first |
| UnsupportedOperation.WindowsNotAllowToAssociateKeyPair | Windows does not support key pairs |
| UnsupportedOperation.KeyPairNotBoundToInstance | Disassociate target was never bound |

### Disks

| Error Code | Description |
|------------|-------------|
| UnsupportedOperation.DiskLatestOperationUnfinished | Disk busy; poll and retry |
| InvalidParameterValue.DiskSizeSmallerThanCurrentDiskSize | Resize is expansion-only |
| OperationDenied.DiskOperationInProgress | Disk locked by another op |

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
| ModifyInstancesAttribute | 10 req/sec |
| DescribeInstances | 100 req/sec |
| DescribeInstanceVncUrl | 10 req/sec |
| DescribeInstancesDeniedActions | 20 req/sec |
| DescribeInstancesReturnable | 10 req/sec |
| DescribeBundles | 5 req/sec |
| DescribeBlueprints | 100 req/sec |
| DescribeFirewallRules | 100 req/sec |
| CreateFirewallRules | 10 req/sec |
| DeleteFirewallRules | 10 req/sec |
| ModifyFirewallRules | 10 req/sec |
| DescribeFirewallRulesTemplate | 10 req/sec |
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
| DisassociateInstancesKeyPairs | 20 req/sec |
| DeleteKeyPairs | 10 req/sec |
| InquirePriceCreateInstances | 10 req/sec |
| InquirePriceRenewInstances | 10 req/sec |
| RenewInstances | 10 req/sec |
| DescribeBundleDiscount | 10 req/sec |
| DescribeModifyInstanceBundles | 10 req/sec |

---

## Dashboard Implementation Status

Snapshot of which Actions the `/dashboard/vps` codebase actually calls today.
Source-of-truth: `src/lib/server/tencent/service.ts` and the routes under
`src/app/api/vps/**`.

### Wired up (used by the dashboard)

| Action | Server route | UI surface |
|---|---|---|
| `DescribeInstances` | `GET /api/vps/instances`, `POST /api/vps/byok/connect`, `POST /api/vps/byok/import`, `GET /api/vps/instances/[id]/detail` | Instance list, BYOK flow, detail panel |
| `DescribeRegions` | `GET /api/vps/catalog` | Bundled into catalog (UI doesn't render yet) |
| `DescribeZones` | `GET /api/vps/catalog` | Bundled into catalog (UI doesn't render yet) |
| `DescribeBlueprints` | `GET /api/vps/catalog` | `reinstall/page.tsx` OS picker |
| `DescribeBundles` | `GET /api/vps/catalog` | Returned but no UI consumes it |
| `DescribeInstancesTrafficPackages` | `GET /api/vps/instances/[id]/detail` | Fetched but never rendered |
| `StartInstances` / `StopInstances` / `RebootInstances` | `POST /api/vps/instances/[id]/actions/{start,stop,reboot}` | Action buttons |
| `ResetInstancesPassword` | `POST /api/vps/instances/[id]/reset-password` | `reset/page.tsx` |
| `ResetInstance` | `POST /api/vps/instances/[id]/reinstall` | `reinstall/page.tsx` |
| `DescribeFirewallRules` / `CreateFirewallRules` / `DeleteFirewallRules` | `GET|POST|DELETE /api/vps/instances/[id]/firewall` | Firewall tab (read + create + delete) |
| `DescribeKeyPairs` / `CreateKeyPair` / `ImportKeyPair` | `GET /api/vps/ssh-keys`, `POST /api/vps/ssh-keys/{generate,import}` | SSH keys list + generate/import forms |
| `AssociateInstancesKeyPairs` / `DisassociateInstancesKeyPairs` / `DeleteKeyPairs` | `POST /api/vps/instances/[id]/ssh-keys/bind`, `DELETE /api/vps/instances/[id]/ssh-keys/[keyId]`, `DELETE /api/vps/ssh-keys/[keyId]` | Bind / unbind / delete flows |

### Documented but not wired up

These all have ready-made Action specs above and are blockers for features
in the roadmap below.

- `DescribeGeneralResourceQuotas`
- `TerminateInstances` (the dashboard "delete" today only sets `status='inactive'` in Supabase — the Tencent instance is never terminated)
- `DescribeDisks`, `CreateDisks`, `AttachDisks`, `DetachDisks`, `ResizeDisks`
- `DescribeSnapshots`, `CreateInstanceSnapshot`, `ApplyInstanceSnapshot`
- `ModifyInstancesAttribute`
- `DescribeInstanceVncUrl`
- `DescribeInstancesDeniedActions`
- `DescribeInstancesReturnable`
- `DescribeResetInstanceBlueprints`
- `ModifyFirewallRules`, `ModifyFirewallRuleDescription`, `DescribeFirewallRulesTemplate`
- `InquirePriceCreateInstances`, `InquirePriceRenewInstances`, `RenewInstances`, `DescribeBundleDiscount`, `DescribeModifyInstanceBundles`

### Notable code/schema gaps observed during the audit

- `src/lib/server/tencent/client.ts` already targets the `lighthouse.intl.tencentcloudapi.com` host — keep that.
- `TencentInstance` in `src/lib/server/tencent/service.ts` drops `BundleId`, `BlueprintId`, `LatestOperation`, `LatestOperationState`, `Tags`, `LoginSettings.KeyIds` from the API response. The reinstall page has to refetch the entire catalog because the current blueprint id isn't persisted anywhere.
- `src/app/dashboard/vps/byok/page.tsx` hardcodes `REGIONS` to two entries. The `/api/vps/catalog` route already returns the full region list — wire it through.
- `getInstanceDetail()` fetches `DescribeInstancesTrafficPackages` on every detail load and the result is dropped client-side. Either render it (see roadmap) or stop fetching it.
- `CreateInstances` exists as a service function but no API route or UI invokes it.

---

## Dashboard Improvement Roadmap

Concrete features the team can ship now that the API surface and existing
data flow have been mapped. Each entry lists the Tencent Action(s) it
depends on and the file(s) that need to change.

1. **Show traffic package usage on the instance detail panel.** The data is
   already fetched in `getInstanceDetail()`. Render a used/total/remaining bar
   plus the period start/end and `TrafficOverflow` flag in
   `src/app/dashboard/views.tsx` (the `VpsView` component). No API work needed.
   Action: `DescribeInstancesTrafficPackages` (already wired).

2. **Quotas widget on the VPS dashboard root.** Show "instances X/Y",
   "snapshots X/Y", "key pairs X/Y" so users know how close they are to
   limits. New route `GET /api/vps/quotas` calling
   `DescribeGeneralResourceQuotas`, rendered above or alongside the instance
   list.

3. **Drive the BYOK region dropdown from `DescribeRegions`.** Replace the
   hardcoded list in `src/app/dashboard/vps/byok/page.tsx` with the catalog's
   regions. Action: `DescribeRegions` (already wired).

4. **Smart action button states.** Before showing Start/Stop/Reboot/Reinstall,
   call `DescribeInstancesDeniedActions` and dim disallowed buttons with a
   tooltip from `DeniedActions[i].Message`. Eliminates "operation not allowed"
   error toasts. Wire into the lifecycle poller in `VpsView`.

5. **In-browser VNC console.** "Open Console" button calls
   `DescribeInstanceVncUrl` on click (URL is single-use, expires in 15s) and
   opens `https://img.qcloud.com/qcloud/app/active_vnc/index.html?InstanceVncUrl=<url>`
   in a new tab. New route: `POST /api/vps/instances/[id]/vnc`.

6. **Inline rename.** Click the instance name in `VpsView` to edit; on blur
   call `ModifyInstancesAttribute` and `router.refresh()`. New route:
   `PATCH /api/vps/instances/[id]`.

7. **Snapshots tab.** New `src/app/dashboard/vps/snapshots/page.tsx` plus
   routes for `DescribeSnapshots`, `CreateInstanceSnapshot`,
   `ApplyInstanceSnapshot`. Include a "snapshots used X/Y" line backed by
   `DescribeGeneralResourceQuotas`.

8. **Disks tab.** New tab/page in `VpsView` plus routes for `DescribeDisks`,
   `CreateDisks`, `AttachDisks`, `DetachDisks`, `ResizeDisks`. Resize is
   expansion-only — guard the form.

9. **Plan upgrade flow.** "Upgrade Plan" dialog calls
   `DescribeModifyInstanceBundles` for eligible targets, shows `ModifyPrice`
   and disables rows that return `NotSupportModifyMessage`. Useful even
   before a buy-flow exists, because users can preview their options.

10. **Renewal with price preview.** "Renew" dialog calls
    `InquirePriceRenewInstances` for the quote (with optional `RenewDataDisk`
    and `AlignInstanceExpiredTime` toggles), then `RenewInstances` on
    confirm. Verify the `RenewInstances` payload via the API Explorer first.

11. **Firewall: full edit + recommended rules.** Today the firewall tab is
    add/delete only. Add an "Edit all" mode that builds a full ruleset and
    submits via `ModifyFirewallRules` with `FirewallVersion` for safe
    concurrent edits. Add an "Apply recommended" button on empty firewalls
    backed by `DescribeFirewallRulesTemplate`. Surface
    `UnsupportedOperation.FirewallVersionMismatch` as a soft "rules changed —
    refresh and retry" banner.

12. **Returnability check before terminate.** Replace the soft-delete with
    `TerminateInstances`. Before showing the confirm dialog, call
    `DescribeInstancesReturnable` and surface `ReturnFailMessage` so the user
    knows whether they'll see a refund. New route:
    `DELETE /api/vps/instances/[id]?terminate=true`.

13. **Persist `BundleId` / `BlueprintId` / `LatestOperation*`.** Migration to
    add columns on `instance` and update `normalizeInstance()` so the
    reinstall page can preselect the current OS and the dashboard can show
    async operation progress without polling. Use
    `DescribeResetInstanceBlueprints` when listing reinstall targets so the
    list is platform-locked correctly.

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
