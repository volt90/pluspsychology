# 전시 실행 파일

`전시 운영/전시 시작.exe`와 `전시 운영/전시 종료.exe`를 포함한 폴더를 Windows 10/11 전시장 PC로 복사합니다. Chrome과 인터넷이 있으면 Node.js나 저장소 설치 없이 공식 HTTPS 체험을 실행합니다. 각 파일에는 저장소의 `favicon.ico`를 같은 아이콘으로 포함합니다.

시작 파일은 설치된 Chrome을 찾고 사이트 연결을 확인한 뒤 전시 전용 프로필로 전체화면 앱 창을 엽니다. 전시가 이미 열려 있으면 기존 창을 앞으로 가져옵니다. 종료 파일은 전용 `--user-data-dir`를 가진 Chrome 브라우저 프로세스의 ID·생성 시각을 다시 확인하고 정상 종료를 요청합니다. 응답하지 않을 때에도 해당 프로세스만 종료하며 `taskkill /IM chrome.exe` 같은 전체 종료를 사용하지 않습니다.

실제 운영 설명은 함께 배포하는 `운영 안내.txt`를 참고합니다. 첫 PC의 카메라 허용, 소리, N키 방향 보정과 현장 조명은 운영자가 확인해야 합니다. 일반 웹캠·개별 PC·전시장 네트워크의 실제 상태까지 소프트웨어 검사만으로 보증하지 않습니다. 새 EXE는 서명되지 않았으므로 관리 PC는 운영 담당자의 실행 허용이 필요할 수 있습니다.

## 재현 빌드

Windows PowerShell에서 실행합니다. .NET Framework 4.x의 Windows 내장 C# 컴파일러를 사용하며 추가 패키지를 다운로드하지 않습니다.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\exhibition\build.ps1
```

`-ExecutionPolicy Bypass`는 해당 빌드 프로세스에만 적용되며 시스템 정책을 변경하지 않습니다. 운영용 EXE에는 PowerShell 실행 정책 변경이 필요 없습니다.

## 브라우저를 건드리지 않는 점검

```powershell
& '.\exhibition\전시 운영\전시 시작.exe' --self-test --output "$env:TEMP\exhibition-self-test.json"
& '.\exhibition\전시 운영\전시 시작.exe' --diagnose --check-network --output "$env:TEMP\exhibition-diagnose.json"
```

GUI 프로그램이므로 실행 완료 후 JSON 파일을 확인합니다. `--self-test`는 일반 Chrome·다른 프로필·자식 프로세스·PID 오인 위험에 대한 명령줄 분류를 검사합니다. `--diagnose`는 Chrome 경로·버전·전용 프로필·현재 전시 프로세스만 읽으며, `--check-network`를 붙이면 공식 주소 접근을 확인합니다. 실제 창을 열거나 닫지 않습니다.
