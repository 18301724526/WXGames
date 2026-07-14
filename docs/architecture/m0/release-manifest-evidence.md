# M0 基线 release manifest 证据

- 清单：`docs/architecture/m0/release-manifest.json`
- 签名：`docs/architecture/m0/release-manifest.signature.json`
- `manifestDigest`：`9dd3e547a842aefe21da8f4c966cbabcbf4fd897060e714076031d286db5c25d`
- 签名算法：`Ed25519`
- `signerKeyId`：`ed25519:8674d8738f36459e`
- 信任根注入：私钥走 `M0_RELEASE_SIGNING_KEY_PATH`，公钥走 `M0_RELEASE_TRUST_ROOT_PATH`；构建和验签脚本均拒绝仓库运行目录内的密钥文件。
- 文件摘要规则：相对路径按 UTF-8 字节序排列；每项按 `path-byte-length:path:file-byte-length:file-bytes` 输入 `SHA-256`，因此同时绑定文件路径、边界和原始字节。
- 确定性：同一工作树、同一密钥连续构建两次，清单文件 `SHA-256` 均为 `9dd3e547a842aefe21da8f4c966cbabcbf4fd897060e714076031d286db5c25d`，签名文件 `SHA-256` 均为 `09144df3108d252b09199dd0079ec345c44c70e6d39238d93bef41f9cba18000`。
- 验签：原始清单退出码 `0`；修改已签名清单任意一个摘要字节后，`scripts/verify-release-manifest.js` 退出码非 `0`。
- 数据库迁移：`007-create-release-manifests`，checksum `2ced01d6be9aef3c`；`UPDATE`、`DELETE` 均由触发器拒绝。
