# 09 — 데스크톱 릴리스 (macOS/Windows 빌드 · 서명 · 공증)

Phase 7(`05-migration-plan.md`) 항목 중 데스크톱 산출물 관련 실행 가이드. `.github/workflows/desktop_release.yml`이
macOS(`macos-latest`)·Windows(`windows-latest`) GitHub-hosted 러너에서 **unsigned 빌드는 지금 바로** 만들어 주고,
아래 시크릿을 추가하면 **서명·공증까지 자동**으로 실행된다. Claude(에이전트)는 Apple/Azure 계정·인증서에 접근할 수 없으므로
이 설정은 사용자가 직접 진행해야 한다.

## 0. 지금 당장 가능한 것 (시크릿 없이)

- `gh workflow run desktop_release.yml` 또는 GitHub UI에서 수동 실행(Actions → Desktop release build → Run workflow) →
  macOS `.app`·Windows `.exe`가 unsigned로 빌드되어 워크플로우 아티팩트로 업로드됨.
- 로컬에서는 이미 검증됨: `flutter build macos --release`가 `apps/editor/build/macos/Build/Products/Release/editor.app`을
  ad-hoc 서명(`flags=0x2(adhoc)`)으로 산출. Windows는 이 저장소가 macOS 환경이라 로컬에서 빌드 불가 — 위 GitHub Actions
  러너(`windows-latest`)가 유일한 검증 경로.
- **주의**: unsigned 상태로 배포하면 macOS는 "확인되지 않은 개발자" Gatekeeper 경고(우클릭 → 열기로 우회 가능), Windows는
  SmartScreen "알 수 없는 게시자" 경고가 뜬다. 소수 테스터 배포는 이 상태로도 가능하지만, 일반 사용자 배포 전 아래 서명을
  마치는 것을 권장.
- 이번 세션에 macOS `Runner/Release.entitlements`·`DebugProfile.entitlements`에 `com.apple.security.network.client`가
  빠져 있던 것을 발견해 추가함(App Sandbox는 이 entitlement 없이 아웃바운드 네트워크 요청 자체를 차단 — Supabase/Gemini
  호출이 막혀 있었을 것). 실제 GUI로 로그인/대시보드 로딩을 확인해 네트워크가 정상 동작하는지 한 번 확인 권장(이 환경은
  디스플레이가 없어 창을 띄워 눈으로 확인하지 못함).

## 1. macOS: Developer ID 서명 + 공증(notarization)

### 준비물
- **Apple Developer Program** 멤버십($99/년, 개인/조직 계정 모두 가능) — https://developer.apple.com/programs/
- Xcode(또는 Xcode Command Line Tools)가 설치된 Mac 1대(인증서 생성·내보내기용, 이후엔 CI가 대신 서명함)

### 절차
1. **인증서 발급**: Xcode 실행 → Settings → Accounts → Apple ID 추가 → 해당 계정 선택 → "Manage Certificates" →
   `+` → **Developer ID Application** 선택. (Xcode가 개인키+인증서를 로그인 키체인에 자동 생성)
2. **Team ID 확인**: https://developer.apple.com/account → Membership 탭 → Team ID(10자리 영숫자).
3. **.p12로 내보내기**: Keychain Access.app → 로그인 키체인 → "내 인증서" → 방금 만든
   `Developer ID Application: <이름> (<TEAMID>)` 우클릭 → 내보내기 → `.p12` 형식, 암호 설정(이 암호가
   `APPLE_CERTIFICATE_PASSWORD`).
4. **base64 인코딩**(GitHub Secrets는 텍스트만 저장 가능):
   ```sh
   base64 -i DeveloperIDApplication.p12 | pbcopy
   ```
5. **앱 전용 암호(app-specific password) 생성**: https://appleid.apple.com → 로그인 및 보안 → 앱 암호 → 생성
   (notarytool 인증용, Apple ID 계정 암호 자체는 사용 불가).
6. **GitHub 저장소 Secrets 등록**(Settings → Secrets and variables → Actions → New repository secret):

   | Secret | 값 |
   | --- | --- |
   | `APPLE_CERTIFICATE_P12` | 4에서 base64 인코딩한 문자열 전체 |
   | `APPLE_CERTIFICATE_PASSWORD` | 3에서 설정한 .p12 암호 |
   | `APPLE_SIGNING_IDENTITY` | `Developer ID Application: <이름> (<TEAMID>)` (정확한 문자열은 `security find-identity -v -p codesigning` 로 확인) |
   | `APPLE_ID` | Apple Developer 계정 이메일 |
   | `APPLE_APP_SPECIFIC_PASSWORD` | 5에서 생성한 앱 전용 암호 |
   | `APPLE_TEAM_ID` | 2에서 확인한 Team ID |

