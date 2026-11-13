param([string]$OutputDirectory = (Join-Path $PSScriptRoot '전시 운영'))
$ErrorActionPreference = 'Stop'
$compiler = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
if (-not (Test-Path -LiteralPath $compiler)) { $compiler = Join-Path $env:WINDIR 'Microsoft.NET/Framework/v4.0.30319/csc.exe' }
if (-not (Test-Path -LiteralPath $compiler)) { throw '.NET Framework C# compiler was not found.' }
$repoRoot = Split-Path -Parent $PSScriptRoot
$icon = Join-Path $repoRoot 'favicon.ico'
if (-not (Test-Path -LiteralPath $icon)) { throw 'The site favicon.ico was not found.' }
$output = [IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Path $output -Force | Out-Null
$source = Join-Path $PSScriptRoot 'Launcher.cs'
$manifest = Join-Path $PSScriptRoot 'app.manifest'
$shared = @('/nologo', '/target:winexe', '/platform:anycpu', '/optimize+', '/utf8output', '/codepage:65001',
    '/reference:System.Windows.Forms.dll', '/reference:System.Management.dll', '/reference:System.Web.Extensions.dll',
    "/win32icon:$icon", "/win32manifest:$manifest")
& $compiler @shared "/out:$(Join-Path $output '전시 시작.exe')" $source
if ($LASTEXITCODE -ne 0) { throw 'Start launcher compilation failed.' }
& $compiler @shared '/define:EXHIBITION_STOP' "/out:$(Join-Path $output '전시 종료.exe')" $source
if ($LASTEXITCODE -ne 0) { throw 'Stop launcher compilation failed.' }
Copy-Item -LiteralPath (Join-Path $PSScriptRoot '운영 안내.txt') -Destination (Join-Path $output '운영 안내.txt') -Force
Copy-Item -LiteralPath $icon -Destination (Join-Path $output '캐릭터 아이콘.ico') -Force
Get-ChildItem -LiteralPath $output | Select-Object Name, Length