7. 6개 시크릿이 모두 채워지면 `desktop_release.yml`의 macOS job이 자동으로: 임시 키체인에 인증서 임포트 →
   `codesign --deep --force --options runtime` → `xcrun notarytool submit --wait` → `xcrun stapler staple` 순으로 실행.
8. **검증**: 워크플로우 실행 후 아티팩트를 받아 `spctl -a -vvv editor.app`로 확인 — `source=Notarized Developer ID`가 나오면 성공.

## 2. Windows: 코드 서명

두 가지 경로가 있다. **Azure Trusted Signing(권장)**은 워크플로우에 이미 배선해 둔 경로다.

### 옵션 A — Azure Trusted Signing (권장: 물리 토큰·HSM 불필요, 월 대략 $10 내외)
1. Azure 구독 필요(없으면 https://azure.microsoft.com/free 로 생성).
2. Azure Portal → "Trusted Signing" 리소스 생성 (리전은 `east us`/`west europe` 등 codesigning 지원 리전 중 선택).
3. 리소스 안에서 **Identity validation** 진행 — 개인 개발자는 정부 발급 신분증 + 실시간 화상 검증(회사라면 사업자 서류)이
   필요하고 통상 며칠 소요. (기존 방식인 OV/EV 인증서 구매보다 검증 자체는 비슷하지만, 발급 후 물리 토큰 배송/보관이 없다는
   점이 다름.)
4. 신원 검증 통과 후 **Certificate profile** 생성 — 공개 배포용은 **Public Trust** 타입 선택.
5. Microsoft Entra ID(구 Azure AD)에 **App registration** 생성 → 클라이언트 시크릿 발급 → 이 앱에 Trusted Signing
   리소스의 **"Trusted Signing Certificate Profile Signer"** 역할(RBAC) 부여.
6. GitHub Secrets 등록:

   | Secret | 값 |
   | --- | --- |
   | `AZURE_TENANT_ID` | Entra ID 테넌트 ID |
   | `AZURE_CLIENT_ID` | 5에서 만든 App registration의 클라이언트 ID |
   | `AZURE_CLIENT_SECRET` | 5에서 발급한 클라이언트 시크릿 |
   | `AZURE_TRUSTED_SIGNING_ENDPOINT` | 리소스 리전 엔드포인트(예: `https://weu.codesigning.azure.net`) |
   | `AZURE_TRUSTED_SIGNING_ACCOUNT` | 2에서 만든 Trusted Signing 리소스 이름 |
   | `AZURE_CERT_PROFILE` | 4에서 만든 Certificate profile 이름 |

7. `AZURE_TENANT_ID`가 채워지면 Windows job이 `azure/trusted-signing-action`으로 `.exe`를 자동 서명.

### 옵션 B — 전통적 OV/EV 코드서명 인증서 (Sectigo·DigiCert 등, 연 $100~400)
Trusted Signing 신원 검증이 지역상 불가하거나 더 빠른 발급이 필요하면 이 경로를 쓴다. CA에서 `.pfx` 인증서를 발급받아
base64 인코딩 후 `AZURE_*` 시크릿 대신 `WIN_CERTIFICATE_PFX`/`WIN_CERTIFICATE_PASSWORD` 시크릿을 추가하고, 워크플로우의
Azure Trusted Signing 스텝을 `signtool sign /f cert.pfx /p %PASSWORD% /fd sha256 /tr http://timestamp.digicert.com /td sha256 editor.exe`
로 바꿔야 한다(현재 워크플로우엔 이 대체 스텝이 배선돼 있지 않음 — 이 경로를 쓰기로 하면 알려주면 워크플로우를 고쳐줌).

## 3. 실행 방법

```sh
# 수동 1회 실행 (시크릿 유무와 무관하게 항상 unsigned 빌드는 산출됨)
gh workflow run desktop_release.yml

# 또는 릴리스 태그 push 시 자동 실행 + GitHub Release에 자동 첨부
git tag v0.1.0 && git push origin v0.1.0
```

> ⚠️ 태그 push는 원격에 새 ref를 만드는 행위이므로, 실제로 태그를 밀 때는 먼저 사용자에게 확인받고 진행할 것(Claude 세션
> 기준 — 사용자가 직접 실행하는 것을 권장).

## 4. 남은 항목

- 앱 아이콘/번들 이름은 아직 Flutter 기본값(`editor`) — 브랜딩(아이콘·이름 "Formia")은 디자인 동등성 작업과 함께 후속 처리.
- Windows `runner_uninstaller`/MSIX 패키징은 범위 밖(현재는 zip 배포). 필요해지면 `msix` 패키지 추가 검토.
